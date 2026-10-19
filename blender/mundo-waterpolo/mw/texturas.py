# -*- coding: utf-8 -*-
"""Texturas procedurales TILEABLES generadas con numpy.

Todas las texturas son periódicas (se repiten sin costuras): el ruido se genera
en el dominio de frecuencia (FFT), que es periódico por definición, y los
patrones (ladrillos, baldosas, adoquines...) usan coordenadas con módulo.

Convención: arrays (alto, ancho, ...) con la fila 0 ABAJO (igual que
Blender), u = columna / ancho, v = fila / alto.

Cada generador devuelve un dict con:
  albedo  (h, w, 3) en sRGB 0..1
  rough   (h, w)    0..1
  normal  (h, w, 3) normal map OpenGL (+Y) 0..1   (opcional; se calcula de 'height')
"""
import numpy as np


# ---------------------------------------------------------------------------
# utilidades
# ---------------------------------------------------------------------------
def col(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])


def uv(n, m=None):
    m = m or n
    u = (np.arange(m) + 0.5) / m
    v = (np.arange(n) + 0.5) / n
    return np.meshgrid(u, v)  # u varía en columnas, v en filas


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0 + 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def norm01(x, contrast=0.18):
    """Normaliza a media 0.5 con desviación 'contrast'."""
    x = (x - x.mean()) / (x.std() + 1e-9)
    return np.clip(0.5 + x * contrast, 0.0, 1.0)


def fbm(n, beta=2.0, seed=0, lo=1.0, hi=None, sx=1.0, sy=1.0, m=None):
    """Ruido espectral periódico 1/f^beta. sx/sy estiran la frecuencia
    (sx > 1 => granulado más alargado a lo largo de v...)."""
    m = m or n
    r = np.random.default_rng(seed)
    w = r.standard_normal((n, m))
    F = np.fft.fft2(w)
    ky = np.fft.fftfreq(n) * n
    kx = np.fft.fftfreq(m) * m
    KX, KY = np.meshgrid(kx, ky)
    kk = np.sqrt((KX * sx) ** 2 + (KY * sy) ** 2)
    kk[0, 0] = 1.0
    amp = kk ** (-beta / 2.0)
    amp[kk < lo] = 0.0
    if hi is not None:
        amp[kk > hi] = 0.0
    out = np.real(np.fft.ifft2(F * amp))
    return norm01(out, 0.2)


def voronoi(n, G, seed=0, jitter=0.85):
    """Voronoi periódico en una rejilla GxG. Devuelve F1, F2 (en unidades de
    celda) e id de celda."""
    r = np.random.default_rng(seed)
    off = 0.5 + (r.random((G, G, 2)) - 0.5) * jitter
    U, V = uv(n)
    x = U * G
    y = V * G
    cx = np.floor(x).astype(int)
    cy = np.floor(y).astype(int)
    F1 = np.full(x.shape, 9.0)
    F2 = np.full(x.shape, 9.0)
    ID = np.zeros(x.shape, dtype=int)
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            gx = cx + di
            gy = cy + dj
            px = gx + off[gy % G, gx % G, 0]
            py = gy + off[gy % G, gx % G, 1]
            d = np.sqrt((px - x) ** 2 + (py - y) ** 2)
            cid = (gy % G) * G + (gx % G)
            closer = d < F1
            F2 = np.where(closer, F1, np.minimum(F2, d))
            ID = np.where(closer, cid, ID)
            F1 = np.where(closer, d, F1)
    return F1, F2, ID


def tiles(n, rows, cols, stagger=0.5, seed=0, m=None, jitter=0.0):
    """Distribución de piezas rectangulares (ladrillos, baldosas, sillares).
    Devuelve id, distancia al borde en u y en v (en unidades UV), y lx, ly locales."""
    m = m or n
    U, V = uv(n, m)
    row = np.floor(V * rows).astype(int)
    r = np.random.default_rng(seed)
    rshift = (row % 2) * stagger
    if jitter:
        rshift = rshift + r.random(rows)[row % rows] * jitter
    xx = U * cols + rshift
    colx = np.floor(xx).astype(int) % cols
    lx = xx - np.floor(xx)
    ly = V * rows - row
    ident = (row % rows) * cols + colx
    du = np.minimum(lx, 1 - lx) / cols
    dv = np.minimum(ly, 1 - ly) / rows
    return ident, du, dv, lx, ly


