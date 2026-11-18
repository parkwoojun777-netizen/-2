"""킹레거시 던전 AI 봇 (모바일 / ADB + Claude API)

동작:
  1) 폰 화면 캡처 (ADB)
  2) Claude가 화면을 보고 상황 판단 + 다음 행동 결정 (JSON)
  3) 행동 실행 (탭 / 이동 / 카메라 / 대기 ...)
  4) 전투 중에는 '전투 오토파일럿' 스레드가 스킬/공격을 빠르게 연타
     (Claude 응답은 몇 초 걸리므로, 빠른 연타는 로컬에서 처리)

사용법:
  python bot.py                       # 실제 실행
  python bot.py --dry-run             # 입력은 보내지 않고 판단만 출력
  python bot.py --image test.png      # 폰 없이 스크린샷 한 장으로 판단 테스트
"""
import argparse
import base64
import io
import json
import sys
import threading
import time
from collections import deque
from pathlib import Path

import anthropic
from PIL import Image, ImageDraw

from adb_control import ADB

HERE = Path(__file__).parent

# server-side 거절 폴백을 지원하는 모델 (Haiku 등은 미지원)
FALLBACK_MODELS = {"claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5",
                   "claude-fable-5-2", "claude-fable-5-1"}

MOVE_ANGLES = {
    "forward": 90, "back": 270, "left": 180, "right": 0,
    "forward_left": 135, "forward_right": 45, "back_left": 225, "back_right": 315,
}


# ----------------------------------------------------------------------------
# 설정 / 프롬프트 / 스키마
# ----------------------------------------------------------------------------
def load_config(path: Path) -> dict:
    if not path.exists():
        sys.exit(f"설정 파일이 없습니다: {path}\n"
                 f"config.example.json 을 config.json 으로 복사한 뒤 좌표를 맞춰주세요.")
    return json.loads(path.read_text(encoding="utf-8"))


def build_system_prompt(cfg: dict) -> str:
    buttons = ", ".join(cfg["buttons"].keys())
    return f"""너는 모바일 로블록스 게임 'King Legacy'를 대신 플레이하는 컨트롤러다.
매 단계마다 현재 폰 화면 스크린샷(가로 모드)을 받고, 다음에 할 행동을 JSON으로 정한다.

## 목표
{cfg["goal"]}

## 조작 수단
- button: 미리 등록된 버튼을 이름으로 누른다. 등록된 버튼: {buttons}
- tap: 그 외 UI(입장 버튼, 확인/닫기, 보상 창, 메뉴 등)를 스크린샷 좌표 (x, y)로 탭한다.
  좌표는 네가 받은 스크린샷 이미지의 픽셀 기준이다. 이미지에 옅은 격자와 좌표 숫자가 그려져 있으면 참고해서 정확히 찍어라.
- move: 조이스틱으로 캐릭터를 이동한다. direction은 카메라 기준 방향, seconds는 0.2~3초.
- camera: 화면을 드래그해 카메라를 돌린다. 적이 안 보이면 카메라를 돌려 찾아라.
- wait: 로딩/연출 중일 때 기다린다 (최대 10초).
- stop: 봇을 멈춰야 할 때만 사용 (예: 계정/결제/신고 창, 의도와 전혀 다른 게임 화면, 같은 상황에서 계속 막힘).

## 전투 오토파일럿
combat_mode 를 true 로 두면 별도 스레드가 스킬과 기본 공격을 쿨타임에 맞춰 계속 연타한다.
- 적이 가까이 있고 전투 중이면 combat_mode=true 로 두고, 너는 적 쪽으로 위치를 맞추는 이동/카메라만 하면 된다.
- 로비, 메뉴, 보상 창, 로딩, 이동만 해야 하는 상황에서는 combat_mode=false (헛스킬/엉뚱한 UI 클릭 방지).

## 규칙
- 한 단계의 actions는 1~4개. 확실하지 않으면 적게 하고 다음 스크린샷에서 확인한다.
- 직전 기록을 보고, 같은 행동이 효과가 없었다면 다른 방법을 시도한다.
- 결제/로벅스 구매, 거래, 채팅, 설정 변경, 게임 나가기 버튼은 절대 누르지 않는다.
- note에는 다음 단계의 너에게 남길 짧은 메모(진행 상황, 시도한 것)를 쓴다.
"""


