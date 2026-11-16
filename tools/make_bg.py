"""대학 캠퍼스 배경 SVG 생성기 (1280x720).

사용법: python3 tools/make_bg.py   → assets/bg/*.svg 생성
"""
import random
from pathlib import Path

W, H = 1280, 720
OUT = Path(__file__).resolve().parent.parent / "assets" / "bg"


def svg(body, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
            f'preserveAspectRatio="xMidYMid slice">\n<defs>{defs}</defs>\n{body}\n</svg>\n')


def rect(x, y, w, h, fill, extra=""):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}" {extra}/>'


COMMON_DEFS = """
<filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="blur2"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="haze"><feGaussianBlur stdDeviation="14"/></filter>
"""


# ---------------------------------------------------------------- 캠퍼스 (야외)
def campus():
    r = random.Random(1)
    defs = COMMON_DEFS + """
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#7fb6e8"/><stop offset=".6" stop-color="#cfe6f7"/><stop offset="1" stop-color="#eef6fb"/>
</linearGradient>
<linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#8fbf6a"/><stop offset="1" stop-color="#5f9a48"/>
</linearGradient>
<linearGradient id="path" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#d9cbb3"/><stop offset="1" stop-color="#bfae92"/>
</linearGradient>
<linearGradient id="brick" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#b9715a"/><stop offset="1" stop-color="#9a5a47"/>
</linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#cfe3f2"/><stop offset="1" stop-color="#7f9fb8"/>
</linearGradient>
"""
    b = [rect(0, 0, W, H, "url(#sky)")]
    # 구름
    for cx, cy, s in [(180, 90, 1.0), (620, 60, 1.3), (1050, 120, 0.9), (900, 40, 0.6)]:
        b.append(f'<g filter="url(#soft)" fill="#fff" opacity=".85" transform="translate({cx},{cy}) scale({s})">'
                 '<ellipse cx="0" cy="0" rx="90" ry="26"/><ellipse cx="-40" cy="-14" rx="46" ry="30"/>'
                 '<ellipse cx="30" cy="-20" rx="56" ry="36"/></g>')
    # 먼 산/나무 실루엣
    b.append('<path d="M0 380 Q160 320 320 360 T640 350 T960 340 T1280 360 V460 H0Z" fill="#a9c7b0" opacity=".7" filter="url(#blur2)"/>')
    # 본관 (벽돌 + 시계탑)
    b.append(rect(300, 200, 680, 260, "url(#brick)"))
    b.append(rect(290, 190, 700, 18, "#7e4637"))
    b.append(rect(570, 90, 140, 120, "url(#brick)"))
    b.append('<path d="M560 92 L640 30 L720 92Z" fill="#5b3b33"/>')
    b.append('<circle cx="640" cy="140" r="34" fill="#f3efe6" stroke="#5b3b33" stroke-width="5"/>')
    b.append('<path d="M640 140 L640 116 M640 140 L657 150" stroke="#3b2a25" stroke-width="4" stroke-linecap="round"/>')
    for row in range(3):
        for col in range(10):
            x = 325 + col * 65
            y = 230 + row * 72
            if 590 < x < 690 and row == 2:
                continue
            b.append(rect(x, y, 34, 48, "url(#glass)", 'rx="3" stroke="#f1e3d6" stroke-width="3"'))
    # 정문
    b.append('<path d="M598 460 V380 Q640 340 682 380 V460Z" fill="#3c2c28"/>')
    b.append('<path d="M606 460 V384 Q640 352 674 384 V460Z" fill="url(#glass)" opacity=".8"/>')
    b.append(rect(560, 450, 160, 14, "#cbb9a4"))
    # 오른쪽 현대식 건물
    b.append(rect(1010, 240, 270, 230, "#e6e2da"))
    for row in range(4):
        b.append(rect(1010, 255 + row * 52, 270, 30, "url(#glass)", 'opacity=".9"'))
    # 왼쪽 건물
    b.append(rect(0, 260, 280, 210, "#d8d0c3"))
    for row in range(3):
        for col in range(5):
            b.append(rect(20 + col * 52, 280 + row * 58, 32, 38, "url(#glass)", 'rx="2"'))
    # 잔디와 길
    b.append(f'<path d="M0 460 H{W} V{H} H0Z" fill="url(#lawn)"/>')
    b.append('<path d="M560 460 H720 L1000 720 H280Z" fill="url(#path)"/>')
    for i in range(9):
        y = 470 + i * i * 3.3
        b.append(f'<path d="M{560 - i * i * 3.4:.0f} {y:.0f} H{720 + i * i * 3.4:.0f}" stroke="#ab9a7f" stroke-width="{1 + i * .25:.1f}" opacity=".5"/>')
    # 나무
    def tree(x, y, s, col="#4f8a3f"):
        out = [f'<g transform="translate({x},{y}) scale({s})">',
               '<rect x="-9" y="-10" width="18" height="110" fill="#6b4b36"/>']
        for dx, dy, rr in [(0, -70, 70), (-50, -30, 52), (50, -30, 52), (-25, -110, 50), (30, -105, 48)]:
            out.append(f'<circle cx="{dx}" cy="{dy}" r="{rr}" fill="{col}"/>')
        out.append('<circle cx="-20" cy="-95" r="26" fill="#7fb35d" opacity=".6"/>')
        out.append('</g>')
        return "".join(out)
    b.append(tree(140, 420, 1.0))
    b.append(tree(1150, 430, 1.05, "#46803a"))
    b.append(tree(40, 520, 1.5, "#3f7534"))
    b.append(tree(1250, 540, 1.6, "#3b6f31"))
    # 가로등
    for x, y, s in [(470, 470, 1.0), (840, 470, 1.0), (330, 560, 1.5), (980, 560, 1.5)]:
        b.append(f'<g transform="translate({x},{y}) scale({s})"><rect x="-3" y="-120" width="6" height="120" fill="#33393f"/>'
                 '<rect x="-12" y="-138" width="24" height="22" rx="4" fill="#33393f"/><rect x="-8" y="-133" width="16" height="12" fill="#fff6d8"/></g>')
    # 벤치
    b.append('<g transform="translate(160,600)"><rect x="0" y="0" width="170" height="14" fill="#8b5e3c"/>'
             '<rect x="0" y="-34" width="170" height="10" fill="#8b5e3c"/><rect x="0" y="-18" width="170" height="10" fill="#8b5e3c"/>'
             '<rect x="10" y="14" width="8" height="34" fill="#2f3337"/><rect x="152" y="14" width="8" height="34" fill="#2f3337"/></g>')
    # 잔디 질감
    for _ in range(260):
        x = r.uniform(0, W)
        y = r.uniform(470, H)
        b.append(f'<path d="M{x:.0f} {y:.0f} l2 -{r.uniform(4, 9):.0f}" stroke="#3f7a33" stroke-width="1.4" opacity=".35"/>')
    # 빛 번짐
    b.append('<ellipse cx="1100" cy="0" rx="380" ry="240" fill="#fffbe6" opacity=".35" filter="url(#haze)"/>')
    return svg("\n".join(b), defs)