def per_id(ident, count, seed):
    r = np.random.default_rng(seed)
    return r.random(count)[ident % count]


def height_to_normal(h, strength):
    """h: altura 0..1 ; strength ~ cuánto relieve (píxeles de pendiente)."""
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(h)
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / L, ny / L, nz / L], axis=-1) * 0.5 + 0.5


def mix(a, b, t):
    t = t[..., None] if np.ndim(t) == 2 else t
    return a * (1 - t) + b * t


def shade(base, factor):
    """multiplica un color/array de color por un factor 2D."""
    return np.clip(base * factor[..., None], 0, 1)


def blank(n, c, m=None):
    m = m or n
    return np.ones((n, m, 3)) * c


# ---------------------------------------------------------------------------
# GENERADORES
# ---------------------------------------------------------------------------
def tex_asfalto(n):
    g = fbm(n, 1.6, 11)
    f1, f2, ide = voronoi(n, 96, 12, 1.0)
    stone = smooth(0.42, 0.18, f1)                      # áridos
    sval = per_id(ide, 96 * 96, 13)
    mac = fbm(n, 3.0, 14)                               # manchas grandes
    lum = 0.085 + 0.05 * g + stone * (sval * 0.09) - (mac - 0.5) * 0.04
    alb = np.stack([lum, lum * 1.0, lum * 1.03], -1)
    h = stone * 0.6 + g * 0.4
    return dict(albedo=alb, rough=0.86 + 0.08 * g - stone * 0.1, height=h, bump=6)


def tex_adoquin(n):
    # adoquines de granito (sampietrini/setts) en hileras desplazadas
    ide, du, dv, lx, ly = tiles(n, 16, 8, 0.5, 21, jitter=0.3)
    d = np.minimum(du, dv)
    g = fbm(n, 1.4, 22)
    gap = 0.004 + (g - 0.5) * 0.002
    pillow = smooth(gap, gap + 0.016, d) * (0.85 + 0.15 * fbm(n, 2.2, 23))
    rv = per_id(ide, 128, 24)
    rv2 = per_id(ide, 128, 25)
    base = mix(col('6d6a66'), col('8a8073'), rv[..., None] * np.ones(3))
    base = mix(base, col('5a5f63'), (rv2 > 0.7) * 0.6)
    speck = fbm(n, 0.6, 26)
    stone = shade(base, 0.8 + 0.35 * speck)
    sand = shade(np.ones(3) * col('4a443c'), 0.8 + 0.3 * g)
    alb = mix(sand, stone, smooth(0.0, 0.25, pillow))
    alb = shade(alb, 0.9 + 0.2 * fbm(n, 3.0, 27))
    rough = 0.55 + 0.35 * (1 - pillow) + (speck - 0.5) * 0.1
    return dict(albedo=alb, rough=rough, height=pillow, bump=10)


def tex_acera(n):
    ide, du, dv, lx, ly = tiles(n, 4, 4, 0.0, 31)
    d = np.minimum(du, dv)
    g = fbm(n, 1.2, 32)
    edge = smooth(0.002, 0.006, d)
    rv = per_id(ide, 16, 33)
    base = col('a39d92') * (0.92 + 0.12 * rv[..., None])
    stains = fbm(n, 3.2, 34)
    alb = shade(np.ones((n, n, 3)) * base, (0.86 + 0.18 * g) * (0.9 + 0.2 * stains))
    alb = mix(col('6b665e') * np.ones(3), alb, edge)
    return dict(albedo=alb, rough=0.8 + 0.1 * g, height=edge * 0.7 + g * 0.3, bump=5)


