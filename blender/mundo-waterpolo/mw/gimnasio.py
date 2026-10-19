# -*- coding: utf-8 -*-
"""GIMNASIO de alto rendimiento (edificio independiente).

Distribución inspirada en salas de fuerza de centros de alto rendimiento
(dos filas de racks enfrentadas, cada rack con su plataforma integrada, barra
olímpica y discos por estación, pasillo central con visión del entrenador,
zona de acondicionamiento, mancuernas, césped para trineo, funcional).

Sistema local del gimnasio: origen en la esquina interior SO, x hacia el este
(0..21.4), y hacia el norte (0..21.4), z = cota del suelo.
"""
import math
from .geo import T, Rz, Rx, Ry, Sc, TAU, align_z
from . import arq

GX, GY = -27.7, -45.7
GW, GL = 21.4, 21.4
FZ = 0.16
GM = T(GX, GY, FZ)

# colores de discos de competición (sRGB)
COL = {25: (0.78, 0.07, 0.06), 20: (0.05, 0.22, 0.65), 15: (0.95, 0.74, 0.05), 10: (0.1, 0.5, 0.18),
       5: (0.93, 0.93, 0.93), 2.5: (0.78, 0.07, 0.06), 1.25: (0.85, 0.85, 0.85)}
GROSOR = {25: 0.064, 20: 0.054, 15: 0.044, 10: 0.034, 5: 0.026, 2.5: 0.019, 1.25: 0.015}
RADIO = {25: 0.225, 20: 0.225, 15: 0.225, 10: 0.225, 5: 0.163, 2.5: 0.105, 1.25: 0.08}
KB_COL = {8: (0.9, 0.45, 0.6), 12: (0.1, 0.35, 0.75), 16: (0.95, 0.75, 0.05), 20: (0.45, 0.2, 0.6),
          24: (0.1, 0.55, 0.2), 28: (0.95, 0.45, 0.05), 32: (0.78, 0.07, 0.06)}


# ---------------------------------------------------------------------------
# PIEZAS
# ---------------------------------------------------------------------------
def disco(b, M, kg, seg=28):
    """Disco bumper con eje en z local, centrado en el origen."""
    t = GROSOR[kg]
    R = RADIO[kg]
    h = t / 2
    r0 = 0.068
    rec = 0.006 if R > 0.2 else 0.003
    prof = [(r0, -h + rec), (R - 0.025, -h + rec), (R - 0.01, -h), (R, -h + 0.008),
            (R, h - 0.008), (R - 0.01, h), (R - 0.025, h - rec), (r0, h - rec)]
    b.lathe('goma_bumper', prof, seg, M, closed=True, cap0=False, cap1=False, tint=COL[kg])
    b.lathe('cromo', [(0.0255, -h + rec - 0.002), (r0 + 0.001, -h + rec - 0.002), (r0 + 0.001, h - rec + 0.002),
                      (0.0255, h - rec + 0.002)], 20, M, closed=True, cap0=False, cap1=False)
    return t


def barra(b, M, carga=(), seg=14):
    """Barra olímpica 20 kg (2.2 m) con eje en x local, centrada. carga = discos por lado (de dentro a fuera)."""
    Mz = M @ Ry(math.pi / 2)
    b.cyl('moleteado', 0.014, -0.655, 0.655, seg, Mz)
    for s in (-1, 1):
        b.lathe('cromo', [(0.0, s * 0.655), (0.035, s * 0.655), (0.035, s * 0.695), (0.0, s * 0.695)][::s], seg, Mz)
        b.cyl('cromo', 0.025, min(s * 0.695, s * 1.1), max(s * 0.695, s * 1.1), seg, Mz)
        z = 0.70
        for kg in carga:
            t = GROSOR[kg]
            disco(b, Mz @ T(0, 0, s * (z + t / 2)), kg)
            z += t + 0.002
        if carga:
            b.cyl('plastico_negro', 0.042, min(s * z, s * (z + 0.03)), max(s * z, s * (z + 0.03)), 16, Mz)


def tubo(b, M, x, y, z0, z1, mat='acero_rack', s=0.075):
    b.box(mat, (-s / 2, -s / 2, z0), (s / 2, s / 2, z1), M @ T(x, y, 0))