# ---------------------------------------------------------------- 강의실
def lecture():
    defs = COMMON_DEFS + """
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ece6da"/><stop offset="1" stop-color="#d8cfbf"/>
</linearGradient>
<linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#bfe0f5"/><stop offset="1" stop-color="#f4fbff"/>
</linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#9c7a5a"/><stop offset="1" stop-color="#6e5238"/>
</linearGradient>
<linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#c79d6d"/><stop offset="1" stop-color="#a77d50"/>
</linearGradient>
<linearGradient id="beam" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#fffbe8" stop-opacity=".55"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/>
</linearGradient>
"""
    b = [rect(0, 0, W, H, "url(#wall)")]
    # 천장
    b.append('<path d="M0 0 H1280 V70 H0Z" fill="#f4f1ea"/>')
    for x in (250, 640, 1030):
        b.append(rect(x - 90, 24, 180, 14, "#fffef6", 'rx="4"'))
        b.append(f'<ellipse cx="{x}" cy="40" rx="140" ry="18" fill="#fffde8" opacity=".5" filter="url(#soft)"/>')
    # 왼쪽 창문
    for i, x in enumerate((20, 150)):
        b.append(rect(x, 110, 110, 260, "url(#win)", 'stroke="#f8f6f0" stroke-width="8"'))
        b.append(f'<path d="M{x + 55} 110 V370 M{x} 240 H{x + 110}" stroke="#f8f6f0" stroke-width="6"/>')
        b.append(f'<path d="M{x + 10} 330 q30 -40 50 -10 t50 -20 V370 H{x}Z" fill="#9fcf87" opacity=".7"/>')
    b.append('<path d="M20 110 L270 110 L620 720 L120 720Z" fill="url(#beam)"/>')
    # 칠판(화이트보드) + 스크린
    b.append(rect(360, 120, 620, 230, "#5c6670", 'rx="6"'))
    b.append(rect(372, 132, 596, 206, "#f7f9f8"))
    b.append('<path d="M400 170 H640 M400 200 H700 M400 230 H600" stroke="#4a6fa5" stroke-width="5" stroke-linecap="round" opacity=".55"/>')
    b.append('<path d="M760 180 q40 -40 80 0 t80 0" stroke="#c0504d" stroke-width="5" fill="none" opacity=".5"/>')
    b.append('<circle cx="840" cy="260" r="36" fill="none" stroke="#4a8a5a" stroke-width="5" opacity=".5"/>')
    b.append(rect(380, 350, 580, 10, "#8d969e"))
    # 시계
    b.append('<circle cx="1120" cy="150" r="34" fill="#fff" stroke="#555" stroke-width="5"/>'
             '<path d="M1120 150 V126 M1120 150 L1136 158" stroke="#333" stroke-width="4" stroke-linecap="round"/>')
    # 문
    b.append(rect(1150, 210, 110, 220, "#a98058"))
    b.append(rect(1165, 230, 40, 60, "url(#win)"))
    b.append('<circle cx="1240" cy="330" r="6" fill="#d8c08a"/>')
    # 교탁
    b.append(rect(560, 360, 220, 90, "#8b6440", 'rx="4"'))
    b.append(rect(550, 352, 240, 14, "#a77d50"))
    # 바닥
    b.append('<path d="M0 430 H1280 V720 H0Z" fill="url(#floor)"/>')
    # 계단식 책상 (앞에서부터 뒤로 갈수록 크고 낮게)
    for i, (y, h) in enumerate([(470, 22), (530, 30), (610, 40)]):
        b.append(rect(-20, y + h, W + 40, 80, "#5a4330", 'opacity=".55"'))
        b.append(rect(-20, y, W + 40, h, "url(#desk)"))
        b.append(rect(-20, y + h, W + 40, 6, "#7a5a3a"))
        # 의자 등받이
        for x in range(40 + i * 30, W, 210 + i * 30):
            b.append(rect(x, y - 30 - i * 10, 90 + i * 20, 28 + i * 8, "#3f4a5c", 'rx="8"'))
        # 책상 위 소품
        r = random.Random(i + 7)
        for x in range(100 + i * 50, W - 100, 330 + i * 40):
            c = r.choice(["#e9e3d7", "#c9dbe9", "#f0d8c8"])
            b.append(rect(x, y - 6 - i * 2, 60 + i * 15, 8 + i * 2, c, 'rx="2"'))
    return svg("\n".join(b), defs)


