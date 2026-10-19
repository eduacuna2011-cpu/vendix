# -*- coding: utf-8 -*-
"""GIMNASIO PRO de alto rendimiento (edificio independiente).

Distribución de sala de fuerza de centro olímpico:
  - 8 estaciones rack + plataforma integrada en dos filas enfrentadas (barra y discos de
    competición por estación, 2 con plataformas de fuerza, landmine, barra hexagonal,
    safety squat bar, barra EZ) y pasillo central con visión del preparador.
  - Acondicionamiento: remoergómetros, ergómetros de natación (Vasa), cintas curvas, bicis de aire, SkiErg.
  - Mancuernas hexagonales 2.5–50 kg, bancos regulables, soporte de barras y árboles de discos.
  - Funcional: rig con anillas, TRX, cuerda de trepa y barras de monos, cuerdas de batalla,
    rebotador de balón (lanzamiento de waterpolo), fitballs, BOSU, cajas pliométricas.
  - Máquinas: jalón/remo, prensa 45°, belt squat, GHD, hiperextensión inversa, nórdicos, poleas.
  - Césped con trineos, vallas, escalera de agilidad y células de cronometraje.
  - Tecnología: marcador LED de velocidad (VBT), reloj de intervalos, pizarra, TV.

Cada elemento se registra como PIEZA con nombre (Builder.p) para poder exportarlo como
objeto independiente (suelo, racks, ganchos, barras, discos, bancos...).

Sistema local: origen en la esquina interior SO, x hacia el este (0..21.4), y hacia el norte.
"""
import math
from mathutils import Vector
from .geo import T, Rz, Rx, Ry, Sc, TAU, align_z
from . import arq

GX, GY = -27.7, -45.7
GW, GL = 21.4, 21.4
FZ = 0.16
GM = T(GX, GY, FZ)

COL = {25: (0.78, 0.07, 0.06), 20: (0.05, 0.22, 0.65), 15: (0.95, 0.74, 0.05), 10: (0.1, 0.5, 0.18),
       5: (0.93, 0.93, 0.93), 2.5: (0.78, 0.07, 0.06), 1.25: (0.85, 0.85, 0.85)}
GROSOR = {25: 0.064, 20: 0.054, 15: 0.044, 10: 0.034, 5: 0.026, 2.5: 0.019, 1.25: 0.015}
RADIO = {25: 0.225, 20: 0.225, 15: 0.225, 10: 0.225, 5: 0.163, 2.5: 0.105, 1.25: 0.08}
KB_COL = {8: (0.9, 0.45, 0.6), 12: (0.1, 0.35, 0.75), 16: (0.95, 0.75, 0.05), 20: (0.45, 0.2, 0.6),
          24: (0.1, 0.55, 0.2), 28: (0.95, 0.45, 0.05), 32: (0.78, 0.07, 0.06)}
NEGRO = (0.06, 0.06, 0.065)


def kgtxt(kg):
    return (f'{kg:g}').replace('.', '_')


def P3(M, x, y, z):
    return (M @ T(x, y, z)).to_translation()


# ---------------------------------------------------------------------------
# PESAS
# ---------------------------------------------------------------------------
def disco(b, M, kg, seg=28, nombre=None):
    """Disco bumper con eje en z local, centrado en el origen."""
    with b.p(nombre or f'Disco_{kgtxt(kg)}kg'):
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


def collarin(b, M):
    with b.p('Collarin'):
        b.lathe('plastico_negro', [(0.026, -0.016), (0.045, -0.016), (0.045, 0.016), (0.026, 0.016)], 16, M,
                closed=True, cap0=False, cap1=False)
        b.box('plastico_negro', (0.04, -0.012, -0.012), (0.09, 0.012, 0.012), M)


def cargar(b, Mz, s, z, carga):
    """Carga discos en una manga (eje z local), desde z hacia fuera según el signo s."""
    for kg in carga:
        t = GROSOR[kg]
        disco(b, Mz @ T(0, 0, s * (z + t / 2)), kg)
        z += t + 0.002
    if carga:
        collarin(b, Mz @ T(0, 0, s * (z + 0.016)) @ Rx(0 if s > 0 else math.pi))


def barra(b, M, carga=(), tipo='H20', seg=14, nombre=None):
    """Barra olímpica (eje x local, centrada). tipo H20 = 20 kg / 2.20 m, M15 = 15 kg / 2.01 m."""
    r_sh = 0.014 if tipo == 'H20' else 0.0125
    manga = 0.415 if tipo == 'H20' else 0.32
    Mz = M @ Ry(math.pi / 2)
    with b.p(nombre or ('Barra_Olimpica_20kg' if tipo == 'H20' else 'Barra_Olimpica_15kg')):
        b.cyl('moleteado', r_sh, -0.655, 0.655, seg, Mz)
        for s in (-1, 1):
            b.lathe('cromo', [(0.0, s * 0.655), (0.035, s * 0.655), (0.035, s * 0.695), (0.0, s * 0.695)][::s], seg, Mz)
            b.cyl('cromo', 0.025, min(s * 0.695, s * (0.695 + manga)), max(s * 0.695, s * (0.695 + manga)), seg, Mz)
    for s in (-1, 1):
        cargar(b, Mz, s, 0.70, carga)


def barra_ez(b, M, carga=()):
    """Barra EZ de 1.2 m con tramo central ondulado (eje x)."""
    with b.p('Barra_EZ'):
        pts = [(-0.38, 0.0), (-0.26, 0.0), (-0.2, 0.035), (-0.12, -0.035), (-0.06, 0.0),
               (0.06, 0.0), (0.12, -0.035), (0.2, 0.035), (0.26, 0.0), (0.38, 0.0)]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            b.cyl_between('moleteado', P3(M, x0, y0, 0), P3(M, x1, y1, 0), 0.014, 10)
        for s in (-1, 1):
            b.cyl_between('cromo', P3(M, s * 0.38, 0, 0), P3(M, s * 0.42, 0, 0), 0.032, 14)
            b.cyl_between('cromo', P3(M, s * 0.42, 0, 0), P3(M, s * 0.62, 0, 0), 0.025, 14)
    Mz = M @ Ry(math.pi / 2)
    for s in (-1, 1):
        cargar(b, Mz, s, 0.425, carga)


def barra_hex(b, M, carga=()):
    """Barra hexagonal (trap bar), en el plano XY local, mangas a lo largo de x."""
    with b.p('Barra_Hexagonal'):
        R = 0.62
        v = [P3(M, R * math.cos(math.radians(a)), R * math.sin(math.radians(a)), 0) for a in range(0, 360, 60)]
        for i in range(6):
            b.cyl_between('acero_negro', v[i], v[(i + 1) % 6], 0.016, 8)
        for s in (-1, 1):
            # asas (paralelas a y) unidas al marco
            b.cyl_between('moleteado', P3(M, s * 0.29, -0.14, 0.05), P3(M, s * 0.29, 0.14, 0.05), 0.017, 10)
            for yy in (-0.14, 0.14):
                b.cyl_between('acero_negro', P3(M, s * 0.29, yy, 0.05), P3(M, s * 0.31, yy * 3.6, 0), 0.014, 8)
            b.cyl_between('cromo', P3(M, s * R, 0, 0), P3(M, s * (R + 0.42), 0, 0), 0.025, 14)
    Mz = M @ Ry(math.pi / 2)
    for s in (-1, 1):
        cargar(b, Mz, s, R + 0.01, carga)


def barra_ssb(b, M, carga=()):
    """Safety squat bar: barra con yugo acolchado y asas hacia delante (-y)."""
    with b.p('Barra_Safety_Squat'):
        Mz = M @ Ry(math.pi / 2)
        b.cyl('acero_negro', 0.016, -0.6, 0.6, 12, Mz)
        for s in (-1, 1):
            b.cyl_between('acero_negro', P3(M, s * 0.6, 0, 0), P3(M, s * 0.62, 0, -0.08), 0.02, 8)
            b.cyl('cromo', 0.025, min(s * 0.62, s * 1.05), max(s * 0.62, s * 1.05), 14, M @ T(0, 0, -0.08) @ Ry(math.pi / 2))
            b.cyl_between('acero_negro', P3(M, s * 0.16, 0, 0), P3(M, s * 0.2, -0.45, -0.05), 0.016, 8)
            b.cyl_between('plastico_negro', P3(M, s * 0.2, -0.45, -0.05), P3(M, s * 0.2, -0.6, -0.08), 0.02, 8)
        b.box('pad_negro', (-0.2, -0.12, 0.0), (0.2, 0.12, 0.1), M @ T(0, 0.05, 0))
        for s in (-1, 1):
            b.box('pad_negro', (-0.06, -0.3, -0.04), (0.06, 0.05, 0.06), M @ T(s * 0.16, 0, 0.02))
    for s in (-1, 1):
        cargar(b, M @ T(0, 0, -0.08) @ Ry(math.pi / 2), s, 0.63, carga)


