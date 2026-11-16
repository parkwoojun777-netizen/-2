"""흰 배경 캐릭터 일러스트를 투명 배경 PNG로 변환한다.

사용법: python3 tools/remove_bg.py 입력.png 출력.png [x0,y0,x1,y1 ...]

- 테두리와 연결된 흰 영역은 무조건 배경으로 처리
- 머리카락 사이에 갇힌 흰 틈도 배경으로 처리하되,
  인자로 준 보호 박스(퍼센트 좌표, 얼굴/셔츠/손 등) 안에 중심이 있는 영역은 보존
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

THRESH = 238      # 흰색 후보 최소 밝기(min 채널)
MAX_SAT = 14      # 흰색 후보 최대 채도(max-min)
MIN_AREA = 25     # 이보다 작은 내부 흰 영역은 무시(하이라이트 등)


def components(mask_img):
    """L 모드 이진 이미지(255=대상)에서 연결 요소를 하나씩 돌려준다."""
    m = mask_img.copy()
    while True:
        arr = np.asarray(m)
        ys, xs = np.nonzero(arr == 255)
        if len(ys) == 0:
            return
        ImageDraw.floodfill(m, (int(xs[0]), int(ys[0])), 100)
        comp = np.asarray(m) == 100
        yield comp
        m = Image.fromarray(np.where(comp, 0, np.asarray(m)).astype(np.uint8)).copy()


def remove_bg(src, dst, protect):
    img = Image.open(src).convert("RGB")
    a = np.asarray(img).astype(np.float32)
    mn, mx = a.min(axis=2), a.max(axis=2)
    h, w = mn.shape

    white = (mn >= THRESH) & ((mx - mn) <= MAX_SAT)
    bg = np.zeros_like(white)
    for comp in components(Image.fromarray((white * 255).astype(np.uint8))):
        ys, xs = np.nonzero(comp)
        touches = ys.min() == 0 or xs.min() == 0 or ys.max() == h - 1 or xs.max() == w - 1
        if touches:
            bg |= comp
            continue
        if len(ys) < MIN_AREA:
            continue
        cx, cy = xs.mean() / w * 100, ys.mean() / h * 100
        if any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in protect):
            continue
        bg |= comp

    # 경계 부드럽게: 배경 주변 띠에서 흰색 정도에 따라 알파 계산
    edge = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    edge &= ~bg
    alpha = np.full(mn.shape, 255.0)
    alpha[bg] = 0
    soft = np.clip((255 - mn) / (255 - 200), 0, 1) * 255
    alpha[edge] = np.minimum(alpha[edge], soft[edge])

    # 흰색이 섞인 경계 색 보정 (흰 배경 기준 un-premultiply)
    af = (alpha / 255.0)[..., None]
    rgb = np.where(af > 0.01, (a - 255 * (1 - af)) / np.maximum(af, 0.01), 0)
    rgb = np.clip(rgb, 0, 255)

    im = Image.fromarray(np.dstack([rgb, alpha]).astype(np.uint8), "RGBA")
    # 모든 표정이 같은 위치에 오도록 크롭하지 않는다
    im.save(dst, optimize=True)
    print(dst, im.size)


if __name__ == "__main__":
    boxes = [tuple(float(v) for v in s.split(",")) for s in sys.argv[3:]]
    remove_bg(sys.argv[1], sys.argv[2], boxes)