def plataforma(b, M):
    """Plataforma de halterofilia integrada (madera central + caucho) bajo el rack."""
    b.box('madera_plataforma', (-0.6, -2.4, 0), (0.6, 1.3, 0.05), M, skip=('bottom',))
    b.box('goma_gym', (-1.2, -2.4, 0), (-0.6, 1.3, 0.05), M, skip=('bottom',), tint=(0.8, 0.8, 0.8))
    b.box('goma_gym', (0.6, -2.4, 0), (1.2, 1.3, 0.05), M, skip=('bottom',), tint=(0.8, 0.8, 0.8))
    for x in (-1.2, 1.2):
        b.box('acero_negro', (x - 0.02, -2.42, 0), (x + 0.02, 1.32, 0.052), M)
    b.box('acero_negro', (-1.22, -2.44, 0), (1.22, -2.4, 0.052), M)
    b.box('acero_negro', (-1.22, 1.3, 0), (1.22, 1.34, 0.052), M)


def rack(b, P, M, variante, rnd):
    """Power rack 1.24 x 1.2 x 2.35 m sobre plataforma. Frente en y=0 mirando a -y."""
    z0 = 0.05
    H = 2.35
    for x in (-0.585, 0.585):
        for y in (0.04, 1.16):
            tubo(b, M, x, y, z0, z0 + H)
        b.box('acero_negro', (x - 0.04, -0.15, z0), (x + 0.04, 1.3, z0 + 0.06), M)
    # travesaños
    b.box('acero_negro', (-0.62, 1.12, z0 + 0.06), (0.62, 1.2, z0 + 0.14), M)
    b.box('acero_negro', (-0.62, 1.12, z0 + H - 0.08), (0.62, 1.2, z0 + H), M)
    for x in (-0.585, 0.585):
        b.box('acero_negro', (x - 0.0375, 0.08, z0 + H - 0.08), (x + 0.0375, 1.12, z0 + H), M)
    # placa del club en el travesaño frontal
    b.box('pintura_club', (-0.55, 0.0, z0 + H - 0.2), (0.55, 0.08, z0 + H), M)
    b.text('pintura_blanca', 'WATERPOLO', 0.085, M @ T(0, -0.006, z0 + H - 0.1), extrude=0.003, bold=True)
    # barra de dominadas
    b.cyl_between('moleteado', M @ T(-0.62, -0.06, z0 + H - 0.04).to_translation(),
                  M @ T(0.62, -0.06, z0 + H - 0.04).to_translation(), 0.016, 12)
    for x in (-0.585, 0.585):
        b.box('acero_negro', (x - 0.03, -0.09, z0 + H - 0.07), (x + 0.03, 0.0, z0 + H - 0.01), M)
    # ganchos J
    zj = z0 + 1.42
    for x in (-0.585, 0.585):
        b.box('acero_negro', (x - 0.04, -0.12, zj - 0.06), (x + 0.04, 0.0, zj + 0.08), M)
        b.box('plastico_negro', (x - 0.035, -0.11, zj - 0.005), (x + 0.035, -0.02, zj + 0.005), M)
        b.box('acero_negro', (x - 0.04, -0.13, zj), (x + 0.04, -0.11, zj + 0.07), M)
        # brazos de seguridad
        b.box('acero_negro', (x - 0.035, -0.62, z0 + 0.82), (x + 0.035, 0.0, z0 + 0.9), M)
        b.box('plastico_negro', (x - 0.035, -0.62, z0 + 0.9), (x + 0.035, -0.02, z0 + 0.915), M)
        # pinchos para gomas
        b.cyl('acero_inox', 0.012, z0, z0 + 0.12, 8, M @ T(x * 1.1, -0.12, 0))
    # almacenaje de discos en los postes traseros
    for s in (-1, 1):
        for zh, carga in ((z0 + 0.32, (25, 25, 20, 20)), (z0 + 0.85, (15, 10, 10, 5, 5, 2.5))):
            p0 = M @ T(s * 0.62, 1.16, zh).to_translation()
            p1 = M @ T(s * 0.95, 1.16, zh).to_translation()
            b.cyl_between('cromo', p0, p1, 0.024, 12)
            off = 0.64
            for kg in carga:
                t = GROSOR[kg]
                Mz = M @ T(s * (off + t / 2), 1.16, zh) @ Ry(math.pi / 2)
                disco(b, Mz, kg)
                off += t + 0.003
    # tablet VBT (control de velocidad) en el poste delantero izquierdo
    b.box('acero_negro', (-0.66, -0.25, z0 + 1.6), (-0.64, 0.0, z0 + 1.63), M)
    b.box('plastico_negro', (-0.78, -0.27, z0 + 1.52), (-0.52, -0.25, z0 + 1.72), M)
    P['luz'].box('pantalla', (-0.765, -0.2705, z0 + 1.535), (-0.535, -0.2695, z0 + 1.705), M)
    # barra y variantes de estación
    if variante == 0:
        barra(b, M @ T(0, -0.07, zj + 0.03))
        banco_plano(b, M @ T(0, 0.55, z0) @ Rz(math.pi / 2), largo=1.25)
    elif variante == 1:
        barra(b, M @ T(0, -1.25, z0 + 0.225), (25, 20, 10))
    elif variante == 2:
        barra(b, M @ T(0, -0.07, zj + 0.03), (20, 5))
    else:
        barra(b, M @ T(0, -0.07, zj + 0.03), (15,))
        for k, (w, d, h) in enumerate(((0.6, 0.5, 0.5), (0.6, 0.5, 0.5))):
            b.box('madera_clara', (-0.95 - k * 0.0, -2.2 + k * 0.62, z0), (-0.45, -1.7 + k * 0.62, z0 + 0.45), M)