def mancuerna(b, M, kg, nombre=None):
    """Mancuerna hexagonal de caucho con eje en y local."""
    with b.p(nombre or f'Mancuerna_{kgtxt(kg)}kg'):
        r = 0.05 + 0.0125 * kg ** 0.5
        h = 0.04 + 0.0022 * kg
        Mz = M @ Rx(math.pi / 2)
        b.cyl('moleteado', 0.017, -0.07, 0.07, 10, Mz)
        for s in (-1, 1):
            za, zb = sorted((s * 0.07, s * (0.07 + h)))
            b.lathe('goma_bumper', [(0.0, za), (r, za), (r, zb), (0.0, zb)], 6, Mz @ Rz(math.pi / 6), tint=NEGRO)
            zc = s * (0.07 + h)
            za, zb = sorted((zc, zc + s * 0.004))
            b.lathe('cromo', [(0.0, za), (r * 0.55, za), (r * 0.55, zb), (0.0, zb)], 6, Mz @ Rz(math.pi / 6))


def kettlebell(b, M, kg):
    with b.p(f'Kettlebell_{kgtxt(kg)}kg'):
        r = 0.105
        b.lathe('acero_disco', [(0.0, 0.0), (0.07, 0.0), (r, 0.04), (r * 0.98, 0.13), (0.07, 0.19), (0.0, 0.2)], 16, M,
                tint=KB_COL[kg])
        b.torus('acero_disco', 0.075, 0.017, 16, 6, M @ T(0, 0, 0.2) @ Rx(math.pi / 2), a0=0.15, a1=math.pi - 0.15)


def balon_medicinal(b, M, r, tint, nombre='Balon_Medicinal'):
    with b.p(nombre):
        b.sphere('goma_bumper', r, 16, 10, M, tint=tint)


# ---------------------------------------------------------------------------
# BANCOS
# ---------------------------------------------------------------------------
def banco_plano(b, M, largo=1.2):
    with b.p('Banco_Plano'):
        b.box('pad_negro', (-largo / 2, -0.14, 0.38), (largo / 2, 0.14, 0.45), M)
        b.box('acero_negro', (-largo / 2 + 0.05, -0.04, 0.3), (largo / 2 - 0.05, 0.04, 0.38), M)
        for x in (-largo / 2 + 0.1, largo / 2 - 0.1):
            b.box('acero_negro', (x - 0.03, -0.03, 0.04), (x + 0.03, 0.03, 0.3), M)
            b.box('acero_negro', (x - 0.035, -0.22, 0.0), (x + 0.035, 0.22, 0.05), M)
            b.box('plastico_negro', (x - 0.04, -0.23, 0.0), (x + 0.04, -0.2, 0.02), M)
            b.box('plastico_negro', (x - 0.04, 0.2, 0.0), (x + 0.04, 0.23, 0.02), M)


def banco_regulable(b, M, ang=30):
    with b.p(f'Banco_Regulable_{ang}grados'):
        a = math.radians(ang)
        b.box('pad_negro', (-0.35, -0.15, 0.4), (0.05, 0.15, 0.47), M)
        b.box('pad_negro', (0, -0.15, -0.035), (0.85, 0.15, 0.035), M @ T(0.07, 0, 0.47) @ Ry(-a))
        b.box('acero_negro', (-0.55, -0.04, 0.05), (0.75, 0.04, 0.12), M)
        b.box('acero_negro', (-0.05, -0.03, 0.12), (0.03, 0.03, 0.4), M)
        b.box('acero_negro', (0.1, -0.03, 0.0), (0.2, 0.03, 0.75), M @ T(0.1, 0, 0.08) @ Ry(-a * 0.7))
        for x in (-0.55, 0.75):
            b.box('acero_negro', (x - 0.035, -0.24, 0.0), (x + 0.035, 0.24, 0.06), M)
        b.cyl('plastico_negro', 0.04, -0.27, 0.27, 12, M @ T(0.75, 0, 0.05) @ Rx(math.pi / 2))


# ---------------------------------------------------------------------------
# RACK + PLATAFORMA
# ---------------------------------------------------------------------------
def tubo(b, M, x, y, z0, z1, mat='acero_rack', s=0.075):
    b.box(mat, (-s / 2, -s / 2, z0), (s / 2, s / 2, z1), M @ T(x, y, 0))


def plataforma(b, M, nombre='Plataforma', fuerza=False):
    """Plataforma de halterofilia integrada (madera central + caucho) bajo el rack."""
    with b.p(nombre):
        if not fuerza:
            b.box('madera_plataforma', (-0.6, -2.4, 0), (0.6, 1.3, 0.05), M, skip=('bottom',))
        else:
            b.box('madera_plataforma', (-0.6, -0.5, 0), (0.6, 1.3, 0.05), M, skip=('bottom',))
            b.box('goma_gym', (-0.6, -2.4, 0), (0.6, -0.5, 0.012), M, skip=('bottom',), tint=(0.8, 0.8, 0.8))
        b.box('goma_gym', (-1.2, -2.4, 0), (-0.6, 1.3, 0.05), M, skip=('bottom',), tint=(0.8, 0.8, 0.8))
        b.box('goma_gym', (0.6, -2.4, 0), (1.2, 1.3, 0.05), M, skip=('bottom',), tint=(0.8, 0.8, 0.8))
        for x in (-1.2, 1.2):
            b.box('acero_negro', (x - 0.02, -2.42, 0), (x + 0.02, 1.32, 0.052), M)
        b.box('acero_negro', (-1.22, -2.44, 0), (1.22, -2.4, 0.052), M)
        b.box('acero_negro', (-1.22, 1.3, 0), (1.22, 1.34, 0.052), M)
        b.text('pintura_blanca', 'WP', 0.3, M @ T(0, -0.3, 0.051) @ Rx(-math.pi / 2), extrude=0.0005)


def plataformas_fuerza(b, L, M, nombre):
    """Par de plataformas de fuerza (salto / IMTP) encastradas, con tablet en soporte."""
    with b.p(nombre):
        for s in (-1, 1):
            b.box('aluminio', (s * 0.31 - 0.3, -0.2, 0.0), (s * 0.31 + 0.3, 0.2, 0.05), M)
            b.box('plastico_negro', (s * 0.31 - 0.28, -0.18, 0.05), (s * 0.31 + 0.28, 0.18, 0.052), M)
            b.text('pintura_blanca', 'FORCE', 0.05, M @ T(s * 0.31, 0.15, 0.0525) @ Rx(-math.pi / 2), extrude=0.0003)
        b.cyl('acero_negro', 0.004, -0.0, 0.9, 5, M @ T(0.0, 0.22, 0.02) @ Rx(-math.pi / 2) @ Ry(0))
        b.cyl('acero_negro', 0.02, 0.0, 1.15, 10, M @ T(1.0, 0.35, 0))
        b.box('acero_negro', (0.75, 0.1, 0.0), (1.25, 0.6, 0.02), M)
        b.box('plastico_negro', (0.86, 0.33, 1.1), (1.14, 0.35, 1.32), M @ T(0, 0, 0))
    with L.p(nombre + '_Pantalla'):
        L.box('pantalla', (0.875, 0.3295, 1.115), (1.125, 0.33, 1.305), M)