def tex_piedra(n):
    # sillería de piedra caliza (fachadas haussmannianas), tintable
    ide, du, dv, lx, ly = tiles(n, 8, 4, 0.5, 41, jitter=0.15)
    d = np.minimum(du, dv)
    g = fbm(n, 1.5, 42)
    big = fbm(n, 3.0, 43)
    joint = smooth(0.0015, 0.004, d)
    rv = per_id(ide, 32, 44)
    base = col('e6dccb') * (0.93 + 0.08 * rv[..., None])
    alb = shade(np.ones((n, n, 3)) * base, (0.9 + 0.12 * g) * (0.92 + 0.1 * big))
    # ensuciado vertical (escorrentía)
    streak = fbm(n, 2.4, 45, sx=0.4, sy=6.0)
    alb = shade(alb, 1.0 - np.clip(streak - 0.55, 0, 1) * 0.5)
    alb = mix(col('b9ae9c') * np.ones(3), alb, joint)
    return dict(albedo=alb, rough=0.82 + 0.1 * g, height=joint * 0.6 + g * 0.4, bump=4)


def tex_estuco(n):
    g = fbm(n, 1.2, 51)
    b = fbm(n, 2.6, 52)
    streak = fbm(n, 2.4, 53, sx=0.35, sy=5.0)
    lum = (0.92 + 0.06 * (g - 0.5)) * (0.95 + 0.07 * b) - np.clip(streak - 0.6, 0, 1) * 0.35
    alb = np.stack([lum, lum * 0.985, lum * 0.96], -1)
    return dict(albedo=np.clip(alb, 0, 1), rough=0.88 + 0.05 * g, height=g, bump=2.5)


def tex_ladrillo(n):
    ide, du, dv, lx, ly = tiles(n, 12, 4, 0.5, 61)
    d_u = du * 4 / 0.225  # pasar a "metros" relativos
    g = fbm(n, 1.3, 62)
    mortar = smooth(0.004, 0.009, np.minimum(du * 0.9 / 1.0, dv * 0.9 / 1.0) / 0.9 * 0.9)
    rv = per_id(ide, 48, 63)
    rv2 = per_id(ide, 48, 64)
    base = mix(col('8f4a32') * np.ones(3), col('a8613f') * np.ones(3), rv[..., None])
    base = mix(base, col('5e3426') * np.ones(3), (rv2 > 0.85) * 0.7)
    alb = shade(base, 0.85 + 0.25 * g)
    alb = mix(col('b8ad9c') * np.ones(3) * (0.85 + 0.15 * g[..., None]), alb, mortar)
    return dict(albedo=alb, rough=0.85 + 0.08 * g, height=mortar * 0.8 + g * 0.2, bump=6)


def tex_teja(n):
    U, V = uv(n)
    cols, rows = 6, 8
    row = np.floor(V * rows)
    shift = (row % 2) * 0.5
    x = (U * cols + shift) % 1.0
    y = V * rows - row
    barrel = np.sin(np.pi * x)                       # teja curva
    overlap = smooth(0.0, 0.25, y) * (1 - 0.35 * smooth(0.6, 1.0, y))
    h = barrel * 0.7 * overlap + 0.3 * overlap
    g = fbm(n, 1.6, 71)
    ide = (row.astype(int) % rows) * cols + np.floor(U * cols + shift).astype(int) % cols
    rv = per_id(ide, 48, 72)
    base = mix(col('a4502c') * np.ones(3), col('c06a3c') * np.ones(3), rv[..., None])
    moss = fbm(n, 2.8, 73)
    alb = shade(base, (0.55 + 0.45 * overlap) * (0.85 + 0.25 * g))
    alb = mix(alb, col('5b5a3a') * np.ones(3), np.clip(moss - 0.62, 0, 1) * 1.5)
    return dict(albedo=alb, rough=0.75 + 0.1 * g, height=h, bump=14)