def banco_plano(b, M, largo=1.2):
    b.box('pad_negro', (-largo / 2, -0.14, 0.38), (largo / 2, 0.14, 0.45), M)
    b.box('acero_negro', (-largo / 2 + 0.05, -0.04, 0.3), (largo / 2 - 0.05, 0.04, 0.38), M)
    for x in (-largo / 2 + 0.1, largo / 2 - 0.1):
        b.box('acero_negro', (x - 0.03, -0.03, 0.04), (x + 0.03, 0.03, 0.3), M)
        b.box('acero_negro', (x - 0.035, -0.22, 0.0), (x + 0.035, 0.22, 0.05), M)
        b.box('plastico_negro', (x - 0.04, -0.23, 0.0), (x + 0.04, -0.2, 0.02), M)
        b.box('plastico_negro', (x - 0.04, 0.2, 0.0), (x + 0.04, 0.23, 0.02), M)


def banco_regulable(b, M, ang=30):
    a = math.radians(ang)
    b.box('pad_negro', (-0.35, -0.15, 0.4), (0.05, 0.15, 0.47), M)
    b.box('pad_negro', (0, -0.15, -0.035), (0.85, 0.15, 0.035), M @ T(0.07, 0, 0.47) @ Ry(-a))
    b.box('acero_negro', (-0.55, -0.04, 0.05), (0.75, 0.04, 0.12), M)
    b.box('acero_negro', (-0.05, -0.03, 0.12), (0.03, 0.03, 0.4), M)
    b.box('acero_negro', (0.1, -0.03, 0.0), (0.2, 0.03, 0.75), M @ T(0.1, 0, 0.08) @ Ry(-a * 0.7))
    for x in (-0.55, 0.75):
        b.box('acero_negro', (x - 0.035, -0.24, 0.0), (x + 0.035, 0.24, 0.06), M)
    b.cyl('plastico_negro', 0.04, -0.27, 0.27, 12, M @ T(0.75, 0, 0.05) @ Rx(math.pi / 2))


def mancuerna(b, M, kg):
    """Mancuerna hexagonal de caucho con eje en y local."""
    r = 0.05 + 0.0125 * kg ** 0.5
    h = 0.04 + 0.0022 * kg
    Mz = M @ Rx(math.pi / 2)
    b.cyl('cromo', 0.017, -0.07, 0.07, 10, Mz)
    for s in (-1, 1):
        za, zb = sorted((s * 0.07, s * (0.07 + h)))
        b.lathe('goma_bumper', [(0.0, za), (r, za), (r, zb), (0.0, zb)], 6, Mz @ Rz(math.pi / 6), tint=(0.06, 0.06, 0.065))
        zc = s * (0.07 + h)
        za, zb = sorted((zc, zc + s * 0.004))
        b.lathe('cromo', [(0.0, za), (r * 0.55, za), (r * 0.55, zb), (0.0, zb)], 6, Mz @ Rz(math.pi / 6))


def rack_mancuernas(b, M, pesos):
    """Rack de 2 alturas, 3.6 m, frente hacia -y."""
    L = 3.6
    for x in (0.05, L / 2, L - 0.05):
        b.box('acero_negro', (x - 0.04, -0.35, 0), (x + 0.04, 0.35, 0.06), M)
        b.box('acero_negro', (x - 0.035, 0.1, 0.06), (x + 0.035, 0.18, 0.9), M)
    for (z, y0, y1) in ((0.42, -0.35, 0.05), (0.78, -0.05, 0.3)):
        for yy in (y0, y1):
            b.box('acero_negro', (0, yy - 0.025, z), (L, yy + 0.025, z + 0.05), M)
        for x in (0.05, L / 2, L - 0.05):
            b.box('acero_negro', (x - 0.03, y0, z - 0.02), (x + 0.03, y1, z), M)
    i = 0
    for tier, (z, yc) in enumerate(((0.47, -0.15), (0.83, 0.12))):
        for k in range(5):
            if i >= len(pesos):
                break
            kg = pesos[i]
            r = 0.05 + 0.0125 * kg ** 0.5
            x = 0.2 + k * 0.7
            for dx in (0.0, 0.3):
                mancuerna(b, M @ T(x + dx, yc, z + r * 0.866), kg)
            i += 1