def rack(b, P, M, variante, rnd, n):
    """Power rack 1.24 x 1.2 x 2.35 m sobre plataforma. Frente en y=0 mirando a -y."""
    z0 = 0.05
    H = 2.35
    nom = f'Rack_{n}'
    with b.p(nom):
        for x in (-0.585, 0.585):
            for y in (0.04, 1.16):
                tubo(b, M, x, y, z0, z0 + H)
            b.box('acero_negro', (x - 0.04, -0.15, z0), (x + 0.04, 1.3, z0 + 0.06), M)
        b.box('acero_negro', (-0.62, 1.12, z0 + 0.06), (0.62, 1.2, z0 + 0.14), M)
        b.box('acero_negro', (-0.62, 1.12, z0 + H - 0.08), (0.62, 1.2, z0 + H), M)
        for x in (-0.585, 0.585):
            b.box('acero_negro', (x - 0.0375, 0.08, z0 + H - 0.08), (x + 0.0375, 1.12, z0 + H), M)
        b.box('pintura_club', (-0.55, 0.0, z0 + H - 0.2), (0.55, 0.08, z0 + H), M)
        b.text('pintura_blanca', 'WATERPOLO', 0.085, M @ T(0, -0.006, z0 + H - 0.1), extrude=0.003, bold=True)
        for x in (-0.585, 0.585):
            b.cyl('acero_inox', 0.012, z0, z0 + 0.12, 8, M @ T(x * 1.1, -0.12, 0))
    with b.p(nom + '_Barra_Dominadas'):
        b.cyl_between('moleteado', P3(M, -0.62, -0.06, z0 + H - 0.04), P3(M, 0.62, -0.06, z0 + H - 0.04), 0.016, 12)
        for x in (-0.585, 0.585):
            b.box('acero_negro', (x - 0.03, -0.09, z0 + H - 0.07), (x + 0.03, 0.0, z0 + H - 0.01), M)
    zj = z0 + 1.42
    for lado, x in (('Izq', -0.585), ('Der', 0.585)):
        with b.p(f'{nom}_Gancho_J_{lado}'):
            b.box('acero_negro', (x - 0.04, -0.12, zj - 0.06), (x + 0.04, 0.0, zj + 0.08), M)
            b.box('plastico_negro', (x - 0.035, -0.11, zj - 0.005), (x + 0.035, -0.02, zj + 0.005), M)
            b.box('acero_negro', (x - 0.04, -0.13, zj), (x + 0.04, -0.11, zj + 0.07), M)
        with b.p(f'{nom}_Brazo_Seguridad_{lado}'):
            b.box('acero_negro', (x - 0.035, -0.62, z0 + 0.82), (x + 0.035, 0.0, z0 + 0.9), M)
            b.box('plastico_negro', (x - 0.035, -0.62, z0 + 0.9), (x + 0.035, -0.02, z0 + 0.915), M)
    # portadiscos en los postes traseros (cargados)
    for s, lado in ((-1, 'Izq'), (1, 'Der')):
        for zh, carga, niv in ((z0 + 0.32, (25, 25, 20, 20), 'Bajo'), (z0 + 0.85, (15, 10, 10, 5, 5, 2.5), 'Alto')):
            with b.p(f'{nom}_Portadiscos_{lado}_{niv}'):
                b.cyl_between('cromo', P3(M, s * 0.62, 1.16, zh), P3(M, s * 0.95, 1.16, zh), 0.024, 12)
            off = 0.64
            for kg in carga:
                t = GROSOR[kg]
                disco(b, M @ T(s * (off + t / 2), 1.16, zh) @ Ry(math.pi / 2), kg)
                off += t + 0.003
    # contenido de la estación
    if variante == 'fuerza':
        barra(b, M @ T(0, -0.07, zj + 0.03))
        plataformas_fuerza(b, P['luz'], M @ T(0, -1.45, z0 - 0.04), nom + '_Plataformas_Fuerza')
    elif variante == 'peso_muerto':
        barra(b, M @ T(0, -1.25, z0 + 0.225), (25, 20, 10))
    elif variante == 'hex':
        barra_hex(b, M @ T(0, -1.3, z0 + 0.225), (20, 10))
        barra(b, M @ T(0, -0.07, zj + 0.03))
    elif variante == 'ssb':
        barra_ssb(b, M @ T(0, -0.07, zj + 0.12), (20,))
        banco_plano(b, M @ T(0, -1.6, z0) @ Rz(math.pi / 2), largo=1.2)
    elif variante == 'banca':
        barra(b, M @ T(0, -0.07, zj + 0.03), (20, 5))
        banco_plano(b, M @ T(0, 0.55, z0) @ Rz(math.pi / 2), largo=1.25)
    elif variante == 'landmine':
        barra(b, M @ T(0, -0.07, zj + 0.03), (15,))
        with b.p(nom + '_Landmine'):
            b.box('acero_negro', (0.75, -2.3, z0), (1.05, -2.0, z0 + 0.02), M)
            b.cyl('cromo', 0.035, z0 + 0.02, z0 + 0.12, 12, M @ T(0.9, -2.15, 0))
        # barra apoyada en el landmine hacia la plataforma
        p0 = P3(M, 0.9, -2.15, z0 + 0.12)
        p1 = P3(M, -0.3, -0.9, z0 + 0.6)
        with b.p(nom + '_Barra_Landmine'):
            b.cyl_between('moleteado', p0, p1, 0.014, 10)
        with b.p(nom + '_Disco_Landmine'):
            mz, _L = align_z(p0, p1)
            disco(b, mz @ T(0, 0, _L - 0.05), 10)
    elif variante == 'ez':
        barra(b, M @ T(0, -0.07, zj + 0.03))
        barra_ez(b, M @ T(0, -1.0, z0 + 0.17) @ Rz(0.06), (10,))
        plataformas_fuerza(b, P['luz'], M @ T(0, -1.75, z0 - 0.04), nom + '_Plataformas_Fuerza')
    else:   # cajas
        barra(b, M @ T(0, -0.07, zj + 0.03), (15,))
        caja_plio(b, M @ T(-0.95, -2.2, z0), 0.6, 0.5, 0.45, 'Caja_Pliometrica_45cm')
        caja_plio(b, M @ T(-0.95, -1.6, z0), 0.6, 0.5, 0.45, 'Caja_Pliometrica_45cm')


def soporte_magnesio(b, M):
    with b.p('Soporte_Magnesio'):
        b.lathe('acero_negro', [(0.0, 0.0), (0.22, 0.0), (0.22, 0.03), (0.0, 0.03)], 16, M)
        b.cyl('acero_negro', 0.025, 0.03, 0.9, 10, M)
        b.lathe('acero_inox', [(0.0, 0.9), (0.2, 0.9), (0.23, 1.05), (0.21, 1.05), (0.19, 0.93), (0.0, 0.93)], 20, M)
        b.cyl('pintura_blanca', 0.19, 0.93, 0.98, 20, M, tint=(1.05, 1.05, 1.05))
        b.box('pintura_blanca', (-0.05, -0.04, 0.98), (0.05, 0.04, 1.03), M)


# ---------------------------------------------------------------------------
# ALMACENAJE
# ---------------------------------------------------------------------------
def rack_mancuernas(b, M, pesos, n):
    """Rack de 2 alturas, 3.6 m, frente hacia -y."""
    L = 3.6
    with b.p(f'Rack_Mancuernas_{n}'):
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


def soporte_barras(b, M):
    with b.p('Soporte_Barras'):
        b.box('acero_negro', (-0.45, -0.25, 0), (0.45, 0.25, 0.08), M)
        for i in range(6):
            b.cyl('acero_negro', 0.035, 0.08, 0.2, 10, M @ T(-0.35 + i * 0.14, 0, 0))
    for i in range(6):
        x = -0.35 + i * 0.14
        tipo = 'H20' if i < 4 else 'M15'
        with b.p('Barra_Olimpica_20kg' if tipo == 'H20' else 'Barra_Olimpica_15kg'):
            b.cyl('moleteado', 0.014 if tipo == 'H20' else 0.0125, 0.2, 1.5, 10, M @ T(x, 0, 0))
            b.cyl('cromo', 0.025, 1.5, 1.92 if tipo == 'H20' else 1.82, 10, M @ T(x, 0, 0))
            b.cyl('cromo', 0.035, 1.48, 1.52, 10, M @ T(x, 0, 0))


def soporte_barras_especiales(b, M):
    """Soporte de pared con 2 barras hexagonales colgadas y barras EZ."""
    with b.p('Soporte_Barras_Especiales'):
        b.box('acero_negro', (-0.9, 0.0, 0.0), (0.9, 0.08, 1.9), M)
        for x in (-0.55, 0.55):
            for z in (0.6, 1.4):
                b.box('acero_negro', (x - 0.04, -0.25, z), (x + 0.04, 0.0, z + 0.06), M)
    barra_hex(b, M @ T(-0.55, -0.2, 1.05) @ Rx(math.pi / 2) @ Rz(math.pi / 2))
    barra_ez(b, M @ T(0.0, -0.12, 0.62))
    barra_ez(b, M @ T(0.0, -0.12, 1.42))


def arbol_discos(b, M, carga, n):
    with b.p(f'Arbol_Discos_{n}'):
        b.box('acero_negro', (-0.3, -0.3, 0), (0.3, 0.3, 0.06), M)
        b.box('acero_negro', (-0.04, -0.04, 0.06), (0.04, 0.04, 1.3), M)
        for k, (z, s) in enumerate(((0.3, 1), (0.3, -1), (0.75, 1), (0.75, -1), (1.15, 1), (1.15, -1))):
            b.cyl_between('cromo', P3(M, 0, s * 0.04, z), P3(M, 0, s * 0.3, z + 0.03), 0.024, 10)
    for k, (z, s) in enumerate(((0.3, 1), (0.3, -1), (0.75, 1), (0.75, -1), (1.15, 1), (1.15, -1))):
        off = 0.06
        for kg in carga[k % len(carga)]:
            t = GROSOR[kg]
            disco(b, M @ T(0, s * (off + t / 2), z) @ Rx(math.pi / 2), kg)
            off += t + 0.003


def estante_kettlebells(b, M):
    with b.p('Estante_Kettlebells'):
        for z in (0.02, 0.45):
            b.box('acero_negro', (0.0, 0.0, z + 0.3), (2.0, 0.5, z + 0.34), M)
        for x in (0.02, 1.98):
            b.box('acero_negro', (x - 0.02, 0.0, 0), (x + 0.02, 0.5, 0.82), M)
    for i, kg in enumerate((8, 12, 16, 20, 24, 28, 32)):
        kettlebell(b, M @ T(0.18 + i * 0.27, 0.25, 0.36), kg)
        kettlebell(b, M @ T(0.18 + i * 0.27, 0.25, 0.79), kg)


