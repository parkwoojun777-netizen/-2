"""좌표 맞추기 도우미.

폰 화면을 캡처해서 원본 해상도 기준 좌표 격자를 그린 이미지(calibration.png)를 저장합니다.
이 이미지를 열어서 공격/스킬 버튼, 조이스틱 중심 좌표를 읽고 config.json 에 적으세요.

  python calibrate.py              # 폰에서 캡처
  python calibrate.py --tap 2150 820   # 해당 좌표를 실제로 한 번 탭해서 확인
"""
import argparse
import json
from pathlib import Path

from PIL import ImageDraw

from adb_control import ADB

HERE = Path(__file__).parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tap", nargs=2, type=int, metavar=("X", "Y"))
    ap.add_argument("--config", default=str(HERE / "config.json"))
    args = ap.parse_args()

    cfg_path = Path(args.config)
    cfg = json.loads(cfg_path.read_text(encoding="utf-8")) if cfg_path.exists() else {}
    adb = ADB(cfg.get("adb_serial"), cfg.get("adb_path", "adb"))

    if args.tap:
        adb.tap(*args.tap)
        print(f"탭 전송: {args.tap}")
        return

    img = adb.screenshot()
    print(f"화면 해상도: {img.width} x {img.height}")
    d = ImageDraw.Draw(img)
    step = 100
    for x in range(0, img.width, step):
        d.line([(x, 0), (x, img.height)], fill=(255, 0, 0) if x % 500 == 0 else (255, 255, 0), width=1)
        d.text((x + 3, 3), str(x), fill=(255, 255, 0))
    for y in range(0, img.height, step):
        d.line([(0, y), (img.width, y)], fill=(255, 0, 0) if y % 500 == 0 else (255, 255, 0), width=1)
        d.text((3, y + 3), str(y), fill=(255, 255, 0))

    # 현재 config 의 버튼 위치 표시
    for name, (x, y) in cfg.get("buttons", {}).items():
        d.ellipse([x - 25, y - 25, x + 25, y + 25], outline=(0, 255, 0), width=4)
        d.text((x - 20, y + 30), name, fill=(0, 255, 0))
    if "joystick" in cfg:
        (cx, cy), r = cfg["joystick"]["center"], cfg["joystick"]["radius"]
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(0, 200, 255), width=4)
        d.text((cx - 30, cy + r + 5), "joystick", fill=(0, 200, 255))

    out = HERE / "calibration.png"
    img.save(out)
    print(f"저장됨: {out}  (초록 원 = 현재 설정된 버튼 위치)")


if __name__ == "__main__":
    main()
