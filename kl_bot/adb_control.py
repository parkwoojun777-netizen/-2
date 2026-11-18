"""ADB로 안드로이드 화면을 캡처하고 터치를 보내는 모듈."""
import io
import math
import subprocess
import threading

from PIL import Image


class ADB:
    def __init__(self, serial: str | None = None, adb_path: str = "adb"):
        self.base = [adb_path] + (["-s", serial] if serial else [])
        # 동시에 두 개의 입력이 섞이지 않도록 잠금
        self.lock = threading.Lock()

    def _run(self, *args: str, timeout: float = 15) -> bytes:
        result = subprocess.run(
            self.base + list(args), capture_output=True, timeout=timeout
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"adb 오류: {' '.join(args)}\n{result.stderr.decode(errors='ignore')}"
            )
        return result.stdout

    def check(self) -> str:
        return self._run("get-state").decode().strip()

    def screenshot(self) -> Image.Image:
        png = self._run("exec-out", "screencap", "-p")
        return Image.open(io.BytesIO(png)).convert("RGB")

    def tap(self, x: int, y: int) -> None:
        with self.lock:
            self._run("shell", "input", "tap", str(int(x)), str(int(y)))

    def hold(self, x: int, y: int, ms: int) -> None:
        """같은 지점을 ms 동안 길게 누르기."""
        with self.lock:
            self._run(
                "shell", "input", "swipe",
                str(int(x)), str(int(y)), str(int(x)), str(int(y)), str(int(ms)),
                timeout=ms / 1000 + 15,
            )

    def swipe(self, x1: int, y1: int, x2: int, y2: int, ms: int) -> None:
        with self.lock:
            self._run(
                "shell", "input", "swipe",
                str(int(x1)), str(int(y1)), str(int(x2)), str(int(y2)), str(int(ms)),
                timeout=ms / 1000 + 15,
            )

    def joystick(self, cx: int, cy: int, radius: int, angle_deg: float, ms: int) -> None:
        """조이스틱 중심에서 angle 방향으로 ms 동안 밀기.
        angle: 0=오른쪽, 90=위(앞), 180=왼쪽, 270=아래(뒤)."""
        rad = math.radians(angle_deg)
        tx = cx + radius * math.cos(rad)
        ty = cy - radius * math.sin(rad)  # 화면 y축은 아래가 +
        self.swipe(cx, cy, tx, ty, ms)