def estante_balones(b, M):
    with b.p('Estante_Balones_Medicinales'):
        for z in (0.35, 0.9, 1.45):
            b.box('acero_negro', (0.05, 0.0, z), (0.5, 2.6, z + 0.04), M)
        for y in (0.02, 1.3, 2.58):
            b.box('acero_negro', (0.05, y - 0.02, 0), (0.5, y + 0.02, 1.8), M)
    cols = [(0.78, 0.07, 0.06), (0.05, 0.22, 0.65), (0.95, 0.74, 0.05), (0.1, 0.5, 0.18), (0.08, 0.08, 0.08)]
    for zi, z in enumerate((0.39, 0.94, 1.49)):
        for k in range(6):
            r = 0.15 + 0.01 * zi
            balon_medicinal(b, M @ T(0.28, 0.25 + k * 0.42, z + r), r, cols[(k + zi) % 5],
                            f'Balon_Medicinal_{(3, 5, 7)[zi]}kg')


def colgador_cinturones(b, M):
    """Panel de pared con cinturones de halterofilia, collarines y gomas."""
    with b.p('Colgador_Cinturones'):
        b.box('madera_oscura', (0, -0.03, 0.9), (1.4, 0.0, 2.1), M)
        for k in range(5):
            b.cyl('acero_inox', 0.012, 0.0, 0.12, 8, M @ T(0.18 + k * 0.26, -0.03, 1.85) @ Rx(math.pi / 2))
    for k in range(5):
        with b.p('Cinturon_Halterofilia'):
            b.box('pad_negro', (-0.06, -0.09, 1.25), (0.06, -0.05, 1.85), M @ T(0.18 + k * 0.26, 0, 0),
                  tint=(0.25, 0.15, 0.08) if k % 2 else (1, 1, 1))
    for k in range(4):
        with b.p('Goma_Resistencia'):
            b.torus('goma_bumper', 0.12, 0.012, 20, 4, M @ T(0.25 + k * 0.3, -0.06, 1.05) @ Rx(math.pi / 2),
                    tint=[(0.8, 0.1, 0.1), (0.1, 0.2, 0.7), (0.1, 0.5, 0.2), (0.1, 0.1, 0.1)][k])


# ---------------------------------------------------------------------------
# ACONDICIONAMIENTO
# ---------------------------------------------------------------------------
def remoergometro(b, M, n):
    """Remoergómetro de aire. Eje longitudinal x, usuario mira a -x."""
    with b.p(f'Remoergometro_{n}'):
        b.box('aluminio', (0.35, -0.035, 0.33), (2.42, 0.035, 0.39), M)
        b.box('acero_negro', (2.3, -0.28, 0.0), (2.38, 0.28, 0.06), M)
        b.box('acero_negro', (2.3, -0.03, 0.06), (2.38, 0.03, 0.33), M)
        b.box('acero_negro', (0.22, -0.3, 0.0), (0.32, 0.3, 0.07), M)
        b.box('acero_negro', (0.25, -0.05, 0.07), (0.4, 0.05, 0.42), M)
        b.cyl('plastico_negro', 0.27, -0.16, 0.16, 24, M @ T(0.18, 0, 0.56) @ Rx(math.pi / 2))
        b.cyl('acero_negro', 0.08, -0.17, 0.17, 12, M @ T(0.18, 0, 0.56) @ Rx(math.pi / 2))
        b.box('plastico_negro', (0.0, -0.18, 0.25), (0.42, 0.18, 0.36), M)
        for s in (-1, 1):
            b.box('plastico_negro', (-0.06, s * 0.03, -0.12), (0.06, s * 0.16, 0.18), M @ T(0.58, 0, 0.42) @ Ry(0.6))
        b.box('pad_negro', (1.25, -0.16, 0.42), (1.6, 0.16, 0.49), M)
        b.box('acero_negro', (1.3, -0.06, 0.39), (1.55, 0.06, 0.42), M)
        b.cyl('acero_negro', 0.018, -0.27, 0.27, 10, M @ T(0.47, 0, 0.66) @ Rx(math.pi / 2))
        b.cyl('plastico_negro', 0.022, 0.12, 0.27, 10, M @ T(0.47, 0, 0.66) @ Rx(math.pi / 2))
        b.cyl('plastico_negro', 0.022, -0.27, -0.12, 10, M @ T(0.47, 0, 0.66) @ Rx(math.pi / 2))
        b.cyl_between('acero_negro', P3(M, 0.25, 0, 0.8), P3(M, 0.55, 0, 1.15), 0.015, 8)
        b.box('plastico_negro', (-0.03, -0.11, -0.09), (0.03, 0.11, 0.09), M @ T(0.58, 0, 1.15) @ Ry(-0.4))
        b.box('plastico_blanco', (-0.0305, -0.08, -0.06), (-0.029, 0.08, 0.06), M @ T(0.6, 0, 1.15) @ Ry(math.pi - 0.4),
              tint=(0.55, 0.62, 0.55))


def ergometro_natacion(b, M, n):
    """Ergómetro de natación (tipo Vasa): banco deslizante inclinado, nadador boca abajo; volante delante (-x)."""
    with b.p(f'Ergometro_Natacion_{n}'):
        inc = math.radians(9)
        Mr = M @ T(0.3, 0, 0.35) @ Ry(-inc)
        b.box('aluminio', (0.0, -0.06, -0.03), (2.3, 0.06, 0.03), Mr)
        b.box('acero_negro', (2.15, -0.25, -0.75), (2.25, 0.25, -0.0), M @ T(0.3, 0, 0.35) @ Ry(-inc) @ T(0, 0, 0))
        b.box('acero_negro', (2.1, -0.3, 0.0), (2.6, 0.3, 0.05), M)
        b.box('acero_negro', (0.0, -0.3, 0.0), (0.45, 0.3, 0.06), M)
        b.box('acero_negro', (0.2, -0.04, 0.06), (0.32, 0.04, 0.38), M)
        b.box('pad_negro', (0.9, -0.2, 0.04), (1.75, 0.2, 0.12), Mr, tint=(0.05, 0.12, 0.3))
        b.cyl('plastico_negro', 0.24, -0.12, 0.12, 24, M @ T(0.12, 0, 0.72) @ Rx(math.pi / 2))
        b.box('acero_negro', (0.05, -0.05, 0.38), (0.2, 0.05, 0.62), M)
        for s in (-1, 1):
            b.cyl_between('acero_negro', P3(M, 0.15, s * 0.1, 0.75), P3(M, 0.55, s * 0.32, 0.55), 0.004, 4)
            b.box('plastico_negro', (0.5, s * 0.32 - 0.06, 0.5), (0.62, s * 0.32 + 0.06, 0.58), M)
        b.box('plastico_negro', (0.05, -0.1, 1.0), (0.12, 0.1, 1.14), M)


def cinta_curva(b, M, n):
    """Cinta curva no motorizada (tipo Woodway Curve). Largo en x."""
    with b.p(f'Cinta_Curva_{n}'):
        for s in (-1, 1):
            b.box('plastico_negro', (0.0, s * 0.42 - 0.05, 0.05), (1.9, s * 0.42 + 0.05, 0.35), M)
            b.cyl_between('acero_negro', P3(M, 0.15, s * 0.42, 0.35), P3(M, 0.25, s * 0.42, 1.2), 0.025, 10)
            b.cyl_between('acero_negro', P3(M, 0.25, s * 0.42, 1.2), P3(M, 1.1, s * 0.42, 1.0), 0.02, 10)
        b.cyl_between('acero_negro', P3(M, 0.25, -0.42, 1.2), P3(M, 0.25, 0.42, 1.2), 0.02, 10)
        # cubierta curva de lamas
        for k in range(26):
            u = k / 25
            x = 0.12 + u * 1.66
            z = 0.12 + 0.11 * (2 * u - 1) ** 2
            b.box('goma_gym', (x - 0.03, -0.35, z - 0.012), (x + 0.03, 0.35, z + 0.012), M, tint=(0.6, 0.6, 0.6))
        b.box('plastico_negro', (0.15, -0.2, 1.22), (0.35, 0.2, 1.4), M @ T(0, 0, 0))
        b.box('plastico_blanco', (0.149, -0.15, 1.25), (0.15, 0.15, 1.37), M, tint=(0.4, 0.5, 0.45))


def bici_aire(b, M, n):
    with b.p(f'Bici_Aire_{n}'):
        b.cyl('plastico_negro', 0.33, -0.14, 0.14, 24, M @ T(0.0, 0, 0.45) @ Rx(math.pi / 2))
        b.box('acero_negro', (-0.1, -0.3, 0.0), (0.1, 0.3, 0.06), M)
        b.box('acero_negro', (1.0, -0.3, 0.0), (1.15, 0.3, 0.06), M)
        b.cyl_between('acero_negro', P3(M, 0.1, 0, 0.3), P3(M, 1.05, 0, 0.05), 0.035, 8)
        b.cyl_between('acero_negro', P3(M, 0.65, 0, 0.3), P3(M, 0.85, 0, 0.95), 0.03, 8)
        b.box('pad_negro', (0.72, -0.13, 0.95), (1.02, 0.13, 1.02), M)
        for s in (-1, 1):
            b.cyl_between('acero_negro', P3(M, 0.25, s * 0.2, 0.5), P3(M, 0.45, s * 0.25, 1.3), 0.018, 8)
        b.box('plastico_negro', (0.28, -0.08, 1.05), (0.36, 0.08, 1.17), M)