def build_schema(cfg: dict) -> dict:
    button_names = list(cfg["buttons"].keys())

    def obj(props: dict) -> dict:
        return {"type": "object", "properties": props,
                "required": list(props.keys()), "additionalProperties": False}

    action = {"anyOf": [
        obj({"type": {"const": "button"}, "name": {"enum": button_names},
             "times": {"type": "integer"}}),
        obj({"type": {"const": "tap"}, "x": {"type": "integer"}, "y": {"type": "integer"},
             "target": {"type": "string"}}),
        obj({"type": {"const": "move"}, "direction": {"enum": list(MOVE_ANGLES)},
             "seconds": {"type": "number"}}),
        obj({"type": {"const": "camera"}, "direction": {"enum": ["left", "right", "up", "down"]},
             "amount": {"enum": ["small", "medium", "large"]}}),
        obj({"type": {"const": "wait"}, "seconds": {"type": "number"}}),
        obj({"type": {"const": "stop"}, "reason": {"type": "string"}}),
    ]}
    return obj({
        "situation": {"enum": ["lobby", "dungeon_entry_ui", "loading", "combat",
                               "exploring", "reward_or_cleared", "dead", "popup", "unknown"]},
        "observation": {"type": "string"},
        "combat_mode": {"type": "boolean"},
        "actions": {"type": "array", "items": action},
        "note": {"type": "string"},
    })


# ----------------------------------------------------------------------------
# 이미지 처리
# ----------------------------------------------------------------------------
def prepare_image(img: Image.Image, max_w: int, grid: bool) -> tuple[str, float, Image.Image]:
    """축소 + (선택) 좌표 격자 → base64 JPEG, 원본 대비 배율 반환."""
    scale = 1.0
    if img.width > max_w:
        scale = img.width / max_w
        img = img.resize((max_w, round(img.height / scale)), Image.LANCZOS)
    if grid:
        img = img.copy()
        d = ImageDraw.Draw(img)
        step = 100
        for x in range(step, img.width, step):
            d.line([(x, 0), (x, img.height)], fill=(255, 255, 0), width=1)
            d.text((x + 2, 2), str(x), fill=(255, 255, 0))
        for y in range(step, img.height, step):
            d.line([(0, y), (img.width, y)], fill=(255, 255, 0), width=1)
            d.text((2, y + 2), str(y), fill=(255, 255, 0))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=75)
    return base64.standard_b64encode(buf.getvalue()).decode(), scale, img


# ----------------------------------------------------------------------------
# 전투 오토파일럿 (로컬 고속 연타)
# ----------------------------------------------------------------------------
class CombatAutopilot(threading.Thread):
    def __init__(self, adb: ADB | None, cfg: dict):
        super().__init__(daemon=True)
        self.adb, self.cfg = adb, cfg
        self.enabled = threading.Event()
        self.stopped = threading.Event()
        self.last_used = {s["button"]: 0.0 for s in cfg["combat_rotation"]}

    def _press(self, name: str) -> None:
        if self.adb:
            x, y = self.cfg["buttons"][name]
            self.adb.tap(x, y)

    def run(self) -> None:
        gap = self.cfg["tap_gap_sec"]
        while not self.stopped.is_set():
            if not self.enabled.wait(timeout=0.5):
                continue
            try:
                for skill in self.cfg["combat_rotation"]:
                    if not self.enabled.is_set():
                        break
                    now = time.time()
                    if now - self.last_used[skill["button"]] >= skill["cooldown"]:
                        self._press(skill["button"])
                        self.last_used[skill["button"]] = now
                        time.sleep(gap)
                    for _ in range(self.cfg["attack_taps_between_skills"]):
                        if not self.enabled.is_set():
                            break
                        self._press("attack")
                        time.sleep(gap)
            except Exception as e:  # adb 일시 오류는 무시하고 계속
                print(f"[오토파일럿] 오류: {e}")
                time.sleep(1)


