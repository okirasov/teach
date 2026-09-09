"""Иконки Teach из знака бренда (DESIGN.md §1) без внешних зависимостей: PNG через zlib, суперсэмплинг 4×."""
import struct, zlib, math

def png(path, w, h, px, alpha=True):
    # App Store требует иконку без альфа-канала: для непрозрачных пишем RGB (color type 2).
    n = 4 if alpha else 3
    raw = b''.join(b'\x00' + bytes(v for p in row for v in p[:n]) for row in px)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6 if alpha else 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def hexrgb(s): return tuple(int(s[i:i+2], 16) for i in (1, 3, 5))

# Знак в координатах viewBox 0 0 96 96
BAR = (16, 14, 9, 64, 4.5)
DOTS = [(20.5, 30, 5), (37, 30, 5), (56, 30, 5)]
RING = (79, 30, 5.5, 3)
BBOX = (16, 14, 81.5, 78)

def in_bar(x, y):
    bx, by, bw, bh, r = BAR
    if not (bx <= x <= bx + bw and by <= y <= by + bh): return False
    cx = min(max(x, bx + r), bx + bw - r); cy = min(max(y, by + r), by + bh - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r

def sample(x, y):
    if in_bar(x, y): return 'mark'
    for cx, cy, r in DOTS:
        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: return 'mark'
    cx, cy, r, s = RING
    d = math.hypot(x - cx, y - cy)
    if r - s / 2 <= d <= r + s / 2: return 'amber'
    return None

def render(size, bg, mark, amber, mark_h_ratio, out):
    ss = 4
    x0, y0, x1, y1 = BBOX
    scale = size * mark_h_ratio / (y1 - y0)
    ox = size / 2 - (x0 + x1) / 2 * scale
    oy = size / 2 - (y0 + y1) / 2 * scale
    rows = []
    for py in range(size):
        row = []
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    vx = (px + (sx + .5) / ss - ox) / scale
                    vy = (py + (sy + .5) / ss - oy) / scale
                    k = sample(vx, vy)
                    c = mark if k == 'mark' else amber if k == 'amber' else bg
                    if c is None: continue
                    acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2]; acc[3] += 255
            a = acc[3] // (ss * ss)
            if a == 0: row.append((0, 0, 0, 0))
            else:
                cov = acc[3] / 255
                row.append((round(acc[0] / cov), round(acc[1] / cov), round(acc[2] / cov), a))
        rows.append(row)
    png(out, size, size, rows, alpha=bg is None)
    print('wrote', out)

pine, cream, amber = hexrgb('#1C4634'), hexrgb('#FAF6EE'), hexrgb('#DFA032')
render(1024, pine, cream, amber, 0.56, 'assets/icon.png')
render(1024, None, cream, amber, 0.40, 'assets/android-icon-foreground.png')
render(1024, pine, None, None, 0.56, 'assets/android-icon-background.png')
render(1024, None, (255, 255, 255), (255, 255, 255), 0.40, 'assets/android-icon-monochrome.png')
render(512, None, pine, amber, 0.80, 'assets/splash-icon.png')
render(64, pine, cream, amber, 0.56, 'assets/favicon.png')