def remoergometro(b, M):
    """Remoergómetro de aire (tipo Concept2). Eje longitudinal x, usuario mira a -x."""
    b.box('aluminio', (0.35, -0.035, 0.33), (2.42, 0.035, 0.39), M)
    b.box('acero_negro', (2.3, -0.28, 0.0), (2.38, 0.28, 0.06), M)
    b.box('acero_negro', (2.3, -0.03, 0.06), (2.38, 0.03, 0.33), M)
    b.box('acero_negro', (0.22, -0.3, 0.0), (0.32, 0.3, 0.07), M)
    b.box('acero_negro', (0.25, -0.05, 0.07), (0.4, 0.05, 0.42), M)
    b.cyl('plastico_negro', 0.27, -0.16, 0.16, 24, M @ T(0.18, 0, 0.56) @ Rx(math.pi / 2))
    b.cyl('acero_negro', 0.08, -0.17, 0.17, 12, M @ T(0.18, 0, 0.56) @ Rx(math.pi / 2))
    b.box('plastico_negro', (0.0, -0.18, 0.25), (0.42, 0.18, 0.36), M)
    # reposapiés
    for s in (-1, 1):
        b.box('plastico_negro', (-0.06, s * 0.03, -0.12), (0.06, s * 0.16, 0.18), M @ T(0.58, 0, 0.42) @ Ry(0.6))
    b.box('pad_negro', (1.25, -0.16, 0.42), (1.6, 0.16, 0.49), M)
    b.box('acero_negro', (1.3, -0.06, 0.39), (1.55, 0.06, 0.42), M)
    b.cyl('acero_negro', 0.018, -0.27, 0.27, 10, M @ T(0.47, 0, 0.66) @ Rx(math.pi / 2))
    b.cyl('plastico_negro', 0.022, 0.12, 0.27, 10, M @ T(0.47, 0, 0.66) @ Rx(math.pi / 2))
    b.cyl('plastico_negro', 0.022, -0.27, -0.12, 10, M @ T(0.47, 0, 0.66) @ Rx(math.pi / 2))
    # brazo y monitor
    p0 = (M @ T(0.25, 0, 0.8)).to_translation()
    p1 = (M @ T(0.55, 0, 1.15)).to_translation()
    b.cyl_between('acero_negro', p0, p1, 0.015, 8)
    b.box('plastico_negro', (-0.03, -0.11, -0.09), (0.03, 0.11, 0.09), M @ T(0.58, 0, 1.15) @ Ry(-0.4))
    b.box('plastico_blanco', (-0.0305, -0.08, -0.06), (-0.029, 0.08, 0.06), M @ T(0.6, 0, 1.15) @ Ry(math.pi - 0.4),
          tint=(0.55, 0.62, 0.55))


def bici_aire(b, M):
    b.cyl('plastico_negro', 0.33, -0.14, 0.14, 24, M @ T(0.0, 0, 0.45) @ Rx(math.pi / 2))
    b.box('acero_negro', (-0.1, -0.3, 0.0), (0.1, 0.3, 0.06), M)
    b.box('acero_negro', (1.0, -0.3, 0.0), (1.15, 0.3, 0.06), M)
    b.cyl_between('acero_negro', (M @ T(0.1, 0, 0.3)).to_translation(), (M @ T(1.05, 0, 0.05)).to_translation(), 0.035, 8)
    b.cyl_between('acero_negro', (M @ T(0.65, 0, 0.3)).to_translation(), (M @ T(0.85, 0, 0.95)).to_translation(), 0.03, 8)
    b.box('pad_negro', (0.72, -0.13, 0.95), (1.02, 0.13, 1.02), M)
    for s in (-1, 1):
        b.cyl_between('acero_negro', (M @ T(0.25, s * 0.2, 0.5)).to_translation(),
                      (M @ T(0.45, s * 0.25, 1.3)).to_translation(), 0.018, 8)
    b.box('plastico_negro', (0.28, -0.08, 1.05), (0.36, 0.08, 1.17), M)