def skierg(b, M, n):
    with b.p(f'SkiErg_{n}'):
        b.box('acero_negro', (-0.1, 0.0, 0.0), (0.1, 0.12, 2.25), M)
        b.box('plastico_negro', (-0.18, -0.05, 1.9), (0.18, 0.12, 2.3), M)
        b.box('acero_negro', (-0.4, -0.5, 0.0), (0.4, 0.12, 0.04), M)
        for s in (-1, 1):
            b.cyl('plastico_negro', 0.02, 1.55, 1.75, 8, M @ T(s * 0.13, -0.06, 0))
        b.box('plastico_negro', (-0.06, -0.05, 1.45), (0.06, -0.03, 1.55), M)


# ---------------------------------------------------------------------------
# MÁQUINAS
# ---------------------------------------------------------------------------
def pila_placas(b, M, n=18):
    for k in range(n):
        z = 0.12 + k * 0.045
        b.box('acero_negro', (-0.2, -0.08, z), (0.2, 0.08, z + 0.04), M, tint=(1.4, 1.4, 1.4))
    for gx in (-0.15, 0.15):
        b.cyl('cromo', 0.01, 0.08, 1.0 + n * 0.045, 8, M @ T(gx, 0, 0))


def poleas(b, M):
    """Funcional / cruce de poleas: 2 torres con pilas de placas."""
    with b.p('Poleas_Funcional'):
        for s, x in ((-1, 0.0), (1, 3.2)):
            Mt = M @ T(x, 0, 0)
            for (px, py) in ((-0.3, -0.25), (0.3, -0.25), (-0.3, 0.25), (0.3, 0.25)):
                b.box('acero_negro', (px - 0.04, py - 0.04, 0), (px + 0.04, py + 0.04, 2.3), Mt)
            b.box('acero_negro', (-0.35, -0.3, 2.3), (0.35, 0.3, 2.4), Mt)
            b.box('acero_negro', (-0.35, -0.3, 0.0), (0.35, 0.3, 0.08), Mt)
            pila_placas(b, Mt)
            b.box('cromo', (-0.06, -0.33, 0.1), (0.06, -0.27, 2.25), Mt)
            b.cyl('plastico_negro', 0.06, -0.025, 0.025, 16, Mt @ T(0, -0.36, 1.6) @ Ry(math.pi / 2))
            b.cyl('acero_negro', 0.004, 0.25, 1.55, 6, Mt @ T(0, -0.42, 0))
            b.box('acero_inox', (-0.12, -0.45, 0.2), (0.12, -0.41, 0.24), Mt)
        b.box('acero_negro', (0.0, -0.06, 2.3), (3.2, 0.06, 2.42), M)
        b.cyl_between('moleteado', P3(M, 0.4, -0.35, 2.2), P3(M, 2.8, -0.35, 2.2), 0.016)


def jalon_remo(b, M):
    """Estación jalón al pecho + remo sentado con pila de placas. Usuario mira a +y."""
    with b.p('Jalon_Remo'):
        b.box('acero_negro', (-0.35, 0.3, 0), (0.35, 0.8, 0.08), M)
        for x in (-0.3, 0.3):
            b.box('acero_negro', (x - 0.04, 0.6, 0.08), (x + 0.04, 0.68, 2.3), M)
        b.box('acero_negro', (-0.35, 0.2, 2.25), (0.35, 0.7, 2.35), M)
        pila_placas(b, M @ T(0, 0.64, 0), 16)
        b.box('acero_negro', (-0.06, -1.0, 0.0), (0.06, 0.3, 0.08), M)
        b.box('pad_negro', (-0.22, -0.2, 0.45), (0.22, 0.15, 0.52), M)
        b.box('acero_negro', (-0.04, -0.05, 0.08), (0.04, 0.05, 0.45), M)
        for s in (-1, 1):
            b.cyl('pad_negro', 0.06, -0.12, 0.12, 12, M @ T(s * 0.13, 0.12, 0.7) @ Ry(math.pi / 2))
        b.cyl_between('acero_negro', P3(M, 0, 0.12, 0.7), P3(M, 0, 0.12, 0.52), 0.02)
        b.cyl_between('cromo', P3(M, -0.55, 0.1, 1.95), P3(M, 0.55, 0.1, 1.95), 0.016)
        b.cyl('acero_negro', 0.004, 1.95, 2.3, 4, M @ T(0, 0.1, 0))
        b.box('acero_negro', (-0.2, -0.95, 0.08), (0.2, -0.85, 0.35), M @ Rx(0.3))
        b.box('acero_inox', (-0.15, 0.3, 0.3), (0.15, 0.33, 0.34), M)


def prensa_45(b, M):
    """Prensa de piernas 45° de discos. Carro a lo largo de +y."""
    with b.p('Prensa_Piernas_45'):
        a = math.radians(45)
        b.box('acero_negro', (-0.7, -0.3, 0), (0.7, 2.2, 0.1), M)
        for x in (-0.45, 0.45):
            b.box('acero_negro', (x - 0.05, 0.0, -0.05), (x + 0.05, 2.3, 0.05), M @ T(0, 0.2, 0.25) @ Rx(a))
        for x in (-0.45, 0.45):
            b.box('acero_negro', (x - 0.05, 1.65, 0.1), (x + 0.05, 1.75, 1.85), M)
        b.box('acero_negro', (-0.5, 1.65, 1.75), (0.5, 1.75, 1.85), M)
        b.box('acero_negro', (-0.5, 1.65, 0.1), (0.5, 1.75, 0.25), M)
        b.box('pad_negro', (-0.3, -0.25, 0.3), (0.3, 0.35, 0.4), M)
        b.box('pad_negro', (-0.3, -0.25, 0.3), (0.3, 0.45, 0.4), M @ T(0, -0.25, 0.35) @ Rx(-math.radians(60)))
        Mc = M @ T(0, 0.2, 0.25) @ Rx(a) @ T(0, 1.15, 0.12)
        b.box('aluminio', (-0.45, -0.05, 0.0), (0.45, 0.3, 0.6), Mc)
        b.box('acero_negro', (-0.45, 0.3, 0.0), (0.45, 0.42, 0.6), Mc)
        for s in (-1, 1):
            b.cyl('cromo', 0.025, 0.0, 0.3, 12, Mc @ T(s * 0.45, 0.2, 0.3) @ Ry(s * math.pi / 2))
    Mc = M @ T(0, 0.2, 0.25) @ Rx(math.radians(45)) @ T(0, 1.15, 0.12)
    for s in (-1, 1):
        off = 0.47
        for kg in (20, 20):
            disco(b, Mc @ T(s * (off + GROSOR[kg] / 2), 0.2, 0.3) @ Ry(math.pi / 2), kg)
            off += GROSOR[kg] + 0.003


def belt_squat(b, M):
    """Belt squat de palanca con plataforma y cinturón."""
    with b.p('Belt_Squat'):
        b.box('acero_negro', (-0.8, -0.6, 0), (0.8, 0.6, 0.12), M)
        b.box('goma_gym', (-0.35, -0.35, 0.12), (0.35, 0.35, 0.14), M, tint=(0.8, 0.8, 0.8))
        for x in (-0.65, 0.65):
            b.box('acero_negro', (x - 0.04, -0.04, 0.12), (x + 0.04, 0.04, 1.2), M)
        b.cyl_between('moleteado', P3(M, -0.65, -0.3, 1.1), P3(M, 0.65, -0.3, 1.1), 0.016)
        b.box('acero_negro', (-0.04, 0.4, 0.12), (0.04, 0.6, 0.6), M)
        b.box('acero_negro', (-0.04, -0.5, 0.0), (0.04, 0.0, 0.08), M @ T(0, 0.5, 0.55) @ Rx(-0.35))
        b.cyl('cromo', 0.025, 0.0, 0.3, 12, M @ T(0, 0.55, 0.6) @ Ry(math.pi / 2))
        b.cyl('acero_negro', 0.004, 0.14, 0.55, 4, M @ T(0, 0.0, 0))
        b.torus('pad_negro', 0.18, 0.03, 16, 4, M @ T(0, 0, 0.6))
    disco(b, M @ T(0.17, 0.55, 0.6) @ Ry(math.pi / 2), 25)


def ghd(b, M):
    """Glute-ham developer. Largo en x, pies en +x."""
    with b.p('GHD'):
        b.box('acero_negro', (-0.9, -0.3, 0), (0.9, 0.3, 0.08), M)
        b.box('acero_negro', (-0.05, -0.05, 0.08), (0.05, 0.05, 0.85), M)
        b.box('pad_negro', (-0.15, -0.2, 0.85), (0.35, 0.2, 1.0), M)
        b.cyl('pad_negro', 0.1, -0.2, 0.2, 14, M @ T(0.12, 0, 1.0) @ Rx(math.pi / 2))
        b.box('acero_negro', (0.62, -0.25, 0.08), (0.72, 0.25, 0.85), M)
        b.box('acero_inox', (0.55, -0.22, 0.25), (0.8, 0.22, 0.28), M)
        for z in (0.68, 0.84):
            b.cyl('pad_negro', 0.05, -0.18, 0.18, 12, M @ T(0.6, 0, z) @ Rx(math.pi / 2))


