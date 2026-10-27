"""앱 아이콘 생성: 로고의 네 가지 블록 색을 2×2 도트 블록으로 그립니다. (python3 tools/make_icons.py)"""
import pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parent.parent / 'icons'
OUT.mkdir(exist_ok=True)
BG = (22, 28, 58)
COLORS = [(59, 200, 245), (255, 210, 63), (166, 107, 255), (61, 220, 132)]


def block(d, x, y, s, c):
    b = max(2, s // 8)
    d.rectangle([x, y, x + s - 1, y + s - 1], fill=c)
    light = tuple(min(255, int(v + (255 - v) * 0.4)) for v in c)
    dark = tuple(int(v * 0.68) for v in c)
    d.rectangle([x, y, x + s - 1, y + b - 1], fill=light)
    d.rectangle([x, y, x + b - 1, y + s - 1], fill=light)
    d.rectangle([x, y + s - b, x + s - 1, y + s - 1], fill=dark)
    d.rectangle([x + s - b, y, x + s - 1, y + s - 1], fill=dark)


def icon(size, art=0.62, rounded=True):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, size - 1, size - 1], fill=BG)
    gap = max(2, int(size * 0.035))
    s = int((size * art - gap) / 2)
    ox = (size - (2 * s + gap)) // 2
    oy = ox
    for i, c in enumerate(COLORS):
        r, col = divmod(i, 2)
        block(d, ox + col * (s + gap), oy + r * (s + gap) - (gap if col else 0), s, c)
    return img


icon(192).save(OUT / 'icon-192.png')
icon(512).save(OUT / 'icon-512.png')
icon(512, art=0.48, rounded=False).save(OUT / 'icon-maskable-512.png')   # 안드로이드 원형/물방울 마스크용
icon(180, rounded=False).save(OUT / 'apple-touch-icon.png')              # iOS는 스스로 모서리를 둥글게 깎음
icon(64).save(OUT / 'favicon-64.png')
print('icons ->', OUT)
