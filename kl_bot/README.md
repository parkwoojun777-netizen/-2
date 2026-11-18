# 킹레거시 던전 AI 봇 (모바일)

PC에서 안드로이드 폰 화면을 캡처하고, **Claude가 화면을 보고 판단**해서 터치를 보내는 봇입니다.
게임에 코드를 주입하지 않고, 사람이 화면을 터치하는 것과 같은 방식(ADB 입력)만 사용합니다.

```
폰 화면 캡처 ─▶ Claude: 상황 판단 + 다음 행동(JSON) ─▶ 탭/이동/카메라 실행 ─▶ 반복
                          │
                          └─ combat_mode=ON 이면 로컬 '전투 오토파일럿'이 스킬·공격을 쿨타임대로 연타
```

Claude 응답은 한 번에 몇 초 걸려서, 빠른 연타는 로컬 스레드가 맡고
Claude는 "지금 싸울지, 어디로 갈지, 어떤 버튼을 누를지"만 판단합니다.

> ⚠️ 입력 매크로/봇도 로블록스·게임 규칙상 제재 대상이 될 수 있습니다. 본인 책임 하에 사용하세요.

---

## 1. 준비물

- 안드로이드 폰 + USB 케이블
- PC (Windows / Mac / Linux), Python 3.10 이상
- Anthropic API 키 (https://console.anthropic.com)

## 2. 설치

1. **ADB 설치**: [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) 다운로드 후 압축 해제, 폴더를 PATH에 추가
   (또는 `config.json`의 `adb_path`에 `adb.exe` 전체 경로 입력)
2. **폰 설정**: 설정 → 휴대전화 정보 → 빌드번호 7번 탭 → 개발자 옵션 → **USB 디버깅 ON**
   - 샤오미 등 일부 기종은 **"USB 디버깅(보안 설정)"** 도 켜야 터치 입력이 됩니다.
3. 폰 연결 후 `adb devices` 실행 → 폰에 뜨는 허용 창에서 "허용"
4. 패키지 설치:
   ```bash
   cd kl_bot
   pip install -r requirements.txt
   ```
5. API 키 설정:
   ```bash
   # Windows (PowerShell)
   setx ANTHROPIC_API_KEY "sk-ant-..."     # 새 터미널부터 적용
   # Mac / Linux
   export ANTHROPIC_API_KEY="sk-ant-..."
   ```

## 3. 좌표 맞추기 (중요)

1. `config.example.json` 을 `config.json` 으로 복사
2. 킹레거시를 켜고 **가로 화면**으로 던전 안이나 필드에 서 있는 상태에서:
   ```bash
   python calibrate.py
   ```
3. 생성된 `calibration.png`를 열어 격자 숫자를 보고 다음 좌표를 `config.json`에 입력
   - `buttons`: `attack`(기본공격), `skill_z/x/c/v/f`, `jump` 버튼의 중심
   - `joystick.center`: 이동 조이스틱 중심, `radius`: 밀어줄 거리(조이스틱 반지름 정도)
   - `camera_drag_area.center`: 카메라를 돌릴 때 드래그할 빈 화면 위치 (버튼 없는 오른쪽 중앙)
4. 다시 `python calibrate.py` → 초록 원이 버튼 위에 정확히 있는지 확인
5. 하나씩 실제로 눌러보기: `python calibrate.py --tap 2150 820`

`combat_rotation`의 `cooldown`(초)은 내 스킬 쿨타임에 맞춰 조정하세요.

## 4. 실행

```bash
# (1) 폰 없이 판단만 테스트: 던전 스크린샷 한 장으로 Claude가 뭘 할지 확인
python bot.py --image 던전스샷.png

# (2) 폰 연결, 입력은 안 보내고 판단만 출력
python bot.py --dry-run

# (3) 실제 실행  (멈추기: Ctrl+C)
python bot.py
```

출력 예시:
```
[12] (3.1초, 누적 약 $0.180) 상황=combat 전투=ON
  관찰: 적 3마리가 정면 가까이 있음. 체력 70%.
  → 이동 forward 0.8초
```

## 5. 설정 항목 (`config.json`)

| 항목 | 설명 |
|---|---|
| `model` | 사용할 Claude 모델. 기본 `claude-opus-5-5` |
| `effort` | 판단 깊이 `low`/`medium`/`high`. 게임은 속도가 중요해서 `low` 권장 |
| `price_per_mtok` | 비용 표시용 단가 (모델 바꾸면 같이 수정) |
| `goal` | Claude에게 줄 목표 설명. 던전 이름, 입장 방법 등을 자세히 쓸수록 잘함 |
| `image_max_width` | Claude에게 보내는 스크린샷 가로 크기. 작을수록 싸고 빠르지만 덜 정확 |
| `draw_grid` | 스크린샷에 좌표 격자 그리기 (탭 정확도 향상) |
| `step_interval_sec` | 비전투 시 판단 간격 |
| `combat_step_interval_sec` | 전투 중 판단 간격 (오토파일럿이 싸우는 동안은 자주 볼 필요 없음) |
| `max_minutes` | 최대 실행 시간 (안전장치) |

### `goal` 잘 쓰는 법
Claude는 킹레거시 UI를 정확히 모를 수 있습니다. 직접 겪은 흐름을 적어주면 훨씬 잘 합니다. 예:
```
"goal": "던전 NPC 앞에서 'Dungeon' 버튼 → 난이도 'Normal' → 'Start'를 눌러 입장한다.
 던전 안에서는 빨간 체력바가 있는 적에게 다가가 처치한다. 웨이브가 끝나면 앞으로 이동한다.
 'Dungeon Cleared' 보상 창이 뜨면 'Claim'을 누르고, 로비로 돌아오면 다시 입장한다.
 죽으면 리스폰 후 던전 NPC로 이동한다."
```

## 6. 비용 / 속도

- 한 단계(스크린샷 1장 판단)마다 대략 입력 2~3천 토큰 + 출력 수백 토큰.
- Opus 5.5 기준 한 단계 약 $0.01~0.02 → 1시간에 수백 단계면 **수 달러 ~ 십몇 달러**가 나올 수 있습니다.
- 실행 중 콘솔에 누적 예상 비용이 표시되니 처음엔 짧게 돌려보고 확인하세요.
- 비용을 줄이려면:
  - `combat_step_interval_sec`를 늘리기 (전투는 오토파일럿에 맡기기)
  - `image_max_width`를 1024 정도로 낮추기
  - `model`을 더 싼 모델로 변경 (예: `claude-haiku-5-5`, 단가 `0.1 / 0.5`) — 판단 정확도는 떨어질 수 있음

## 7. 문제 해결

| 증상 | 해결 |
|---|---|
| `adb 오류` / 폰 연결 실패 | `adb devices`에 폰이 `device`로 보이는지, 허용 창을 눌렀는지 확인 |
| 탭이 안 먹힘 | 샤오미 등은 "USB 디버깅(보안 설정)" ON 필요 |
| 엉뚱한 곳을 탭함 | `calibrate.py`로 버튼 좌표 재확인, `draw_grid: true` 확인 |
| 같은 행동만 반복 / 막힘 | `goal`에 그 상황의 해결법을 구체적으로 추가 |
| 캐릭터가 이상한 방향으로 감 | `joystick.center`/`radius` 확인 |

막히는 화면 스크린샷과 콘솔 로그를 주시면 프롬프트·설정을 같이 다듬을 수 있습니다.