def skierg(b, M):
    b.box('acero_negro', (-0.1, 0.0, 0.0), (0.1, 0.12, 2.25), M)
    b.box('plastico_negro', (-0.18, -0.05, 1.9), (0.18, 0.12, 2.3), M)
    b.box('acero_negro', (-0.4, -0.5, 0.0), (0.4, 0.12, 0.04), M)
    for s in (-1, 1):
        b.cyl('plastico_negro', 0.02, 1.55, 1.75, 8, M @ T(s * 0.13, -0.06, 0))
    b.box('plastico_negro', (-0.06, -0.05, 1.45), (0.06, -0.03, 1.55), M)


def poleas(b, L, M):
    """Funcional / cruce de poleas: 2 torres con pilas de placas."""
    for s, x in ((-1, 0.0), (1, 3.2)):
        Mt = M @ T(x, 0, 0)
        for (px, py) in ((-0.3, -0.25), (0.3, -0.25), (-0.3, 0.25), (0.3, 0.25)):
            b.box('acero_negro', (px - 0.04, py - 0.04, 0), (px + 0.04, py + 0.04, 2.3), Mt)
        b.box('acero_negro', (-0.35, -0.3, 2.3), (0.35, 0.3, 2.4), Mt)
        b.box('acero_negro', (-0.35, -0.3, 0.0), (0.35, 0.3, 0.08), Mt)
        for k in range(18):
            z = 0.12 + k * 0.045
            b.box('acero_negro', (-0.2, -0.08, z), (0.2, 0.08, z + 0.04), Mt, tint=(1.4, 1.4, 1.4))
        for gx in (-0.15, 0.15):
            b.cyl('cromo', 0.01, 0.08, 2.3, 8, Mt @ T(gx, 0, 0))
        b.box('cromo', (-0.06, -0.33, 0.1), (0.06, -0.27, 2.25), Mt)
        b.cyl('plastico_negro', 0.06, -0.025, 0.025, 16, Mt @ T(0, -0.36, 1.6) @ Ry(math.pi / 2))
        b.cyl('acero_negro', 0.004, 0.25, 1.55, 6, Mt @ T(0, -0.42, 0))
        b.box('acero_inox', (-0.12, -0.45, 0.2), (0.12, -0.41, 0.24), Mt)
    b.box('acero_negro', (0.0, -0.06, 2.3), (3.2, 0.06, 2.42), M)
    b.cyl_between('moleteado', (M @ T(0.4, -0.35, 2.2)).to_translation(), (M @ T(2.8, -0.35, 2.2)).to_translation(), 0.016)


def kettlebell(b, M, kg):
    r = 0.105
    b.lathe('acero_disco', [(0.0, 0.0), (0.07, 0.0), (r, 0.04), (r * 0.98, 0.13), (0.07, 0.19), (0.0, 0.2)], 16, M,
            tint=KB_COL[kg])
    b.torus('acero_disco', 0.075, 0.017, 16, 6, M @ T(0, 0, 0.2) @ Rx(math.pi / 2), a0=0.15, a1=math.pi - 0.15)


def balon_medicinal(b, M, r, tint):
    b.sphere('goma_bumper', r, 16, 10, M, tint=tint)


def caja_plio(b, M, w, d, h):
    b.box('madera_clara', (0, 0, 0), (w, d, h), M)
    b.box('madera_oscura', (w * 0.3, -0.005, h * 0.75), (w * 0.7, 0.01, h * 0.85), M)


def espalderas(b, M, L=2.6, H=2.5):
    n = int(L / 0.9)
    for i in range(n + 1):
        x = L * i / n
        b.box('madera_clara', (x - 0.03, 0.0, 0), (x + 0.03, 0.08, H), M)
    for k in range(int(H / 0.15)):
        z = 0.15 + k * 0.15
        b.cyl('madera_clara', 0.017, 0, L, 8, M @ T(0, 0.04, z) @ Ry(math.pi / 2))


def trineo(b, M):
    for s in (-1, 1):
        b.box('acero_negro', (-0.6, s * 0.3 - 0.03, 0.0), (0.6, s * 0.3 + 0.03, 0.05), M)
        b.cyl_between('acero_negro', (M @ T(0.4, s * 0.3, 0.05)).to_translation(),
                      (M @ T(0.6, s * 0.25, 1.25)).to_translation(), 0.022)
        b.cyl_between('acero_negro', (M @ T(0.0, s * 0.3, 0.05)).to_translation(),
                      (M @ T(0.25, s * 0.25, 0.75)).to_translation(), 0.022)
    b.box('acero_negro', (-0.6, -0.33, 0.0), (-0.55, 0.33, 0.05), M)
    b.cyl('cromo', 0.025, 0.05, 0.4, 12, M @ T(-0.2, 0, 0))
    z = 0.06
    for kg in (20, 20, 10):
        disco(b, M @ T(-0.2, 0, z + GROSOR[kg] / 2), kg)
        z += GROSOR[kg] + 0.002