def tex_zinc(n):
    U, V = uv(n)
    seam = smooth(0.012, 0.0, np.abs(((U * 4) % 1.0) - 0.5) - 0.48 + 0.012)
    seam = np.exp(-((((U * 4) % 1.0) - 0.5) ** 2) / 0.0004)
    g = fbm(n, 1.8, 81)
    pat = fbm(n, 2.8, 82)
    lum = 0.42 + 0.06 * g - 0.08 * pat
    alb = np.stack([lum * 0.92, lum * 0.97, lum * 1.03], -1)
    return dict(albedo=alb, rough=0.42 + 0.15 * pat, height=seam * 0.9 + g * 0.1, bump=12, metal=0.75)


def tex_madera(n):
    # tablones de roble (tarima / bancos / plataformas)
    ide, du, dv, lx, ly = tiles(n, 8, 1, 0.0, 91)
    # 8 tablas en v; cada tabla partida a lo largo con juntas desplazadas
    U, V = uv(n)
    row = np.floor(V * 8).astype(int)
    r = np.random.default_rng(92)
    shifts = r.random(8)
    xx = (U + shifts[row % 8])
    seg = np.floor(xx * 2).astype(int)
    lx2 = (xx * 2) % 1.0
    endj = smooth(0.0, 0.004, np.minimum(lx2, 1 - lx2) / 2)
    side = smooth(0.0, 0.003, dv)
    grain = fbm(n, 1.6, 93, sx=1.0, sy=0.08)
    rings = 0.5 + 0.5 * np.sin((V * 8 * 6 + grain * 6 + row * 1.7) * np.pi * 2)
    pid = row * 2 + seg
    rv = per_id(pid, 64, 94)
    base = mix(col('a77a4f') * np.ones(3), col('c49a6c') * np.ones(3), rv[..., None])
    alb = shade(base, (0.82 + 0.18 * rings) * (0.9 + 0.15 * grain))
    joint = side * endj
    alb = shade(alb, 0.55 + 0.45 * joint)
    return dict(albedo=alb, rough=0.55 + 0.15 * grain, height=joint * 0.7 + rings * 0.08, bump=6)


def tex_goma(n):
    # suelo de caucho deportivo negro con granulado EPDM gris (2x2 losetas 1 m)
    ide, du, dv, lx, ly = tiles(n, 2, 2, 0.0, 101)
    d = np.minimum(du, dv)
    seam = smooth(0.0005, 0.0018, d)
    f1, f2, idv = voronoi(n, 220, 102, 1.0)
    fleck = (f1 < 0.22) * (per_id(idv, 220 * 220, 103) > 0.55)
    fc = per_id(idv, 220 * 220, 104)
    g = fbm(n, 0.8, 105)
    lum = 0.035 + 0.015 * g
    alb = np.stack([lum, lum, lum * 1.05], -1)
    flk = mix(col('7b7d80') * np.ones(3), col('4c6b8a') * np.ones(3), (fc > 0.8)[..., None] * 1.0)
    alb = mix(alb, flk * 0.55, fleck * 1.0)
    alb = shade(alb, 0.55 + 0.45 * seam)
    rough = 0.9 - fleck * 0.1
    return dict(albedo=alb, rough=rough, height=seam * 0.5 + g * 0.3 + fleck * 0.2, bump=4)


def tex_cesped_art(n):
    g = fbm(n, 0.3, 111, sx=1.0, sy=0.3)
    b = fbm(n, 2.0, 112)
    lum = 0.6 + 0.4 * g
    alb = np.stack([0.12 * lum, 0.34 * lum, 0.12 * lum], -1) * (0.9 + 0.2 * b[..., None])
    return dict(albedo=alb, rough=0.75 + 0.1 * g, height=g, bump=5)


def tex_ceramica(n):
    ide, du, dv, lx, ly = tiles(n, 8, 8, 0.0, 121)
    d = np.minimum(du, dv)
    grout = smooth(0.0012, 0.0028, d)
    rv = per_id(ide, 64, 122)
    g = fbm(n, 0.9, 123)
    base = np.ones((n, n, 3)) * (0.9 + 0.05 * rv[..., None])
    alb = shade(base, 0.97 + 0.04 * g)
    alb = mix(col('9a9a96') * np.ones(3), alb, grout)
    rough = 0.25 * grout + 0.85 * (1 - grout) + g * 0.08
    return dict(albedo=alb, rough=rough, height=grout * 0.9 + g * 0.1, bump=4)