def hiper_inversa(b, M):
    with b.p('Hiperextension_Inversa'):
        b.box('acero_negro', (-0.6, -0.35, 0), (0.6, 0.35, 0.08), M)
        for x in (-0.45, 0.2):
            b.box('acero_negro', (x - 0.04, -0.04, 0.08), (x + 0.04, 0.04, 1.0), M)
        b.box('pad_negro', (-0.6, -0.22, 1.0), (0.25, 0.22, 1.12), M)
        for s in (-1, 1):
            b.cyl('pad_negro', 0.04, 0.0, 0.25, 10, M @ T(-0.55, s * 0.25, 1.05) @ Rx(math.pi / 2))
        b.cyl_between('acero_negro', P3(M, 0.25, 0, 0.95), P3(M, 0.55, 0, 0.3), 0.025)
        b.box('pad_negro', (0.45, -0.18, 0.22), (0.62, 0.18, 0.32), M)


def banco_nordico(b, M):
    with b.p('Banco_Nordicos'):
        b.box('acero_negro', (-0.85, -0.3, 0), (0.85, 0.3, 0.08), M)
        b.box('pad_negro', (-0.7, -0.25, 0.08), (0.45, 0.25, 0.18), M)
        b.box('acero_negro', (0.55, -0.05, 0.08), (0.65, 0.05, 0.45), M)
        for s in (-1, 1):
            b.cyl('pad_negro', 0.05, 0.0, 0.18, 12, M @ T(0.6, s * 0.03, 0.4) @ Rx(-s * math.pi / 2))


# ---------------------------------------------------------------------------
# FUNCIONAL
# ---------------------------------------------------------------------------
def rig(b, M, L=7.4, D=1.2, H=3.0):
    """Rig funcional libre (3 módulos) con anillas, TRX, cuerda de trepa y barras de monos."""
    xs = [0.0, L / 3, 2 * L / 3, L]
    with b.p('Rig_Funcional'):
        for x in xs:
            for y in (0.0, D):
                tubo(b, M, x, y, 0, H, mat='acero_rack', s=0.08)
                b.box('acero_negro', (x - 0.12, y - 0.12, 0), (x + 0.12, y + 0.12, 0.015), M)
        for y in (0.0, D):
            b.box('acero_negro', (0, y - 0.04, H - 0.08), (L, y + 0.04, H), M)
        for x in xs:
            b.box('acero_negro', (x - 0.04, 0, H - 0.08), (x + 0.04, D, H), M)
        b.box('pintura_club', (L / 3 + 0.2, -0.045, H - 0.3), (2 * L / 3 - 0.2, 0.045, H - 0.1), M)
        b.text('pintura_blanca', 'WATERPOLO · PREPARACIÓN FÍSICA', 0.1, M @ T(L / 2, -0.05, H - 0.2), extrude=0.002)
        for i in range(3):
            x0, x1 = xs[i], xs[i + 1]
            b.cyl_between('moleteado', P3(M, x0, -0.12, H - 0.25), P3(M, x1, -0.12, H - 0.25), 0.016, 10)
            b.cyl_between('moleteado', P3(M, x0, D + 0.12, H - 0.25), P3(M, x1, D + 0.12, H - 0.25), 0.016, 10)
        for k in range(8):
            y = 0.12 + k * (D - 0.24) / 7
            b.cyl_between('moleteado', P3(M, xs[1], y, H - 0.04), P3(M, xs[2], y, H - 0.04), 0.016, 8)
        # anclajes de gomas (hombro / manguito rotador, clave en waterpolo)
        for x in xs:
            for z in (0.5, 1.0, 1.5):
                b.cyl('cromo', 0.012, 0.0, 0.12, 8, M @ T(x, -0.04, z) @ Rx(math.pi / 2))
    x_an = xs[0] + L / 6
    with b.p('Anillas'):
        for s in (-1, 1):
            p0 = P3(M, x_an + s * 0.25, D / 2, H - 0.05)
            p1 = P3(M, x_an + s * 0.25, D / 2, 1.85)
            b.cyl_between('tela', p0, p1, 0.012, 4, tint=NEGRO)
            b.torus('madera_clara', 0.11, 0.016, 20, 6, M @ T(x_an + s * 0.25, D / 2, 1.73) @ Rx(math.pi / 2))
    x_trx = xs[1] + L / 6
    with b.p('TRX'):
        b.cyl_between('tela', P3(M, x_trx, D / 2, H - 0.05), P3(M, x_trx, D / 2, 2.3), 0.015, 4, tint=(0.8, 0.7, 0.05))
        for s in (-1, 1):
            b.cyl_between('tela', P3(M, x_trx, D / 2, 2.3), P3(M, x_trx + s * 0.08, D / 2, 1.3), 0.012, 4, tint=NEGRO)
            b.cyl('plastico_negro', 0.018, -0.08, 0.08, 8, M @ T(x_trx + s * 0.08, D / 2, 1.25) @ Ry(math.pi / 2))
    x_cu = xs[2] + L / 6
    with b.p('Cuerda_Trepa'):
        b.cyl_between('tela', P3(M, x_cu, D / 2, H - 0.05), P3(M, x_cu + 0.05, D / 2, 0.05), 0.019, 8,
                      tint=(0.75, 0.6, 0.38))
    with b.p('Cuerdas_Batalla'):
        pa = Vector(P3(M, L, -0.05, 0.12))
        for s in (-1, 1):
            prev = pa
            for k in range(1, 25):
                u = k / 24
                p = Vector(P3(M, L - u * 4.5, -0.25 - u * 1.2 + s * 0.25 * u, 0.04 + 0.03 * math.sin(u * 18)))
                b.cyl_between('tela', prev, p, 0.019, 6, tint=NEGRO)
                prev = p


def rebotador(b, M):
    """Rebotador inclinado (lanzamientos y recepciones con balón)."""
    with b.p('Rebotador_Balon'):
        a = math.radians(20)
        Mf = M @ T(0, 0, 0.35) @ Rx(-a)
        for (x0, z0, x1, z1) in ((-0.5, 0, 0.5, 0), (-0.5, 1.1, 0.5, 1.1), (-0.5, 0, -0.5, 1.1), (0.5, 0, 0.5, 1.1)):
            b.cyl_between('acero_negro', P3(Mf, x0, 0, z0), P3(Mf, x1, 0, z1), 0.022, 8)
        b.box('tela', (-0.46, -0.004, 0.04), (0.46, 0.004, 1.06), Mf, tint=(0.1, 0.1, 0.12))
        for s in (-1, 1):
            b.cyl_between('acero_negro', P3(M, s * 0.5, 0, 0.0), P3(Mf, s * 0.5, 0, 0.0), 0.022, 8)
            b.cyl_between('acero_negro', P3(M, s * 0.5, 0.6, 0.0), P3(Mf, s * 0.5, 0, 1.1), 0.022, 8)
            b.box('plastico_negro', (s * 0.5 - 0.05, -0.1, 0.0), (s * 0.5 + 0.05, 0.7, 0.03), M)


def caja_plio(b, M, w, d, h, nombre='Caja_Pliometrica'):
    with b.p(nombre):
        b.box('madera_clara', (0, 0, 0), (w, d, h), M)
        b.box('madera_oscura', (w * 0.3, -0.005, h * 0.75), (w * 0.7, 0.01, h * 0.85), M)


def fitball(b, M, r, tint):
    with b.p('Fitball'):
        b.sphere('plastico_blanco', r, 20, 12, M @ T(0, 0, r), tint=tint)


def bosu(b, M):
    with b.p('BOSU'):
        b.lathe('plastico_blanco', [(0.0, 0.0), (0.32, 0.0), (0.32, 0.03), (0.3, 0.1), (0.22, 0.2), (0.11, 0.25), (0.0, 0.26)],
                20, M, tint=(0.1, 0.25, 0.7))
        b.cyl('plastico_negro', 0.33, 0.0, 0.03, 20, M)


def espalderas(b, M, L=2.6, H=2.5):
    with b.p('Espalderas'):
        n = int(L / 0.9)
        for i in range(n + 1):
            x = L * i / n
            b.box('madera_clara', (x - 0.03, 0.0, 0), (x + 0.03, 0.08, H), M)
        for k in range(int(H / 0.15)):
            z = 0.15 + k * 0.15
            b.cyl('madera_clara', 0.017, 0, L, 8, M @ T(0, 0.04, z) @ Ry(math.pi / 2))