# ---------------------------------------------------------------- 학생식당
def cafeteria():
    r = random.Random(5)
    defs = COMMON_DEFS + """
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#f3ede2"/><stop offset="1" stop-color="#e3d8c5"/>
</linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#cfc6b8"/><stop offset="1" stop-color="#aea392"/>
</linearGradient>
<linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#b9dcf3"/><stop offset="1" stop-color="#eef8ff"/>
</linearGradient>
"""
    b = [rect(0, 0, W, H, "url(#wall)")]
    # 큰 창
    b.append(rect(0, 60, 420, 330, "url(#win)"))
    for x in range(0, 421, 105):
        b.append(rect(x, 60, 6, 330, "#e9e4da"))
    b.append(rect(0, 220, 420, 6, "#e9e4da"))
    b.append('<path d="M0 330 q60 -50 120 -10 t120 -10 t120 0 t60 0 V390 H0Z" fill="#8fc27a" opacity=".75"/>')
    # 배식 카운터
    b.append(rect(520, 200, 760, 190, "#d6cbb8"))
    b.append(rect(520, 300, 760, 90, "#9fb4c2"))
    b.append(rect(520, 292, 760, 12, "#e8eef2"))
    for x in range(560, 1280, 140):
        b.append(f'<ellipse cx="{x + 40}" cy="292" rx="44" ry="10" fill="#c7d3db"/>')
    # 메뉴판
    b.append(rect(600, 90, 520, 90, "#2f3e46", 'rx="6"'))
    menus = ["오늘의 백반 4,500", "돈까스 5,500", "라면 3,000", "비빔밥 5,000"]
    for i, m in enumerate(menus):
        b.append(f'<text x="{630 + (i % 2) * 250}" y="{125 + (i // 2) * 36}" font-family="sans-serif" '
                 f'font-size="22" fill="#f6efd8">{m}</text>')
    # 펜던트 조명
    for x in (200, 520, 840, 1160):
        b.append(f'<path d="M{x} 0 V70" stroke="#555" stroke-width="2"/>')
        b.append(f'<path d="M{x - 34} 100 Q{x} 50 {x + 34} 100Z" fill="#2f3e46"/>')
        b.append(f'<ellipse cx="{x}" cy="104" rx="60" ry="20" fill="#fff6d0" opacity=".6" filter="url(#soft)"/>')
    # 바닥
    b.append('<path d="M0 390 H1280 V720 H0Z" fill="url(#floor)"/>')
    for i in range(1, 9):
        y = 390 + i * i * 4.6
        b.append(f'<path d="M0 {y:.0f} H1280" stroke="#9d9282" stroke-width="1" opacity=".5"/>')
    # 테이블 & 의자
    def table(x, y, s):
        out = [f'<g transform="translate({x},{y}) scale({s})">',
               '<rect x="-30" y="-60" width="60" height="64" rx="8" fill="#e07a5f"/>',
               '<rect x="170" y="-60" width="60" height="64" rx="8" fill="#e07a5f"/>',
               '<rect x="-10" y="0" width="220" height="16" rx="3" fill="#f2efe8"/>',
               '<rect x="20" y="16" width="10" height="70" fill="#7d7d7d"/><rect x="170" y="16" width="10" height="70" fill="#7d7d7d"/>']
        for tx in (30, 120):
            out.append(f'<rect x="{tx}" y="-8" width="56" height="10" rx="2" fill="#9db1bf"/>')
            out.append(f'<circle cx="{tx + 14}" cy="-11" r="7" fill="{r.choice(["#f2c14e", "#e07a5f", "#81b29a"])}"/>')
        out.append('</g>')
        return "".join(out)
    for x, y, s in [(80, 470, .9), (420, 470, .9), (760, 470, .9), (1090, 470, .9),
                    (-60, 600, 1.4), (500, 610, 1.4), (1050, 610, 1.4)]:
        b.append(table(x, y, s))
    return svg("\n".join(b), defs)