def tex_porcelanato(n):
    ide, du, dv, lx, ly = tiles(n, 4, 4, 0.0, 131)
    d = np.minimum(du, dv)
    joint = smooth(0.0006, 0.0014, d)
    w = fbm(n, 2.2, 132)
    vein = np.abs(np.sin((fbm(n, 2.0, 133) * 6 + w * 3) * np.pi))
    vein = smooth(0.08, 0.0, vein)
    rv = per_id(ide, 16, 134)
    base = col('d8d6d2') * (0.96 + 0.05 * rv[..., None])
    alb = shade(np.ones((n, n, 3)) * base, 0.96 + 0.05 * w)
    alb = mix(alb, col('9d9a95') * np.ones(3), vein * 0.35)
    alb = mix(col('8a8781') * np.ones(3), alb, joint)
    return dict(albedo=alb, rough=0.12 + 0.6 * (1 - joint) + 0.05 * w, height=joint, bump=3)


def tex_concreto(n):
    g = fbm(n, 1.5, 141)
    b = fbm(n, 3.0, 142)
    f1, f2, idv = voronoi(n, 160, 143, 1.0)
    pores = (f1 < 0.12) * (per_id(idv, 160 * 160, 144) > 0.7)
    ide, du, dv, lx, ly = tiles(n, 2, 1, 0.0, 145)
    panel = smooth(0.0, 0.002, np.minimum(du, dv))
    lum = (0.55 + 0.08 * (g - 0.5)) * (0.92 + 0.12 * b) - pores * 0.15
    lum = lum * (0.8 + 0.2 * panel)
    alb = np.stack([lum, lum * 0.99, lum * 0.97], -1)
    return dict(albedo=alb, rough=0.82 + 0.1 * g, height=g * 0.6 + panel * 0.4 - pores * 0.3, bump=4)


def tex_pintura(n):
    g = fbm(n, 1.0, 151)
    alb = np.ones((n, n, 3)) * (0.92 + 0.05 * g[..., None])
    return dict(albedo=alb, rough=0.38 + 0.1 * g, height=g, bump=1)


def tex_cromo(n):
    g = fbm(n, 0.5, 161, sx=0.02, sy=1.0)
    alb = np.ones((n, n, 3)) * (0.86 + 0.06 * g[..., None])
    return dict(albedo=alb, rough=0.14 + 0.1 * g, height=g, bump=1, metal=1.0)


def tex_moleteado(n):
    U, V = uv(n)
    a = np.abs(np.sin((U + V) * np.pi * 8))
    b = np.abs(np.sin((U - V) * np.pi * 8))
    h = np.minimum(a, b)
    alb = np.ones((n, n, 3)) * (0.62 + 0.15 * h[..., None])
    return dict(albedo=alb, rough=0.35 + 0.25 * (1 - h), height=h, bump=8, metal=1.0)


def tex_vinilo_pad(n):
    f1, f2, idv = voronoi(n, 128, 171, 1.0)
    peb = smooth(0.0, 0.45, f2 - f1)
    g = fbm(n, 1.2, 172)
    alb = np.ones((n, n, 3)) * (0.85 + 0.08 * peb[..., None])
    return dict(albedo=alb, rough=0.45 + 0.15 * (1 - peb) + g * 0.05, height=peb, bump=3)


def tex_moqueta(n):
    ide, du, dv, lx, ly = tiles(n, 2, 2, 0.0, 181)
    U, V = uv(n)
    # losetas de moqueta colocadas a "cuarto de vuelta"
    rot = (ide % 2) == 0
    fib = np.where(rot, fbm(n, 0.4, 182, sx=1.0, sy=0.25), fbm(n, 0.4, 183, sx=0.25, sy=1.0))
    seam = smooth(0.0, 0.002, np.minimum(du, dv))
    alb = np.ones((n, n, 3)) * (0.75 + 0.25 * fib[..., None]) * (0.85 + 0.15 * seam[..., None])
    return dict(albedo=alb, rough=0.95, height=fib, bump=3)