def trineo(b, M, n):
    with b.p(f'Trineo_{n}'):
        for s in (-1, 1):
            b.box('acero_negro', (-0.6, s * 0.3 - 0.03, 0.0), (0.6, s * 0.3 + 0.03, 0.05), M)
            b.cyl_between('acero_negro', P3(M, 0.4, s * 0.3, 0.05), P3(M, 0.6, s * 0.25, 1.25), 0.022)
            b.cyl_between('acero_negro', P3(M, 0.0, s * 0.3, 0.05), P3(M, 0.25, s * 0.25, 0.75), 0.022)
        b.box('acero_negro', (-0.6, -0.33, 0.0), (-0.55, 0.33, 0.05), M)
        b.cyl('cromo', 0.025, 0.05, 0.4, 12, M @ T(-0.2, 0, 0))
    z = 0.06
    for kg in (20, 20, 10):
        disco(b, M @ T(-0.2, 0, z + GROSOR[kg] / 2), kg)
        z += GROSOR[kg] + 0.002


def valla(b, M):
    with b.p('Valla_Velocidad'):
        for s in (-1, 1):
            b.box('plastico_blanco', (s * 0.3 - 0.015, -0.12, 0), (s * 0.3 + 0.015, 0.12, 0.012), M, tint=(0.95, 0.75, 0.05))
            b.box('plastico_blanco', (s * 0.3 - 0.012, -0.012, 0), (s * 0.3 + 0.012, 0.012, 0.3), M, tint=(0.95, 0.75, 0.05))
        b.box('plastico_blanco', (-0.31, -0.012, 0.28), (0.31, 0.012, 0.3), M, tint=(0.95, 0.75, 0.05))


def escalera_agilidad(b, M, L=4.0):
    with b.p('Escalera_Agilidad'):
        for s in (-1, 1):
            b.box('tela', (0, s * 0.25 - 0.012, 0), (L, s * 0.25 + 0.012, 0.004), M, tint=NEGRO)
        for k in range(int(L / 0.45) + 1):
            x = k * 0.45
            b.box('plastico_blanco', (x - 0.012, -0.25, 0), (x + 0.012, 0.25, 0.008), M, tint=(0.95, 0.75, 0.05))


def celula_crono(b, L, M, n):
    with b.p(f'Celula_Cronometraje_{n}'):
        for k in range(3):
            a = TAU * k / 3
            b.cyl_between('acero_negro', P3(M, 0.0, 0.0, 0.9), P3(M, 0.3 * math.cos(a), 0.3 * math.sin(a), 0.0), 0.012, 6)
        b.cyl('acero_negro', 0.015, 0.9, 1.0, 8, M)
        b.box('plastico_negro', (-0.05, -0.04, 1.0), (0.05, 0.04, 1.14), M)
    with L.p(f'Celula_Cronometraje_{n}_Led'):
        L.box('led_rojo', (-0.015, -0.041, 1.1), (0.015, -0.04, 1.12), M)


# ---------------------------------------------------------------------------
# TECNOLOGÍA Y PARED
# ---------------------------------------------------------------------------
def pizarra_entreno(b, P, M):
    with b.p('Pizarra_Entrenamiento'):
        b.box('aluminio', (-1.55, -0.03, 0.95), (1.55, 0.0, 2.45), M)
        b.box('pizarra_blanca', (-1.5, -0.035, 1.0), (1.5, -0.03, 2.4), M)
        lineas = [('ENTRENAMIENTO · MARTES · BLOQUE FUERZA', 'pintura_club', 0.09),
                  ('A1  SENTADILLA TRASERA  5 x 5 @ 80%  (VBT 0.55 m/s)', 'acero_negro', 0.06),
                  ('A2  SALTO CMJ PLATAFORMA DE FUERZA  3 x 3', 'acero_negro', 0.06),
                  ('B1  PRESS BANCA  4 x 6   ·   B2 DOMINADAS LASTRADAS 4 x 5', 'acero_negro', 0.06),
                  ('C   LANDMINE ROTACIONAL 3 x 8 + REBOTADOR 3 x 10', 'acero_negro', 0.06),
                  ('D   VASA 6 x 1 min  (crol / braza)  desc. 1 min', 'gorro_rojo', 0.06),
                  ('E   NÓRDICOS 3 x 5  ·  HOMBRO CON GOMAS 3 x 15', 'acero_negro', 0.06)]
        z = 2.27
        for txt, mat, sz in lineas:
            b.text(mat, txt, sz, M @ T(-1.42, -0.04, z), align='LEFT', extrude=0.001)
            z -= 0.185
        b.box('aluminio', (-1.5, -0.08, 0.95), (1.5, -0.03, 0.97), M)
        b.box('acero_negro', (-0.7, -0.08, 2.6), (0.7, 0.0, 3.0), M)
    with P['luz'].p('Reloj_Intervalos'):
        P['luz'].text('led_rojo', '12:00', 0.3, M @ T(-0.15, -0.085, 2.8), extrude=0.002)
        P['luz'].text('led_verde', '3/6', 0.16, M @ T(0.45, -0.085, 2.8), extrude=0.002)


def marcador_vbt(b, L, M):
    """Pantalla LED con el ranking de velocidad media (m/s) del día."""
    W, H = 5.4, 1.6
    with b.p('Marcador_LED_VBT'):
        b.box('acero_negro', (-W / 2 - 0.08, -0.12, -0.08), (W / 2 + 0.08, 0.0, H + 0.08), M)
    filas = [('1  CAPITÁN   SENTADILLA 140 kg', '0.62'), ('2  BOYA      SENTADILLA 150 kg', '0.58'),
             ('3  PORTERO   SENTADILLA 120 kg', '0.57'), ('4  EXTREMO   SENTADILLA 125 kg', '0.55'),
             ('5  DEFENSA   SENTADILLA 145 kg', '0.51')]
    with L.p('Marcador_LED_VBT_Pantalla'):
        L.box('pantalla', (-W / 2, -0.121, 0.0), (W / 2, -0.12, H), M)
        L.text('led_ambar', 'VELOCIDAD MEDIA · m/s', 0.17, M @ T(0, -0.124, H - 0.2), extrude=0.001)
        for i, (t, v) in enumerate(filas):
            z = H - 0.48 - i * 0.24
            L.text('led_blanco', t, 0.13, M @ T(-W / 2 + 0.25, -0.124, z), align='LEFT', extrude=0.001)
            L.text('led_verde' if i < 3 else 'led_ambar', v, 0.15, M @ T(W / 2 - 0.45, -0.124, z), extrude=0.001)
            ancho = (W - 3.2) * float(v) / 0.62
            L.box('led_verde' if i < 3 else 'led_ambar', (0.15, -0.123, z - 0.06), (0.15 + ancho * 0.6, -0.122, z + 0.06), M)


def mesa_preparador(b, L, M):
    with b.p('Mesa_Preparador'):
        b.box('madera_clara', (0, 0, 1.0), (1.4, 0.7, 1.04), M)
        for x in (0.1, 1.3):
            b.box('acero_negro', (x - 0.03, 0.1, 0), (x + 0.03, 0.6, 1.0), M)
        b.box('acero_inox', (0.4, 0.15, 1.04), (0.75, 0.4, 1.055), M)
        b.box('acero_inox', (0.4, 0.4, 1.05), (0.75, 0.41, 1.28), M)
    with L.p('Mesa_Preparador_Pantalla'):
        L.box('pantalla', (0.42, 0.395, 1.07), (0.73, 0.396, 1.26), M)