# ---------------------------------------------------------------- 도서관
def library():
    r = random.Random(11)
    defs = COMMON_DEFS + """
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#e9dfcd"/><stop offset="1" stop-color="#d6c7ad"/>
</linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#7d5a3c"/><stop offset="1" stop-color="#523a26"/>
</linearGradient>
<linearGradient id="table" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#b98a58"/><stop offset="1" stop-color="#946a3e"/>
</linearGradient>
<radialGradient id="lamp" cx=".5" cy=".5" r=".5">
  <stop offset="0" stop-color="#fff2c4" stop-opacity=".9"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/>
</radialGradient>
"""
    b = [rect(0, 0, W, H, "url(#wall)")]
    colors = ["#8c2f39", "#2f5d7c", "#3b6e4f", "#c9a227", "#6a4c93", "#b5654a", "#2d3a4a", "#d8cfc0", "#4f7c7a"]
    # 책장
    def shelf(x0, y0, w, h, rows):
        out = [rect(x0, y0, w, h, "#6b4a30"), rect(x0 + 8, y0 + 8, w - 16, h - 16, "#4a3220")]
        rh = (h - 16) / rows
        for ri in range(rows):
            y = y0 + 8 + ri * rh
            x = x0 + 12
            while x < x0 + w - 24:
                bw = r.uniform(8, 18)
                bh = r.uniform(rh * .62, rh * .88)
                out.append(rect(x, y + rh - 6 - bh, bw, bh, r.choice(colors)))
                if r.random() < .3:
                    out.append(rect(x + 2, y + rh - 6 - bh * .7, bw - 4, 3, "#e8d9a8", 'opacity=".7"'))
                x += bw + r.uniform(0, 2)
                if r.random() < .05:
                    x += 20
            out.append(rect(x0 + 8, y + rh - 6, w - 16, 7, "#7a5536"))
        return "".join(out)
    b.append(shelf(-10, 40, 420, 420, 5))
    b.append(shelf(870, 40, 420, 420, 5))
    # 가운데 아치 창
    b.append('<path d="M460 440 V170 Q640 20 820 170 V440Z" fill="#cfe6f4"/>')
    b.append('<path d="M640 50 V440 M460 260 H820" stroke="#efe6d6" stroke-width="10"/>')
    b.append('<path d="M470 400 q50 -60 100 -20 t110 -30 t130 20 V440 H470Z" fill="#94bf80" opacity=".7"/>')
    b.append('<path d="M460 440 V170 Q640 20 820 170 V440Z" fill="none" stroke="#6b4a30" stroke-width="12"/>')
    b.append('<path d="M480 120 L800 120 L980 720 L300 720Z" fill="#fffbe6" opacity=".18"/>')
    # 바닥
    b.append('<path d="M0 460 H1280 V720 H0Z" fill="url(#floor)"/>')
    for x in range(-600, 1900, 90):
        b.append(f'<path d="M640 460 L{x} 720" stroke="#3e2b1c" stroke-width="1" opacity=".35"/>')
    # 열람 테이블 + 스탠드
    b.append(rect(140, 560, 1000, 30, "url(#table)", 'rx="4"'))
    b.append(rect(140, 590, 1000, 14, "#6f4e2c"))
    for x in (200, 1060):
        b.append(rect(x, 604, 18, 120, "#5a3f24"))
    for x in (380, 900):
        b.append(f'<circle cx="{x}" cy="520" r="130" fill="url(#lamp)"/>')
        b.append(f'<path d="M{x} 558 V505" stroke="#2f4f3a" stroke-width="5"/>')
        b.append(f'<path d="M{x - 38} 512 Q{x} 470 {x + 38} 512Z" fill="#2f6b4a"/>')
        b.append(rect(x - 20, 552, 40, 8, "#2f4f3a"))
    # 책 더미 / 노트북
    b.append(rect(560, 530, 120, 30, "#3b4652", 'rx="3"'))
    b.append(rect(566, 470, 108, 62, "#59677a", 'rx="3"'))
    b.append(rect(572, 476, 96, 50, "#cfe0ee"))
    for i, c in enumerate(["#8c2f39", "#2f5d7c", "#c9a227"]):
        b.append(rect(760 + i * 3, 544 - i * 12, 80, 12, c, 'rx="2"'))
    return svg("\n".join(b), defs)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in [("campus", campus), ("lecture", lecture), ("cafeteria", cafeteria), ("library", library)]:
        (OUT / f"{name}.svg").write_text(fn(), encoding="utf-8")
        print("wrote", OUT / f"{name}.svg")