def tex_acustico(n):
    ide, du, dv, lx, ly = tiles(n, 2, 2, 0.0, 191)
    d = np.minimum(du, dv)
    grid = smooth(0.006, 0.0075, d)
    f1, f2, idv = voronoi(n, 180, 192, 1.0)
    fiss = (f1 < 0.18) * 0.12
    g = fbm(n, 1.4, 193)
    lum = 0.9 - fiss + 0.03 * g
    alb = np.stack([lum, lum, lum * 0.99], -1)
    alb = mix(col('dedede') * np.ones(3), alb, grid)
    return dict(albedo=alb, rough=0.9 - (1 - grid) * 0.4, height=grid * 0.8 - fiss, bump=6)


def tex_hojas(n):
    f1, f2, idv = voronoi(n, 40, 201, 1.0)
    leaf = smooth(0.62, 0.15, f1)
    rv = per_id(idv, 1600, 202)
    base = mix(col('2f4a1c') * np.ones(3), col('5c7a2e') * np.ones(3), rv[..., None])
    g = fbm(n, 1.6, 203)
    alb = shade(base, (0.35 + 0.65 * leaf) * (0.85 + 0.3 * g))
    return dict(albedo=alb, rough=0.6 + 0.2 * (1 - leaf), height=leaf, bump=8)


def tex_corteza(n):
    g = fbm(n, 1.6, 211, sx=0.12, sy=1.0)
    b = fbm(n, 2.0, 212)
    ridge = np.abs(np.sin(g * np.pi * 6))
    lum = 0.25 + 0.2 * ridge + 0.05 * b
    alb = np.stack([lum * 1.0, lum * 0.92, lum * 0.82], -1)
    return dict(albedo=alb, rough=0.92, height=ridge, bump=10)


def tex_rack(n):
    # acero pintado negro mate con perforaciones Westside (paso 5 cm)
    U, V = uv(n)
    # tile = 0.075 m x 0.05 m ; agujero Ø 0.022 centrado en la esquina (0,0)
    du = np.minimum(U, 1 - U) * 0.075
    dv = np.minimum(V, 1 - V) * 0.05
    d = np.sqrt(du ** 2 + dv ** 2)
    hole = smooth(0.0115, 0.0100, d)
    g = fbm(n, 0.8, 221)
    lum = 0.06 + 0.02 * g
    alb = np.ones((n, n, 3)) * lum[..., None]
    alb = alb * (1 - hole[..., None] * 0.9)
    return dict(albedo=alb, rough=0.55 + 0.4 * hole, height=1 - hole, bump=10)


def tex_pelota(n):
    # balón de waterpolo amarillo con franjas azul marino y grip
    U, V = uv(n)
    band = np.sin(2 * np.pi * (3 * U + 0.35 * np.sin(2 * np.pi * V * 2)))
    stripe = smooth(0.55, 0.7, band)
    alb = mix(col('f2c618') * np.ones(3), col('1b2e6b') * np.ones(3), stripe)
    f1, f2, idv = voronoi(n, 160, 231, 0.9)
    grip = smooth(0.5, 0.1, f1)
    alb = shade(alb, 0.88 + 0.12 * grip)
    return dict(albedo=alb, rough=0.55 - grip * 0.1, height=grip, bump=6)