def soporte_barras(b, M):
    b.box('acero_negro', (-0.45, -0.25, 0), (0.45, 0.25, 0.08), M)
    for i in range(6):
        x = -0.35 + i * 0.14
        b.cyl('acero_negro', 0.035, 0.08, 0.2, 10, M @ T(x, 0, 0))
        b.cyl('moleteado', 0.014, 0.2, 1.5, 10, M @ T(x, 0, 0))
        b.cyl('cromo', 0.025, 1.5, 1.92, 10, M @ T(x, 0, 0))
        b.cyl('cromo', 0.035, 1.48, 1.52, 10, M @ T(x, 0, 0))


def arbol_discos(b, M, carga):
    b.box('acero_negro', (-0.3, -0.3, 0), (0.3, 0.3, 0.06), M)
    b.box('acero_negro', (-0.04, -0.04, 0.06), (0.04, 0.04, 1.3), M)
    for k, (z, s) in enumerate(((0.3, 1), (0.3, -1), (0.75, 1), (0.75, -1), (1.15, 1), (1.15, -1))):
        p0 = (M @ T(0, s * 0.04, z)).to_translation()
        p1 = (M @ T(0, s * 0.3, z + 0.03)).to_translation()
        b.cyl_between('cromo', p0, p1, 0.024, 10)
        off = 0.06
        for kg in carga[k % len(carga)]:
            t = GROSOR[kg]
            disco(b, M @ T(0, s * (off + t / 2), z) @ Rx(math.pi / 2), kg)
            off += t + 0.003


def pizarra_entreno(b, P, M):
    """Pizarra blanca con el entrenamiento del día + reloj de intervalos LED."""
    b.box('aluminio', (-1.55, -0.03, 0.95), (1.55, 0.0, 2.45), M)
    b.box('pizarra_blanca', (-1.5, -0.035, 1.0), (1.5, -0.03, 2.4), M)
    lineas = [('ENTRENAMIENTO · MARTES', 'pintura_club', 0.1),
              ('A1  SENTADILLA TRASERA  5 x 5 @ 80%', 'acero_negro', 0.065),
              ('A2  CARGADA COLGANTE  4 x 3', 'acero_negro', 0.065),
              ('B1  PRESS BANCA  4 x 6', 'acero_negro', 0.065),
              ('B2  DOMINADAS LASTRADAS  4 x 5', 'acero_negro', 0.065),
              ('C   REMO 6 x 500 m  (desc. 1:30)', 'gorro_rojo', 0.065),
              ('D   CORE ROTACIONAL + HOMBRO  3 rondas', 'acero_negro', 0.065)]
    z = 2.25
    for txt, mat, sz in lineas:
        b.text(mat, txt, sz, M @ T(-1.4, -0.04, z), align='LEFT', extrude=0.001)
        z -= 0.19
    b.box('aluminio', (-1.5, -0.08, 0.95), (1.5, -0.03, 0.97), M)
    # reloj
    b.box('acero_negro', (-0.7, -0.08, 2.6), (0.7, 0.0, 3.0), M)
    P['luz'].text('led_rojo', '12:00', 0.3, M @ T(-0.15, -0.085, 2.8), extrude=0.002)
    P['luz'].text('led_verde', '3/6', 0.16, M @ T(0.45, -0.085, 2.8), extrude=0.002)