# ---------------------------------------------------------------------------
# SALA
# ---------------------------------------------------------------------------
def construir(B, rnd):
    S = B['Gimnasio_Sala']
    E = B['Gimnasio_Equipos']
    L_ = B['Centro_Luminarias']
    ESP = B['Centro_Espejos']
    P = {'luz': L_}
    M0 = GM

    # --- estaciones de fuerza: 2 filas x 4 enfrentadas
    xs = (7.0, 10.3, 13.6, 16.9)
    var_a = ('fuerza', 'peso_muerto', 'hex', 'ssb')
    var_b = ('banca', 'landmine', 'ez', 'cajas')
    for i, x in enumerate(xs):
        Ma = M0 @ T(x, 19.9, 0)
        plataforma(S, Ma, f'Plataforma_A{i + 1}', fuerza=var_a[i] == 'fuerza')
        rack(E, P, Ma, var_a[i], rnd, f'A{i + 1}')
        Mb = M0 @ T(x, 13.0, 0) @ Rz(math.pi)
        plataforma(S, Mb, f'Plataforma_B{i + 1}', fuerza=var_b[i] == 'ez')
        rack(E, P, Mb, var_b[i], rnd, f'B{i + 1}')
    for x in (8.65, 11.95, 15.25):
        soporte_magnesio(E, M0 @ T(x, 18.6, 0))
        soporte_magnesio(E, M0 @ T(x, 14.3, 0))

    # --- acondicionamiento (oeste)
    for k in range(4):
        remoergometro(E, M0 @ T(0.35, 19.6 - k * 1.05, 0), k + 1)
    for k in range(2):
        ergometro_natacion(E, M0 @ T(0.3, 15.25 - k * 1.15, 0), k + 1)
    for k in range(2):
        cinta_curva(E, M0 @ T(0.45, 12.55 - k * 1.1, 0), k + 1)
    for k in range(2):
        bici_aire(E, M0 @ T(0.6, 10.1 - k * 1.2, 0), k + 1)
    for k in range(2):
        skierg(E, M0 @ T(0.15, 7.7 - k * 1.0, 0) @ Rz(math.pi / 2), k + 1)
    estante_balones(E, M0 @ T(0.0, 3.0, 0))
    espalderas(E, M0 @ T(2.9, 21.32, 0) @ Rz(math.pi), L=2.6)
    colgador_cinturones(E, M0 @ T(3.3, 21.38, 0))

    # --- mancuernas 2.5 - 50 kg + bancos
    pesos = [2.5 * k for k in range(1, 21)]
    rack_mancuernas(E, M0 @ T(4.4, 10.6, 0), pesos[:10], 1)
    rack_mancuernas(E, M0 @ T(8.6, 10.6, 0), pesos[10:], 2)
    for i, x in enumerate((4.2, 6.6, 9.0, 11.4)):
        banco_regulable(E, M0 @ T(x, 8.4, 0) @ Rz(-math.pi / 2), ang=(0, 30, 45, 15)[i])
    mancuerna(E, M0 @ T(6.3, 7.45, 0.12) @ Rz(0.3), 30)
    mancuerna(E, M0 @ T(6.75, 7.55, 0.12) @ Rz(-0.2), 30)
    soporte_barras(E, M0 @ T(15.0, 10.5, 0))
    arbol_discos(E, M0 @ T(16.4, 10.2, 0), [(25, 25), (20, 20), (15, 10, 5)], 1)
    arbol_discos(E, M0 @ T(17.4, 10.2, 0), [(10, 10, 5), (2.5, 2.5, 1.25), (20, 15)], 2)
    soporte_barras_especiales(E, M0 @ T(13.3, 11.7, 0))

    # --- funcional: rig, cuerdas, rebotador, fitballs, BOSU, cajas
    rig(E, M0 @ T(4.0, 4.4, 0))
    rebotador(E, M0 @ T(12.1, 6.6, 0) @ Rz(math.pi / 2))
    for k, c in enumerate(((0.05, 0.22, 0.65), (0.6, 0.6, 0.62), (0.78, 0.07, 0.06))):
        fitball(E, M0 @ T(5.0 + k * 0.75, 6.9, 0), 0.32 + 0.02 * k, c)
    bosu(E, M0 @ T(7.6, 6.9, 0))
    bosu(E, M0 @ T(8.4, 6.9, 0))
    caja_plio(E, M0 @ T(9.3, 6.6, 0), 0.75, 0.6, 0.5, 'Caja_Pliometrica_50cm')
    caja_plio(E, M0 @ T(9.3, 6.6, 0.5), 0.75, 0.6, 0.3, 'Caja_Pliometrica_30cm')
    caja_plio(E, M0 @ T(10.15, 6.6, 0), 0.75, 0.6, 0.75, 'Caja_Pliometrica_75cm')

    # --- césped: trineos, vallas, escalera, células
    with S.p('Cesped_Trineo'):
        S.box('cesped_artificial', (3.5, 0.4, 0.0), (21.0, 2.6, 0.012), M0)
        for k in range(4):
            x = 4.0 + k * 5.0
            S.box('pintura_blanca', (x, 0.45, 0.012), (x + 0.06, 2.55, 0.014), M0)
            S.text('pintura_blanca', f'{k * 5}', 0.25, M0 @ T(x + 0.35, 1.5, 0.016) @ Rx(-math.pi / 2), extrude=0.001)
        for y in (0.45, 2.55):
            S.box('pintura_blanca', (3.5, y - 0.03, 0.012), (21.0, y + 0.03, 0.014), M0)
    trineo(E, M0 @ T(5.4, 1.5, 0.012), 1)
    trineo(E, M0 @ T(7.6, 1.5, 0.012) @ Rz(0.05), 2)
    for k in range(5):
        valla(E, M0 @ T(10.5 + k * 0.9, 1.5, 0.012) @ Rz(math.pi / 2))
    escalera_agilidad(E, M0 @ T(15.6, 1.5, 0.012), 4.5)
    celula_crono(E, L_, M0 @ T(4.0, 0.25, 0.012), 1)
    celula_crono(E, L_, M0 @ T(20.6, 0.25, 0.012), 2)

    # --- máquinas (sureste)
    poleas(E, M0 @ T(17.6, 4.2, 0))
    jalon_remo(E, M0 @ T(13.4, 4.0, 0))
    ghd(E, M0 @ T(15.6, 4.3, 0))
    prensa_45(E, M0 @ T(13.6, 6.0, 0))
    belt_squat(E, M0 @ T(16.4, 7.1, 0))
    hiper_inversa(E, M0 @ T(19.4, 6.3, 0))
    banco_nordico(E, M0 @ T(19.4, 8.4, 0))

    # --- pared este: kettlebells, fuente, pizarra, TV, mesa
    estante_kettlebells(E, M0 @ T(21.35, 12.3, 0) @ Rz(math.pi / 2))
    with E.p('Fuente_Agua'):
        E.box('acero_inox', (0.0, 0.0, 0.0), (0.45, 0.35, 1.05), M0 @ T(20.85, 14.6, 0))
    pizarra_entreno(E, P, M0 @ T(21.38, 18.0, 0) @ Rz(-math.pi / 2))
    Mtv = M0 @ T(21.38, 18.0, 0) @ Rz(-math.pi / 2) @ T(1.0, 0, 0)
    with E.p('TV_Analisis'):
        E.box('acero_negro', (0.3, -0.06, 1.5), (1.6, 0.0, 2.25), Mtv)
    with L_.p('TV_Analisis_Pantalla'):
        L_.box('pantalla', (0.34, -0.065, 1.54), (1.56, -0.06, 2.21), Mtv)
    mesa_preparador(E, L_, M0 @ T(18.9, 15.9, 0))
    with E.p('Rodillos_Colchonetas'):
        for k in range(5):
            E.cyl('goma_bumper', 0.075, 0.0, 0.9, 16, M0 @ T(17.0, 8.95 + k * 0.17, 0.075) @ Ry(math.pi / 2),
                  tint=(0.05, 0.12, 0.3) if k % 2 else NEGRO)

    # --- marcador LED (pared sur, sobre la puerta)
    marcador_vbt(E, L_, M0 @ T(10.4, 0.0, 2.95) @ Rz(math.pi))

    # --- espejos (pared sur) con marco
    with ESP.p('Espejos_Sur'):
        for (x0, x1) in ((0.6, 9.2), (11.6, 20.8)):
            ESP.box('espejo', (x0, 0.015, 0.45), (x1, 0.025, 2.45), M0)
    with S.p('Marcos_Espejos'):
        for (x0, x1) in ((0.6, 9.2), (11.6, 20.8)):
            for (c, d) in ((0.42, 0.45), (2.45, 2.48)):
                S.box('aluminio', (x0 - 0.03, 0.0, c), (x1 + 0.03, 0.035, d), M0)
    # --- zócalo de color + lema + líneas de zona en el suelo
    with S.p('Zocalo_Club'):
        S.box('pintura_club', (0.0, 0.0, 0.0), (GW, 0.01, 0.3), M0)
        S.box('pintura_club', (0.0, GL - 0.01, 0.0), (GW, GL, 0.3), M0)
        S.box('pintura_club', (0.0, 0.0, 0.0), (0.01, GL, 0.3), M0)
        S.box('pintura_club', (GW - 0.01, 0.0, 0.0), (GW, GL, 0.3), M0)
    with S.p('Lema_Pared'):
        S.text('pintura_club', 'NADIE TRABAJA MÁS QUE NOSOTROS', 0.3, M0 @ T(0.02, 10.7, 5.15) @ Rz(math.pi / 2), extrude=0.01)
    with S.p('Lineas_Suelo'):
        for (a, b_) in (((3.4, 2.8), (12.3, 2.85)), ((3.4, 7.75), (12.3, 7.8)), ((3.4, 2.8), (3.45, 7.8)),
                        ((12.25, 2.8), (12.3, 7.8)), ((5.6, 15.65), (18.3, 15.7)), ((5.6, 17.2), (18.3, 17.25))):
            S.box('pintura_amarilla', (a[0], a[1], 0.0), (b_[0], b_[1], 0.003), M0)

    # --- techo: conducto de climatización y luminarias lineales
    C = 5.6
    with S.p('Conducto_Climatizacion'):
        S.cyl('aluminio', 0.32, 0.6, GW - 0.6, 20, M0 @ T(0, 10.7, C - 0.55) @ Ry(math.pi / 2))
        for k in range(5):
            x = 2.5 + k * 4.2
            S.box('aluminio', (x - 0.25, 10.45, C - 0.95), (x + 0.25, 10.95, C - 0.86), M0)
    for i, y in enumerate((2.0, 5.0, 8.0, 13.0, 16.0, 19.0)):
        with L_.p(f'Luminaria_Lineal_{i + 1}'):
            L_.box('luz_linea', (1.2, y - 0.05, C - 0.06), (GW - 1.2, y + 0.05, C - 0.01), M0)
        with S.p(f'Luminaria_Lineal_{i + 1}_Carcasa'):
            S.box('aluminio', (1.15, y - 0.07, C - 0.015), (GW - 1.15, y + 0.07, C), M0)