def tex_pizarra(n):
    # pizarra táctica de waterpolo (no tileable): campo 30x20 m visto desde arriba
    m = n * 2
    U, V = uv(n, m)
    alb = np.ones((n, m, 3)) * 0.95
    # marco azul agua
    fx0, fx1, fy0, fy1 = 0.2, 0.8, 0.1, 0.9
    inside = (U > fx0) & (U < fx1) & (V > fy0) & (V < fy1)
    alb[inside] = col('3c8fcf')
    L = 30.0
    def vline(meters, c, w=0.0025):
        x = fx0 + (fx1 - fx0) * meters / L
        msk = (np.abs(U - x) < w) & (V > fy0) & (V < fy1)
        alb[msk] = c
    vline(0, col('ffffff'), 0.003)
    vline(30, col('ffffff'), 0.003)
    vline(2, col('d92b2b'))
    vline(28, col('d92b2b'))
    vline(6, col('f5d000'))
    vline(24, col('f5d000'))
    vline(15, col('ffffff'))
    # porterías
    for gx in (fx0 - 0.012, fx1):
        msk = (U > gx) & (U < gx + 0.012) & (np.abs(V - 0.5) < 0.06)
        alb[msk] = col('ffffff')
    # jugadas dibujadas con rotulador: X (rojo) y O (negro)
    r = np.random.default_rng(241)
    aspect = m / n
    for k in range(7):
        cx, cy = r.uniform(0.3, 0.7), r.uniform(0.2, 0.8)
        d = np.sqrt(((U - cx) * aspect) ** 2 + (V - cy) ** 2)
        ring = np.abs(d - 0.03) < 0.004
        alb[ring] = col('111111')
    for k in range(6):
        cx, cy = r.uniform(0.3, 0.7), r.uniform(0.2, 0.8)
        a = np.abs((U - cx) * aspect - (V - cy)) < 0.004
        b = np.abs((U - cx) * aspect + (V - cy)) < 0.004
        box = (np.abs((U - cx) * aspect) < 0.025) & (np.abs(V - cy) < 0.025)
        alb[(a | b) & box] = col('c41e1e')
    # flechas (líneas curvas)
    for k in range(5):
        x0, y0 = r.uniform(0.3, 0.6), r.uniform(0.2, 0.8)
        t = np.linspace(0, 1, 400)
        px = x0 + t * r.uniform(0.05, 0.15)
        py = y0 + np.sin(t * np.pi) * r.uniform(-0.12, 0.12)
        for i in range(0, 400, 2):
            msk = (np.abs((U - px[i]) * aspect) < 0.003) & (np.abs(V - py[i]) < 0.003)
            alb[msk] = col('1d3fbf')
    # texto/garabatos en la zona blanca izquierda (líneas de "notas")
    for k in range(9):
        y = 0.82 - k * 0.075
        x1 = 0.03 + r.uniform(0.08, 0.14)
        msk = (U > 0.03) & (U < x1) & (np.abs(V - y + 0.006 * np.sin(U * 300)) < 0.0035)
        alb[msk] = col('222222') if k % 3 else col('c41e1e')
    return dict(albedo=alb, rough=np.ones((n, m)) * 0.15, height=np.zeros((n, m)), bump=0)


def tex_cesped(n):
    g = fbm(n, 0.6, 251)
    b = fbm(n, 2.6, 252)
    c = fbm(n, 1.4, 253)
    base = mix(col('3d5e22') * np.ones(3), col('6b7b34') * np.ones(3), b)
    alb = shade(base, 0.7 + 0.5 * g)
    alb = mix(alb, col('6e5a3a') * np.ones(3), np.clip(c - 0.7, 0, 1) * 2)
    return dict(albedo=alb, rough=0.9, height=g, bump=6)


def tex_toldo(n):
    U, V = uv(n)
    stripe = ((U * 6) % 1.0) < 0.5
    g = fbm(n, 0.6, 261)
    lum = np.where(stripe, 0.95, 0.42) * (0.95 + 0.06 * g)
    alb = np.ones((n, n, 3)) * lum[..., None]
    return dict(albedo=alb, rough=0.9, height=g, bump=1.5)


def tex_vinilo_piso(n):
    g = fbm(n, 0.7, 271)
    b = fbm(n, 2.4, 272)
    alb = np.ones((n, n, 3)) * col('b7c2c6') * (0.93 + 0.07 * g[..., None]) * (0.96 + 0.06 * b[..., None])
    return dict(albedo=alb, rough=0.35 + 0.1 * g, height=g, bump=1)