def construir(B, rnd):
    S = B['Gimnasio_Sala']
    E = B['Gimnasio_Equipos']
    L_ = B['Centro_Luminarias']
    ESP = B['Centro_Espejos']
    P = {'luz': L_}
    M0 = GM

    # --- estaciones de fuerza: 2 filas x 4, enfrentadas
    xs = (7.0, 10.3, 13.6, 16.9)
    for i, x in enumerate(xs):
        Ma = M0 @ T(x, 19.9, 0)
        plataforma(S, Ma)
        rack(E, P, Ma, i % 4, rnd)
        Mb = M0 @ T(x, 13.0, 0) @ Rz(math.pi)
        plataforma(S, Mb)
        rack(E, P, Mb, (i + 2) % 4, rnd)

    # --- mancuernas 2.5 - 50 kg (dos racks) + bancos
    pesos = [2.5 * k for k in range(1, 21)]
    rack_mancuernas(E, M0 @ T(4.4, 10.6, 0), pesos[:10])
    rack_mancuernas(E, M0 @ T(8.6, 10.6, 0), pesos[10:])
    for i, x in enumerate((4.2, 6.6, 9.0, 11.4)):
        banco_regulable(E, M0 @ T(x, 8.4, 0) @ Rz(-math.pi / 2), ang=(0, 30, 45, 15)[i])
    # mancuernas sueltas junto a un banco
    mancuerna(E, M0 @ T(6.3, 7.6, 0.12) @ Rz(0.3), 30)
    mancuerna(E, M0 @ T(6.75, 7.7, 0.12) @ Rz(-0.2), 30)

    # --- soporte de barras + árboles de discos
    soporte_barras(E, M0 @ T(15.2, 10.5, 0))
    arbol_discos(E, M0 @ T(16.6, 10.2, 0), [(25, 25), (20, 20), (15, 10, 5)])
    arbol_discos(E, M0 @ T(17.6, 10.2, 0), [(10, 10, 5), (2.5, 2.5, 1.25), (20, 15)])

    # --- acondicionamiento (pared oeste): remos, bicis, skiergs
    for k in range(6):
        remoergometro(E, M0 @ T(0.35, 19.6 - k * 1.05, 0))
    for k in range(2):
        bici_aire(E, M0 @ T(0.6, 12.2 - k * 1.3, 0))
    for k in range(2):
        skierg(E, M0 @ T(0.15, 9.0 - k * 1.1, 0) @ Rz(math.pi / 2))
    # estantería de balones medicinales
    Mr = M0 @ T(0.0, 4.0, 0)
    for z in (0.35, 0.9, 1.45):
        E.box('acero_negro', (0.05, 0.0, z), (0.5, 2.6, z + 0.04), Mr)
    for y in (0.02, 1.3, 2.58):
        E.box('acero_negro', (0.05, y - 0.02, 0), (0.5, y + 0.02, 1.8), Mr)
    cols = [(0.78, 0.07, 0.06), (0.05, 0.22, 0.65), (0.95, 0.74, 0.05), (0.1, 0.5, 0.18), (0.08, 0.08, 0.08)]
    for zi, z in enumerate((0.39, 0.94, 1.49)):
        for k in range(6):
            r = 0.15 + 0.01 * zi
            balon_medicinal(E, Mr @ T(0.28, 0.25 + k * 0.42, z + r), r, cols[(k + zi) % 5])

    # --- césped con trineo (pared sur) y marcas
    S.box('cesped_artificial', (3.5, 0.4, 0.0), (21.0, 2.6, 0.012), M0)
    for k in range(4):
        x = 4.0 + k * 5.0
        S.box('pintura_blanca', (x, 0.45, 0.012), (x + 0.06, 2.55, 0.014), M0)
        S.text('pintura_blanca', f'{k * 5}', 0.25, M0 @ T(x + 0.35, 1.5, 0.016) @ Rx(-math.pi / 2), extrude=0.001)
    for y in (0.45, 2.55):
        S.box('pintura_blanca', (3.5, y - 0.03, 0.012), (21.0, y + 0.03, 0.014), M0)
    trineo(E, M0 @ T(6.0, 1.5, 0.012))
    trineo(E, M0 @ T(9.0, 1.5, 0.012) @ Rz(0.05))

    # --- poleas (pared este, sur)
    poleas(E, 3.2, M0 @ T(17.6, 4.2, 0))
    # --- kettlebells (estante pared este)
    Mk = M0 @ T(21.35, 12.3, 0) @ Rz(math.pi / 2)
    for z in (0.02, 0.45):
        E.box('acero_negro', (0.0, 0.0, z + 0.3), (2.0, 0.5, z + 0.34), Mk)
    for x in (0.02, 1.98):
        E.box('acero_negro', (x - 0.02, 0.0, 0), (x + 0.02, 0.5, 0.82), Mk)
    for i, kg in enumerate((8, 12, 16, 20, 24, 28, 32)):
        kettlebell(E, Mk @ T(0.18 + i * 0.27, 0.25, 0.36), kg)
        kettlebell(E, Mk @ T(0.18 + i * 0.27, 0.25, 0.79), kg)
    # cajas pliométricas
    caja_plio(E, M0 @ T(19.8, 15.0, 0), 0.75, 0.6, 0.5)
    caja_plio(E, M0 @ T(19.8, 15.0, 0.5), 0.75, 0.6, 0.6)
    caja_plio(E, M0 @ T(19.8, 15.7, 0), 0.75, 0.6, 0.75)
    # espalderas pared norte (detrás de los remos)
    espalderas(E, M0 @ T(2.9, 21.32, 0) @ Rz(math.pi), L=2.6)
    # pizarra + reloj + TV (pared este)
    pizarra_entreno(E, P, M0 @ T(21.38, 18.0, 0) @ Rz(-math.pi / 2))
    E.box('acero_negro', (0.3, -0.06, 1.5), (1.6, 0.0, 2.25), M0 @ T(21.38, 18.0, 0) @ Rz(-math.pi / 2) @ T(1.0, 0, 0))
    L_.box('pantalla', (0.34, -0.065, 1.54), (1.56, -0.06, 2.21), M0 @ T(21.38, 18.0, 0) @ Rz(-math.pi / 2) @ T(1.0, 0, 0))
    # mesa del preparador físico
    Md = M0 @ T(19.4, 20.4, 0)
    E.box('madera_clara', (0, 0, 1.0), (1.4, 0.7, 1.04), Md)
    for x in (0.1, 1.3):
        E.box('acero_negro', (x - 0.03, 0.1, 0), (x + 0.03, 0.6, 1.0), Md)
    E.box('acero_inox', (0.4, 0.15, 1.04), (0.75, 0.4, 1.055), Md)
    E.box('acero_inox', (0.4, 0.4, 1.05), (0.75, 0.41, 1.28), Md @ T(0, 0, 0))
    L_.box('pantalla', (0.42, 0.395, 1.07), (0.73, 0.396, 1.26), Md)
    # fuente de agua + rodillos + colchonetas
    E.box('acero_inox', (0.0, 0.0, 0.0), (0.45, 0.35, 1.05), M0 @ T(20.8, 9.0, 0))
    for k in range(5):
        E.cyl('goma_bumper', 0.075, 0.0, 0.9, 16, M0 @ T(19.7 + k * 0.17, 8.9, 0.075) @ Rx(math.pi / 2),
              tint=(0.05, 0.12, 0.3) if k % 2 else (0.06, 0.06, 0.06))
    for k in range(6):
        E.box('vinilo_pad', (0, 0, k * 0.02), (1.8, 0.6, k * 0.02 + 0.018), M0 @ T(17.3, 8.8, 0), tint=(0.05, 0.12, 0.3))

    # --- espejos (pared sur) con marco
    for (x0, x1) in ((0.6, 9.4), (12.0, 20.8)):
        ESP.box('espejo', (x0, 0.015, 0.45), (x1, 0.025, 2.45), M0)
        for (a, b_, c, d) in ((x0 - 0.03, x1 + 0.03, 0.42, 0.45), (x0 - 0.03, x1 + 0.03, 2.45, 2.48)):
            S.box('aluminio', (a, 0.0, c), (b_, 0.035, d), M0)
    # --- banda de color del club + lema
    S.box('pintura_club', (0.0, 0.0, 0.0), (GW, 0.01, 0.3), M0)
    S.box('pintura_club', (0.0, GL - 0.01, 0.0), (GW, GL, 0.3), M0)
    S.box('pintura_club', (0.0, 0.0, 0.0), (0.01, GL, 0.3), M0)
    S.box('pintura_club', (GW - 0.01, 0.0, 0.0), (GW, GL, 0.3), M0)
    S.text('pintura_club', 'TRABAJO  ·  DISCIPLINA  ·  EQUIPO', 0.36, M0 @ T(GW / 2, 0.02, 3.6) @ Rz(math.pi), extrude=0.01)
    S.text('pintura_club', 'NADIE TRABAJA MÁS QUE NOSOTROS', 0.3, M0 @ T(0.02, 10.7, 5.15) @ Rz(math.pi / 2), extrude=0.01)

    # --- techo: conducto de climatización y luminarias lineales
    zc = C = 5.6
    S.cyl('aluminio', 0.32, 0.6, GW - 0.6, 20, M0 @ T(0, 10.7, C - 0.55) @ Ry(math.pi / 2))
    for k in range(5):
        x = 2.5 + k * 4.2
        S.box('aluminio', (x - 0.25, 10.45, C - 0.95), (x + 0.25, 10.95, C - 0.86), M0)
    for y in (2.0, 5.0, 8.0, 13.0, 16.0, 19.0):
        L_.box('luz_linea', (1.2, y - 0.05, C - 0.06), (GW - 1.2, y + 0.05, C - 0.01), M0)
        S.box('aluminio', (1.15, y - 0.07, C - 0.015), (GW - 1.15, y + 0.07, C), M0)