# ----------------------------------------------------------------------------
# 봇 본체
# ----------------------------------------------------------------------------
class Bot:
    def __init__(self, cfg: dict, adb: ADB | None, dry_run: bool):
        self.cfg, self.adb, self.dry_run = cfg, adb, dry_run
        self.client = anthropic.Anthropic()
        self.system = build_system_prompt(cfg)
        self.schema = build_schema(cfg)
        self.history: deque[str] = deque(maxlen=cfg["history_length"])
        self.autopilot = CombatAutopilot(None if dry_run else adb, cfg)
        self.combat_mode = False
        self.tokens_in = self.tokens_out = 0
        self.step = 0

    # ---- Claude 호출 ------------------------------------------------------
    def decide(self, img: Image.Image) -> tuple[dict | None, float]:
        b64, scale, sent = prepare_image(img, self.cfg["image_max_width"], self.cfg["draw_grid"])
        history = "\n".join(self.history) or "(없음)"
        text = (f"단계 {self.step}. 스크린샷 크기 {sent.width}x{sent.height}. "
                f"현재 combat_mode={self.combat_mode}.\n\n최근 기록 (오래된 것 → 최신):\n{history}\n\n"
                f"이 화면에서 다음 행동을 정해라.")
        kwargs = dict(
            model=self.cfg["model"],
            max_tokens=8000,
            system=[{"type": "text", "text": self.system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                {"type": "text", "text": text},
            ]}],
            output_config={"effort": self.cfg["effort"],
                           "format": {"type": "json_schema", "schema": self.schema}},
        )
        try:
            if self.cfg["model"] in FALLBACK_MODELS:
                resp = self.client.beta.messages.create(
                    betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs)
            else:
                resp = self.client.messages.create(**kwargs)
        except anthropic.AuthenticationError:
            sys.exit("API 키가 올바르지 않습니다. ANTHROPIC_API_KEY 를 확인하세요.")
        except anthropic.RateLimitError:
            print("[API] 요청 한도 초과 — 10초 대기")
            time.sleep(10)
            return None, scale
        except anthropic.APIStatusError as e:
            print(f"[API] 오류 {e.status_code}: {e.message}")
            time.sleep(3)
            return None, scale
        except anthropic.APIConnectionError:
            print("[API] 네트워크 오류 — 3초 대기")
            time.sleep(3)
            return None, scale

        self.tokens_in += resp.usage.input_tokens + (resp.usage.cache_read_input_tokens or 0) \
            + (resp.usage.cache_creation_input_tokens or 0)
        self.tokens_out += resp.usage.output_tokens

        if resp.stop_reason == "refusal":
            print("[API] 요청이 거절됨 — 이번 단계 건너뜀")
            return None, scale
        if resp.stop_reason == "max_tokens":
            print("[API] 응답이 잘림 — 이번 단계 건너뜀")
            return None, scale
        text_out = next((b.text for b in resp.content if b.type == "text"), None)
        if not text_out:
            return None, scale
        try:
            return json.loads(text_out), scale
        except json.JSONDecodeError:
            print("[API] JSON 파싱 실패")
            return None, scale

    # ---- 행동 실행 --------------------------------------------------------
    def execute(self, action: dict, scale: float) -> str:
        t = action["type"]
        cfg, adb, dry = self.cfg, self.adb, self.dry_run
        if t == "button":
            times = max(1, min(int(action["times"]), 10))
            if not dry:
                x, y = cfg["buttons"][action["name"]]
                for _ in range(times):
                    adb.tap(x, y)
                    time.sleep(cfg["tap_gap_sec"])
            return f"버튼 {action['name']} x{times}"
        if t == "tap":
            x, y = round(action["x"] * scale), round(action["y"] * scale)
            if not dry:
                adb.tap(x, y)
            return f"탭 ({action['x']},{action['y']}) '{action['target']}'"
        if t == "move":
            sec = max(0.2, min(float(action["seconds"]), 3.0))
            if not dry:
                j = cfg["joystick"]
                adb.joystick(*j["center"], j["radius"], MOVE_ANGLES[action["direction"]], int(sec * 1000))
            return f"이동 {action['direction']} {sec:.1f}초"
        if t == "camera":
            if not dry:
                c = cfg["camera_drag_area"]
                dist = c[action["amount"]]
                cx, cy = c["center"]
                dx, dy = {"left": (-dist, 0), "right": (dist, 0),
                          "up": (0, -dist // 2), "down": (0, dist // 2)}[action["direction"]]
                adb.swipe(cx, cy, cx + dx, cy + dy, 300)
            return f"카메라 {action['direction']} {action['amount']}"
        if t == "wait":
            sec = max(0.0, min(float(action["seconds"]), 10.0))
            time.sleep(sec)
            return f"대기 {sec:.1f}초"
        return f"알 수 없는 행동 {t}"

    def cost(self) -> float:
        p = self.cfg["price_per_mtok"]
        return self.tokens_in / 1e6 * p["input"] + self.tokens_out / 1e6 * p["output"]

    # ---- 한 단계 ----------------------------------------------------------
    def run_step(self, img: Image.Image) -> bool:
        """한 단계 실행. 계속하면 True, 멈춰야 하면 False."""
        self.step += 1
        t0 = time.time()
        decision, scale = self.decide(img)
        dt = time.time() - t0
        if decision is None:
            return True

        self.combat_mode = bool(decision["combat_mode"])
        if self.combat_mode:
            self.autopilot.enabled.set()
        else:
            self.autopilot.enabled.clear()

        print(f"\n[{self.step}] ({dt:.1f}초, 누적 약 ${self.cost():.3f}) "
              f"상황={decision['situation']} 전투={'ON' if self.combat_mode else 'OFF'}")
        print(f"  관찰: {decision['observation']}")

        done = []
        for action in decision["actions"][:4]:
            if action["type"] == "stop":
                print(f"  ■ 정지 요청: {action['reason']}")
                return False
            try:
                desc = self.execute(action, scale)
            except Exception as e:
                desc = f"실행 실패 ({action['type']}): {e}"
            print(f"  → {desc}")
            done.append(desc)

        self.history.append(f"[{self.step}] {decision['situation']} | "
                            f"{' / '.join(done) or '행동 없음'} | 메모: {decision['note']}")
        return True

    def loop(self) -> None:
        self.autopilot.start()
        deadline = time.time() + self.cfg["max_minutes"] * 60
        try:
            while time.time() < deadline:
                img = self.adb.screenshot()
                if not self.run_step(img):
                    break
                time.sleep(self.cfg["combat_step_interval_sec"] if self.combat_mode
                           else self.cfg["step_interval_sec"])
            else:
                print(f"\n최대 실행 시간({self.cfg['max_minutes']}분) 도달 — 종료")
        except KeyboardInterrupt:
            print("\nCtrl+C — 종료")
        finally:
            self.autopilot.enabled.clear()
            self.autopilot.stopped.set()
            print(f"총 {self.step}단계, 입력 {self.tokens_in:,} / 출력 {self.tokens_out:,} 토큰, "
                  f"예상 비용 약 ${self.cost():.2f}")


def main() -> None:
    ap = argparse.ArgumentParser(description="킹레거시 던전 AI 봇")
    ap.add_argument("--config", default=str(HERE / "config.json"))
    ap.add_argument("--dry-run", action="store_true", help="입력을 보내지 않고 판단만 출력")
    ap.add_argument("--image", help="폰 없이 이 스크린샷 한 장으로 판단만 테스트")
    args = ap.parse_args()

    cfg = load_config(Path(args.config))

    if args.image:
        bot = Bot(cfg, None, dry_run=True)
        bot.run_step(Image.open(args.image).convert("RGB"))
        print(f"\n입력 {bot.tokens_in:,} / 출력 {bot.tokens_out:,} 토큰, 약 ${bot.cost():.4f}")
        return

    adb = ADB(cfg.get("adb_serial"), cfg.get("adb_path", "adb"))
    try:
        state = adb.check()
    except Exception as e:
        sys.exit(f"폰 연결 확인 실패: {e}\nUSB 디버깅이 켜져 있고 'adb devices'에 폰이 보이는지 확인하세요.")
    print(f"폰 연결됨 ({state}). {'[DRY RUN] ' if args.dry_run else ''}"
          f"3초 후 시작합니다. 멈추려면 Ctrl+C.")
    time.sleep(3)
    Bot(cfg, adb, args.dry_run).loop()


if __name__ == "__main__":
    main()