def tex_tela(n):
    U, V = uv(n)
    w = 0.5 + 0.25 * np.sin(U * np.pi * 2 * 64) + 0.25 * np.sin(V * np.pi * 2 * 64)
    g = fbm(n, 1.0, 281)
    alb = np.ones((n, n, 3)) * (0.8 + 0.12 * w[..., None] + 0.06 * g[..., None])
    return dict(albedo=np.clip(alb, 0, 1), rough=0.95, height=w, bump=3)


def tex_panel(n):
    # paneles de fibrocemento 1.2 x 0.6 con juntas (fachada del centro deportivo)
    ide, du, dv, lx, ly = tiles(n, 4, 2, 0.0, 291)
    d = np.minimum(du, dv)
    joint = smooth(0.0015, 0.003, d)
    rv = per_id(ide, 8, 292)
    g = fbm(n, 1.3, 293)
    alb = np.ones((n, n, 3)) * (0.88 + 0.06 * rv[..., None] + 0.04 * g[..., None])
    alb = alb * (0.35 + 0.65 * joint[..., None])
    return dict(albedo=alb, rough=0.7 + 0.1 * g, height=joint, bump=4)


def tex_chapa(n):
    U, V = uv(n)
    h = 0.5 + 0.5 * np.sin(U * np.pi * 2 * 10)
    g = fbm(n, 2.0, 301)
    alb = np.ones((n, n, 3)) * (0.85 + 0.08 * h[..., None]) * (0.95 + 0.06 * g[..., None])
    return dict(albedo=alb, rough=0.4 + 0.12 * g, height=h, bump=12, metal=0.6)


def tex_granito(n):
    f1, f2, idv = voronoi(n, 200, 311, 1.0)
    rv = per_id(idv, 200 * 200, 312)
    g = fbm(n, 1.4, 313)
    lum = 0.5 + (rv - 0.5) * 0.35 + 0.05 * g
    alb = np.stack([lum, lum * 0.98, lum * 0.97], -1)
    return dict(albedo=alb, rough=0.6 + 0.1 * g, height=g, bump=2)


GENERADORES = {
    'asfalto': (tex_asfalto, 1024),
    'adoquin': (tex_adoquin, 1024),
    'acera': (tex_acera, 1024),
    'piedra': (tex_piedra, 1024),
    'estuco': (tex_estuco, 512),
    'ladrillo': (tex_ladrillo, 1024),
    'teja': (tex_teja, 512),
    'zinc': (tex_zinc, 512),
    'madera': (tex_madera, 1024),
    'goma': (tex_goma, 1024),
    'cesped_art': (tex_cesped_art, 512),
    'ceramica': (tex_ceramica, 512),
    'porcelanato': (tex_porcelanato, 1024),
    'concreto': (tex_concreto, 1024),
    'pintura': (tex_pintura, 256),
    'cromo': (tex_cromo, 256),
    'moleteado': (tex_moleteado, 256),
    'vinilo_pad': (tex_vinilo_pad, 256),
    'moqueta': (tex_moqueta, 512),
    'acustico': (tex_acustico, 512),
    'hojas': (tex_hojas, 512),
    'corteza': (tex_corteza, 512),
    'rack': (tex_rack, 256),
    'pelota': (tex_pelota, 512),
    'pizarra': (tex_pizarra, 512),
    'cesped': (tex_cesped, 1024),
    'toldo': (tex_toldo, 256),
    'vinilo_piso': (tex_vinilo_piso, 512),
    'tela': (tex_tela, 256),
    'panel': (tex_panel, 512),
    'chapa': (tex_chapa, 512),
    'granito': (tex_granito, 512),
}


def generar(nombre, escala=1.0):
    fn, n = GENERADORES[nombre]
    n = max(64, int(n * escala))
    d = fn(n)
    if 'normal' not in d:
        d['normal'] = height_to_normal(d['height'], d.get('bump', 4) * n / 512.0)
    d['albedo'] = np.clip(d['albedo'], 0, 1)
    d['rough'] = np.clip(np.broadcast_to(np.asarray(d['rough'], float), d['albedo'].shape[:2]), 0.02, 1)
    return d
