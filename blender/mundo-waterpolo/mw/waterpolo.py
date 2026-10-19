# -*- coding: utf-8 -*-
"""Interior del CENTRO DE WATERPOLO (sin piscina ni pool deck):
recepción, pasillo, sala de vídeo/táctica, despacho de entrenadores,
fisioterapia/recuperación, vestuarios LOCAL y VISITANTE, almacén de material y
enfermería; con todo el material de un equipo de waterpolo."""
import math
from .geo import T, Rz, Rx, Ry, TAU
from . import arq
from .centro import (FZ, C_WP, T_INT, suelo_techo, tabique_x, tabique_y, puerta_int_x, puerta_int_y)

ZC = FZ + C_WP
LOCAL = dict(nombre='LOCAL', gorro='gorro_blanco', color=(0.05, 0.13, 0.36), tela=(0.06, 0.15, 0.42))
VISITA = dict(nombre='VISITANTE', gorro='gorro_azul', color=(0.55, 0.05, 0.06), tela=(0.62, 0.06, 0.07))


# ---------------------------------------------------------------------------
# MATERIAL DE WATERPOLO
# ---------------------------------------------------------------------------
def balon(b, M, r=0.11):
    b.sphere('pelota_wp', r, 18, 10, M, tile=(TAU * r, TAU * r))


def gorro(b, M, mat):
    """Gorro de waterpolo con protectores de oídos (eje z hacia arriba)."""
    prof = [(0.0, 0.0)] + [(0.1 * math.sin(a), 0.11 * math.cos(a)) for a in
                           [math.pi / 2 * (1 - i / 6) for i in range(7)]]
    prof = [(0.1, 0.0)] + [(0.1 * math.cos(math.pi / 2 * i / 6), 0.11 * math.sin(math.pi / 2 * i / 6)) for i in range(1, 7)]
    prof[-1] = (0.0, 0.11)
    b.lathe(mat, [(0.0, 0.0)] + prof, 16, M)
    for s in (-1, 1):
        b.cyl(mat, 0.045, -0.012, 0.012, 14, M @ T(s * 0.095, 0, 0.035) @ Ry(math.pi / 2))
        b.cyl('plastico_negro', 0.03, -0.014, 0.014, 10, M @ T(s * 0.097, 0, 0.035) @ Ry(math.pi / 2))


def red_rect(b, o, u, v, nu, nv, r=0.0035):
    from mathutils import Vector
    o, u, v = Vector(o), Vector(u), Vector(v)
    for i in range(nu + 1):
        p = o + u * (i / nu)
        b.cyl_between('red', p, p + v, r, 3)
    for j in range(nv + 1):
        p = o + v * (j / nv)
        b.cyl_between('red', p, p + u, r, 3)


def porteria(b, M):
    """Portería flotante de waterpolo (3 x 0.9 m sobre el agua) guardada en seco.
    Boca mirando a -y local, centrada en x."""
    from mathutils import Vector
    w = 1.5
    z0, z1 = 0.25, 1.95
    s = 0.075
    for x in (-w - s / 2, w + s / 2):
        b.box('pintura_blanca', (x - s / 2, -s / 2, z0), (x + s / 2, s / 2, z1 + s), M)
        b.box('pintura_blanca', (x - 0.03, 0.9, z0), (x + 0.03, 0.96, 1.2), M)
        b.box('pintura_blanca', (x - 0.03, 0.0, 1.17), (x + 0.03, 0.96, 1.23), M)
        b.box('pintura_blanca', (x - 0.03, 0.0, z0), (x + 0.03, 0.96, z0 + 0.06), M)
    b.box('pintura_blanca', (-w - s, -s / 2, z1), (w + s, s / 2, z1 + s), M)
    b.box('pintura_blanca', (-w - s, -s / 2, z0), (w + s, s / 2, z0 + s), M)
    b.box('pintura_blanca', (-w, 0.9, 1.17), (w, 0.96, 1.23), M)
    b.box('pintura_blanca', (-w, 0.9, z0), (w, 0.96, z0 + 0.06), M)
    # flotadores amarillos y ruedas
    for x in (-w - 0.2, w + 0.2):
        b.cyl('plastico_blanco', 0.12, -0.1, 1.1, 16, M @ T(x, 0, 0.13) @ Rx(-math.pi / 2), tint=(1.0, 0.75, 0.05))
    b.cyl('plastico_blanco', 0.12, -w - 0.2, w + 0.2, 16, M @ T(0, 1.05, 0.13) @ Ry(math.pi / 2), tint=(1.0, 0.75, 0.05))
    # red
    P = lambda x, y, z: (M @ Vector((x, y, z)))
    red_rect(b, P(-w, 0.93, z0 + 0.06), P(w, 0.93, z0 + 0.06) - P(-w, 0.93, z0 + 0.06),
             P(-w, 0.93, 1.17) - P(-w, 0.93, z0 + 0.06), 30, 9)
    red_rect(b, P(-w, 0.03, z1), P(w, 0.03, z1) - P(-w, 0.03, z1), P(-w, 0.93, 1.2) - P(-w, 0.03, z1), 30, 9)
    for x in (-w, w):
        red_rect(b, P(x, 0.03, z0 + 0.06), P(x, 0.93, z0 + 0.06) - P(x, 0.03, z0 + 0.06),
                 P(x, 0.03, 1.15) - P(x, 0.03, z0 + 0.06), 9, 9)


def carro_balones(b, M, rnd):
    L, W, Hh = 1.0, 0.65, 0.55
    z0 = 0.18
    from mathutils import Vector
    P = lambda x, y, z: M @ Vector((x, y, z))
    esq = [(-L / 2, -W / 2), (L / 2, -W / 2), (L / 2, W / 2), (-L / 2, W / 2)]
    for i in range(4):
        x, y = esq[i]
        x2, y2 = esq[(i + 1) % 4]
        for z in (z0, z0 + Hh):
            b.cyl_between('acero_inox', P(x, y, z), P(x2, y2, z), 0.009, 6)
        b.cyl_between('acero_inox', P(x, y, z0), P(x, y, z0 + Hh), 0.009, 6)
        b.cyl('plastico_negro', 0.06, -0.02, 0.02, 12, M @ T(x * 0.9, y * 0.9, 0.065) @ Rx(math.pi / 2))
        b.cyl_between('acero_inox', P(x * 0.9, y * 0.9, 0.065), P(x * 0.9, y * 0.9, z0), 0.01, 6)
    # malla
    for k in range(1, 10):
        x = -L / 2 + L * k / 10
        for y in (-W / 2, W / 2):
            b.cyl_between('acero_inox', P(x, y, z0), P(x, y, z0 + Hh), 0.003, 3)
        b.cyl_between('acero_inox', P(x, -W / 2, z0), P(x, W / 2, z0), 0.003, 3)
    for k in range(1, 6):
        z = z0 + Hh * k / 6
        for y in (-W / 2, W / 2):
            b.cyl_between('acero_inox', P(-L / 2, y, z), P(L / 2, y, z), 0.003, 3)
    b.cyl_between('acero_inox', P(-L / 2 - 0.15, -0.2, z0 + Hh + 0.1), P(-L / 2 - 0.15, 0.2, z0 + Hh + 0.1), 0.012, 8)
    for y in (-0.2, 0.2):
        b.cyl_between('acero_inox', P(-L / 2, y, z0 + Hh), P(-L / 2 - 0.15, y, z0 + Hh + 0.1), 0.01, 6)
    r = 0.11
    for lay in range(2):
        for i in range(4):
            for j in range(2):
                x = -0.36 + i * 0.235 + (0.1 if lay else 0)
                y = -0.14 + j * 0.27
                if lay and i == 3:
                    continue
                balon(b, M @ T(x, y, z0 + r + lay * 0.2) @ Rz(rnd.uniform(0, 6)) @ Rx(rnd.uniform(0, 3)))


def carrete_corchera(b, M):
    """Carrete con corcheras enrolladas (eje x)."""
    for s in (-1, 1):
        Mw = M @ T(s * 0.85, 0, 0.75) @ Ry(math.pi / 2)
        b.torus('acero_inox', 0.68, 0.02, 32, 6, Mw)
        for k in range(6):
            a = TAU * k / 6
            b.cyl_between('acero_inox', (Mw @ T(0, 0, 0)).to_translation(),
                          (Mw @ T(0.68 * math.cos(a), 0.68 * math.sin(a), 0)).to_translation(), 0.012, 6)
        b.box('acero_inox', (s * 0.85 - 0.03, -0.45, 0.1), (s * 0.85 + 0.03, 0.45, 0.14), M)
        for y in (-0.42, 0.42):
            b.cyl_between('acero_inox', (M @ T(s * 0.85, y, 0.12)).to_translation(),
                          (M @ T(s * 0.85, 0, 0.75)).to_translation(), 0.015, 6)
            b.cyl('plastico_negro', 0.05, -0.02, 0.02, 10, M @ T(s * 0.85, y, 0.05) @ Ry(math.pi / 2))
    b.cyl('acero_inox', 0.03, -0.9, 0.9, 10, M @ T(0, 0, 0.75) @ Ry(math.pi / 2))
    cols = [(0.8, 0.08, 0.08), (0.95, 0.95, 0.95), (0.08, 0.2, 0.7), (0.95, 0.95, 0.95)]
    n = 22
    for k in range(n):
        x0 = -0.8 + 1.6 * k / n
        x1 = x0 + 1.6 / n
        prof = [(0.12, x0), (0.5, x0), (0.53, x0 + 0.01), (0.53, x1 - 0.01), (0.5, x1), (0.12, x1)]
        prof = [(r, z) for r, z in prof]
        b.lathe('corchera', prof, 20, M @ T(0, 0, 0.75) @ Ry(math.pi / 2), cap0=False, cap1=False,
                tint=cols[(k // 2) % 4] if k not in (0, n - 1) else (0.8, 0.08, 0.08))


def tabla(b, M, tint):
    b.box('plastico_blanco', (-0.22, -0.15, 0), (0.22, 0.15, 0.035), M, tint=tint)


def pullbuoy(b, M, tint):
    for x in (-0.06, 0.06):
        b.cyl('plastico_blanco', 0.05, -0.11, 0.11, 10, M @ T(x, 0, 0.05) @ Rx(math.pi / 2), tint=tint)


def reloj_posesion(b, L, M, txt='30'):
    b.box('acero_negro', (-0.3, -0.3, 0), (0.3, 0.3, 0.05), M)
    b.cyl('aluminio', 0.04, 0.05, 2.1, 12, M)
    b.box('acero_negro', (-0.35, -0.2, 2.1), (0.35, 0.2, 2.6), M)
    for a in (0, math.pi):
        L.text('led_rojo', txt, 0.32, M @ Rz(a) @ T(0, -0.205, 2.35), extrude=0.003)


def estanteria(b, M, w=2.0, d=0.5, h=2.0, n=4):
    for x in (0.02, w - 0.02):
        for y in (0.02, d - 0.02):
            b.box('acero_negro', (x - 0.02, y - 0.02, 0), (x + 0.02, y + 0.02, h), M, tint=(1.6, 1.6, 1.6))
    for k in range(n):
        z = 0.12 + k * (h - 0.2) / (n - 1)
        b.box('pintura_gris', (0, 0, z), (w, d, z + 0.03), M)
    return [0.15 + k * (h - 0.2) / (n - 1) for k in range(n)]


def taquilla(b, M, num, eq, rnd, luces):
    """Taquilla abierta de madera (tipo vestuario profesional). Frente en y=0 mirando a -y."""
    W, D, H = 0.8, 0.55, 2.25
    b.box('madera_oscura', (0, 0, 0), (0.025, D, H), M)
    b.box('madera_oscura', (W - 0.025, 0, 0), (W, D, H), M)
    b.box('madera_oscura', (0, 0, H - 0.04), (W, D, H), M)
    b.box('pintura_blanca', (0.025, D - 0.02, 0.45), (W - 0.025, D, H - 0.04), M, tint=eq['color'])
    b.box('madera_oscura', (0.025, 0.05, 0), (W - 0.025, D, 0.4), M)
    b.box('pad_negro', (0.03, 0.0, 0.4), (W - 0.03, D - 0.02, 0.47), M, tint=(1.0, 1.0, 1.0))
    b.box('madera_oscura', (0.025, 0.0, 1.85), (W - 0.025, D - 0.02, 1.88), M)
    b.box('madera_oscura', (0.025, 0.0, 1.99), (W - 0.025, 0.02, 2.21), M)
    b.box('acero_inox', (0.12, -0.005, 2.02), (W - 0.12, 0.0, 2.18), M)
    b.text('pintura_club' if eq is LOCAL else 'gorro_rojo', str(num), 0.11, M @ T(W / 2, -0.007, 2.1), extrude=0.002)
    b.cyl('cromo', 0.01, 0.06, W - 0.06, 8, M @ T(0, D / 2, 1.78) @ Ry(math.pi / 2))
    # parka del equipo colgada
    if rnd.random() < 0.85:
        b.box('tela', (0.15, D / 2 - 0.09, 0.85), (W - 0.15, D / 2 + 0.09, 1.76), M, tint=eq['tela'])
        b.box('tela', (0.12, D / 2 - 0.1, 1.5), (W - 0.12, D / 2 + 0.1, 1.76), M, tint=eq['tela'])
        b.box('tela', (0.36, D / 2 - 0.1, 1.05), (W - 0.36, D / 2 - 0.095, 1.55), M, tint=(0.95, 0.95, 0.95))
    # gorro en la balda y toalla doblada
    gorro(b, M @ T(0.22, 0.25, 1.88), 'gorro_rojo' if num in (1, 13) else eq['gorro'])
    b.box('tela', (0.4, 0.08, 1.88), (0.72, 0.45, 2.0), M, tint=(0.95, 0.95, 0.93))
    # chanclas
    for dx in (0.25, 0.42):
        b.box('plastico_negro', (dx, -0.25, 0.0), (dx + 0.11, -0.0, 0.025), M)
    luces.box('luz_linea', (0.03, 0.02, H - 0.05), (W - 0.03, 0.05, H - 0.045), M)


def ducha(b, M):
    """Rociador en pared (frente -y)."""
    b.cyl('cromo', 0.012, 0.0, 0.25, 8, M @ T(0, -0.0, 2.05) @ Rx(-math.pi / 2) @ T(0, 0, 0))
    b.lathe('cromo', [(0.0, -0.02), (0.1, -0.02), (0.1, 0.0), (0.0, 0.01)], 16, M @ T(0, -0.25, 2.0))
    b.cyl('cromo', 0.012, 1.1, 2.05, 8, M @ T(0, -0.03, 0))
    b.box('cromo', (-0.1, -0.06, 1.0), (0.1, 0.0, 1.15), M)
    b.cyl('cromo', 0.03, -0.05, 0.0, 12, M @ T(0, -0.06, 1.07) @ Rx(math.pi / 2))


def silla(b, M, tint=(0.04, 0.04, 0.045)):
    b.box('pad_negro', (-0.24, -0.23, 0.44), (0.24, 0.23, 0.5), M, tint=(1, 1, 1))
    b.box('pad_negro', (-0.24, 0.2, 0.55), (0.24, 0.26, 0.95), M, tint=(1, 1, 1))
    for (x, y) in ((-0.21, -0.2), (0.21, -0.2), (-0.21, 0.2), (0.21, 0.2)):
        b.box('aluminio', (x - 0.012, y - 0.012, 0), (x + 0.012, y + 0.012, 0.44), M)
    b.box('aluminio', (-0.2, 0.22, 0.5), (-0.18, 0.24, 0.6), M)
    b.box('aluminio', (0.18, 0.22, 0.5), (0.2, 0.24, 0.6), M)


def mesa(b, M, w, d, h=0.74, mat='madera_clara'):
    b.box(mat, (0, 0, h - 0.03), (w, d, h), M)
    for (x, y) in ((0.05, 0.05), (w - 0.05, 0.05), (0.05, d - 0.05), (w - 0.05, d - 0.05)):
        b.box('aluminio', (x - 0.02, y - 0.02, 0), (x + 0.02, y + 0.02, h - 0.03), M)


def portatil(b, L, M):
    b.box('aluminio', (-0.17, -0.12, 0), (0.17, 0.12, 0.015), M)
    b.box('aluminio', (-0.17, 0.11, 0.0), (0.17, 0.125, 0.23), M @ T(0, 0, 0.015) @ Rx(-0.25))
    L.box('pantalla', (-0.15, 0.108, 0.02), (0.15, 0.109, 0.21), M @ T(0, 0, 0.015) @ Rx(-0.25))


def camilla(b, M):
    b.box('pad_negro', (0, 0, 0.66), (1.9, 0.68, 0.76), M, tint=(0.05, 0.13, 0.36))
    b.box('acero_inox', (0.05, 0.05, 0.58), (1.85, 0.63, 0.66), M)
    for x in (0.15, 1.75):
        b.box('acero_inox', (x - 0.03, 0.08, 0), (x + 0.03, 0.6, 0.58), M)
        b.box('acero_inox', (x - 0.04, 0.05, 0.0), (x + 0.04, 0.63, 0.04), M)
    b.box('tela', (0.05, 0.02, 0.76), (0.6, 0.66, 0.78), M, tint=(0.95, 0.95, 0.95))


def tina(b, W_, M, r=0.6, h=0.85, agua=True):
    b.lathe('acero_inox', [(0.0, 0.0), (r, 0.0), (r, h), (r + 0.03, h + 0.02), (r - 0.05, h + 0.02),
                           (r - 0.05, 0.06), (0.0, 0.06)], 28, M)
    if agua:
        W_.cyl('agua_fuente', r - 0.05, 0.0, h - 0.12, 28, M, cap0=False)


def trofeo(b, M, alto, mat):
    s = alto / 0.45
    b.lathe('madera_oscura', [(0.0, 0), (0.07 * s, 0), (0.07 * s, 0.06 * s), (0.0, 0.06 * s)], 4, M, a0=math.pi / 4,
            a1=math.pi / 4 + TAU)
    b.lathe(mat, [(0.0, 0.06 * s), (0.04 * s, 0.06 * s), (0.015 * s, 0.1 * s), (0.012 * s, 0.22 * s),
                  (0.03 * s, 0.25 * s), (0.08 * s, 0.32 * s), (0.09 * s, 0.44 * s), (0.08 * s, 0.45 * s),
                  (0.0, 0.33 * s)], 20, M)


def marco_gorro(b, M, mat_gorro, num, eq):
    b.box('madera_oscura', (-0.3, 0.0, -0.35), (0.3, 0.05, 0.35), M)
    b.box('pintura_blanca', (-0.26, -0.002, -0.31), (0.26, 0.0, 0.31), M, tint=eq['color'])
    gorro(b, M @ T(0, -0.1, -0.02) @ Rx(-math.pi / 2), mat_gorro)
    b.text('oro', f'Nº {num}', 0.05, M @ T(0, -0.004, -0.24), extrude=0.001)


# ---------------------------------------------------------------------------
# ESTANCIAS
# ---------------------------------------------------------------------------
def luces(L, x0, y0, x1, y1, dx=2.4, dy=2.4):
    nx = max(1, int((x1 - x0) / dx))
    ny = max(1, int((y1 - y0) / dy))
    for i in range(nx):
        for j in range(ny):
            cx = x0 + (x1 - x0) * (i + 0.5) / nx
            cy = y0 + (y1 - y0) * (j + 0.5) / ny
            L.box('luz_panel', (cx - 0.6, cy - 0.3, ZC - 0.025), (cx + 0.6, cy + 0.3, ZC - 0.005))


def particiones(B):
    z = ZC
    # pasillo norte (y=-34): cara A -> pasillo (Recepcion); cara B -> estancias norte
    tabique_x(B, 'Recepcion', 'Video_Fisio', 10.0, 19.0, -34.0, z, [(13.0, 14.1, 0, FZ + 2.15)])
    tabique_x(B, 'Recepcion', 'Recepcion', 19.0, 23.0, -34.0, z, [(20.4, 21.5, 0, FZ + 2.15)])
    tabique_x(B, 'Recepcion', 'Video_Fisio', 23.0, 27.7, -34.0, z, [(24.4, 25.5, 0, FZ + 2.15)])
    # pasillo sur (y=-36): cara A -> estancias sur ; cara B -> pasillo
    tabique_x(B, 'Vestuarios', 'Recepcion', 2.3, 10.5, -36.0, z, [(8.5, 9.6, 0, FZ + 2.15)], matA='ceramica_pared')
    tabique_x(B, 'Almacen_WP', 'Recepcion', 10.5, 15.5, -36.0, z, [(12.3, 14.1, 0, FZ + 2.3)])
    tabique_x(B, 'Vestuarios', 'Recepcion', 15.5, 23.7, -36.0, z, [(21.5, 22.6, 0, FZ + 2.15)], matA='ceramica_pared')
    tabique_x(B, 'Vestuarios', 'Recepcion', 23.7, 27.7, -36.0, z, [(24.8, 25.9, 0, FZ + 2.15)])
    # tabiques norte-sur, banda norte
    tabique_y(B, 'Video_Fisio', 'Recepcion', 10.0, -34.0 + T_INT / 2, -24.3, z)
    tabique_y(B, 'Recepcion', 'Video_Fisio', 19.0, -34.0 + T_INT / 2, -24.3, z)
    tabique_y(B, 'Video_Fisio', 'Recepcion', 23.0, -34.0 + T_INT / 2, -24.3, z)
    # banda sur
    tabique_y(B, 'Almacen_WP', 'Vestuarios', 10.5, -47.7, -36.0 - T_INT / 2, z, matB='ceramica_pared')
    tabique_y(B, 'Vestuarios', 'Almacen_WP', 15.5, -47.7, -36.0 - T_INT / 2, z, matA='ceramica_pared')
    tabique_y(B, 'Vestuarios', 'Vestuarios', 23.7, -47.7, -36.0 - T_INT / 2, z, matB='ceramica_pared')
    # puertas
    for (g, x0, x1, y) in (('Recepcion', 13.0, 14.1, -34.0), ('Recepcion', 20.4, 21.5, -34.0),
                           ('Recepcion', 24.4, 25.5, -34.0), ('Recepcion', 8.5, 9.6, -36.0),
                           ('Recepcion', 21.5, 22.6, -36.0), ('Recepcion', 24.8, 25.9, -36.0)):
        puerta_int_x(B, g, x0, x1, y, abierta=-1.2 if y == -34.0 else 1.2)
    puerta_int_x(B, 'Almacen_WP', 12.3, 14.1, -36.0, zt=FZ + 2.3, abierta=1.5, tint=(0.6, 0.6, 0.65))


def recepcion(B, rnd):
    R = B['Recepcion']
    L = B['Centro_Luminarias']
    G = B['Centro_Vidrios']
    suelo_techo(R, 2.3, -34.0, 10.0 - T_INT / 2, -24.3, 'porcelanato', C_WP)
    suelo_techo(R, 2.3, -36.0 + T_INT / 2, 27.7, -34.0 - T_INT / 2, 'porcelanato', C_WP)
    suelo_techo(R, 19.0 + T_INT / 2, -34.0 + T_INT / 2, 23.0 - T_INT / 2, -24.3, 'moqueta', C_WP)
    luces(L, 2.3, -34.0, 10.0, -24.3, 2.6, 2.4)
    luces(L, 2.3, -36.0, 27.7, -34.0, 2.5, 2.0)
    luces(L, 19.0, -34.0, 23.0, -24.3, 2.0, 2.4)
    # mostrador en L (frente hacia el oeste)
    Md = T(7.6, -31.6, FZ)
    R.box('pintura_blanca', (0.0, 0.0, 0.0), (0.7, 4.0, 1.05), Md)
    for i in range(int(4.0 / 0.08)):
        R.box('listones_madera', (-0.04, i * 0.08, 0.05), (0.0, i * 0.08 + 0.05, 1.0), Md)
    R.box('pintura_blanca', (-0.1, -0.05, 1.05), (0.75, 4.05, 1.1), Md)
    R.box('pintura_blanca', (0.7, 0.0, 0.72), (1.5, 0.6, 0.76), Md)
    R.box('pintura_blanca', (0.3, 0.0, 0.72), (1.6, 4.0, 0.75), Md @ T(0.05, 0, 0))
    R.text('pintura_club', 'BIENVENIDOS', 0.16, Md @ T(-0.045, 2.0, 0.6) @ Rz(-math.pi / 2), extrude=0.004)
    portatil(R, L, Md @ T(1.1, 1.2, 0.75) @ Rz(math.pi / 2))
    silla(R, Md @ T(1.7, 2.6, 0) @ Rz(math.pi / 2))
    # pared del escudo (cara oeste del tabique x=10): listones + escudo + lema
    Mw = T(10.0 - T_INT / 2, -29.15, FZ) @ Rz(-math.pi / 2)
    for i in range(int(8.6 / 0.09)):
        x = -4.3 + i * 0.09
        R.box('listones_madera', (x, -0.06, 0.0), (x + 0.05, 0.0, C_WP), Mw)
    R.cyl('pintura_club', 0.75, 0.06, 0.1, 40, Mw @ T(0, 0, 2.45) @ Rx(math.pi / 2))
    R.cyl('pintura_amarilla', 0.62, 0.1, 0.12, 40, Mw @ T(0, 0, 2.45) @ Rx(math.pi / 2))
    R.cyl('pintura_club', 0.52, 0.12, 0.13, 40, Mw @ T(0, 0, 2.45) @ Rx(math.pi / 2))
    R.text('pintura_blanca', 'WP', 0.55, Mw @ T(0, -0.14, 2.45), extrude=0.01)
    R.text('pintura_club', 'CLUB DE WATERPOLO', 0.2, Mw @ T(0, -0.07, 1.45), extrude=0.006)
    # vitrina de trofeos (pared oeste)
    Mv = T(2.3, -33.6, FZ) @ Rz(math.pi / 2) @ T(0, -0.55, 0)
    R.box('madera_oscura', (0, 0, 0), (4.8, 0.55, 0.8), Mv)
    R.box('madera_oscura', (0, 0, 2.3), (4.8, 0.55, 2.4), Mv)
    for x in (0, 2.4, 4.78):
        R.box('aluminio', (x, 0, 0.8), (x + 0.03, 0.55, 2.3), Mv)
    G.box('vidrio', (0.02, 0.0, 0.8), (4.78, 0.01, 2.3), Mv)
    for k, z in enumerate((0.8, 1.3, 1.8)):
        G.box('vidrio', (0.03, 0.03, z + 0.01), (4.77, 0.52, z + 0.02), Mv)
        L.box('luz_linea', (0.05, 0.25, z + 0.48), (4.75, 0.3, z + 0.49), Mv)
        for i in range(7):
            mat = ('oro', 'plata', 'oro', 'bronce', 'oro', 'plata', 'oro')[(i + k) % 7]
            trofeo(R, Mv @ T(0.35 + i * 0.68, 0.28, z + 0.02), rnd.uniform(0.3, 0.45), mat)
    # sofás y mesa baja
    for (x, y) in ((3.0, -26.2), (3.0, -28.4)):
        Ms = T(x, y, FZ)
        R.box('pad_club', (0, 0, 0.0), (2.0, 0.8, 0.42), Ms)
        R.box('pad_club', (0, 0.0, 0.42), (2.0, 0.22, 0.85), Ms)
    R.lathe('madera_oscura', [(0.0, 0), (0.45, 0), (0.45, 0.42), (0.0, 0.42)], 24, T(4.0, -27.2, FZ))
    # escudo en el suelo
    R.cyl('pintura_club', 1.1, 0.0, 0.003, 40, T(5.6, -30.0, FZ))
    R.torus('pintura_amarilla', 0.95, 0.04, 40, 4, T(5.6, -30.0, FZ + 0.002) @ T(0, 0, 0))
    R.text('pintura_blanca', 'WP', 0.9, T(5.6, -30.0, FZ + 0.004) @ Rx(-math.pi / 2), extrude=0.001)
    # tornos de control de acceso hacia el pasillo
    for x in (3.2, 4.6, 6.0):
        Mt = T(x, -33.4, FZ)
        R.box('acero_inox', (0, 0, 0), (0.22, 1.2, 1.0), Mt)
        R.box('vidrio_oscuro' if False else 'plastico_negro', (0.02, 0.1, 1.0), (0.2, 0.5, 1.01), Mt)
        L.box('led_verde', (0.06, 0.15, 1.011), (0.16, 0.25, 1.012), Mt)
        G.box('vidrio', (0.22, 0.4, 0.4), (0.62, 0.42, 1.0), Mt)
    R.box('acero_inox', (7.4, -33.4, FZ), (7.62, -32.2, FZ + 1.0))
    # macetas
    for (x, y) in ((4.4, -24.9), (7.8, -24.9)):
        R.lathe('concreto', [(0.0, 0), (0.25, 0), (0.32, 0.65), (0.0, 0.65)], 16, T(x, y, FZ), tint=(0.3, 0.3, 0.32))
        from mathutils import Vector
        from .ciudad import nube
        for k in range(3):
            nube(R, Vector((x + rnd.uniform(-0.1, 0.1), y + rnd.uniform(-0.1, 0.1), FZ + 1.0 + k * 0.35)), 0.3, rnd)
    # pasillo: marcos con gorros históricos + rótulos de puertas
    for i, x in enumerate((10.6, 11.8, 15.2, 16.4, 17.6, 22.0, 26.4)):
        marco_gorro(R, T(x, -34.0 - T_INT / 2 - 0.05, FZ + 1.6), 'gorro_azul' if i % 2 else 'gorro_blanco', 4 + i, LOCAL)
    rotulos = [(9.05, -36.0, 'VESTUARIO LOCAL', 1), (13.2, -36.0, 'ALMACÉN MATERIAL', 1),
               (22.05, -36.0, 'VESTUARIO VISITANTE', 1), (25.35, -36.0, 'ENFERMERÍA', 1),
               (13.55, -34.0, 'SALA DE VÍDEO', -1), (20.95, -34.0, 'ENTRENADORES', -1),
               (24.95, -34.0, 'FISIOTERAPIA', -1)]
    for (x, y, txt, s) in rotulos:
        yy = y + s * (T_INT / 2 + 0.005)
        Mr = T(x, yy, FZ + 2.45) @ (Rz(math.pi) if s > 0 else Rz(0))
        R.box('pintura_club', (-0.75, -0.01, -0.12), (0.75, 0.01, 0.12), Mr)
        R.text('pintura_blanca', txt, 0.1, Mr @ T(0, -0.012, 0), extrude=0.002)
    # bancos del pasillo
    for x in (10.6, 18.6):
        R.box('listones_madera', (x, -35.85, FZ + 0.42), (x + 1.8, -35.45, FZ + 0.46))
        for xx in (x + 0.1, x + 1.6):
            R.box('acero_negro', (xx, -35.8, FZ), (xx + 0.1, -35.5, FZ + 0.42))
    # despacho de entrenadores
    for (x, y) in ((19.4, -27.0), (21.2, -27.0)):
        mesa(R, T(x, y, FZ), 1.5, 0.75)
        R.box('plastico_negro', (x + 0.45, y + 0.55, FZ + 0.74), (x + 1.05, y + 0.6, FZ + 1.1))
        L.box('pantalla', (x + 0.47, y + 0.548, FZ + 0.77), (x + 1.03, y + 0.549, FZ + 1.08))
        silla(R, T(x + 0.75, y - 0.35, FZ) @ Rz(math.pi))
    est = estanteria(R, T(19.15, -33.8, FZ), w=1.2, d=0.4, h=2.0, n=5)
    for z in est[:-1]:
        for k in range(9):
            R.box('pintura_blanca', (19.3 + k * 0.12, -33.7, FZ + z + 0.03), (19.38 + k * 0.12, -33.45, FZ + z + 0.33),
                  tint=[(0.05, 0.13, 0.36), (0.6, 0.06, 0.06), (0.9, 0.9, 0.9), (0.95, 0.75, 0.05)][(k + int(z * 7)) % 4])
    Mp = T(23.0 - T_INT / 2, -30.5, FZ) @ Rz(-math.pi / 2)
    R.box('aluminio', (-1.25, -0.03, 0.95), (1.25, 0.0, 2.25), Mp)
    R.box('pizarra_tactica', (-1.2, -0.035, 1.0), (1.2, -0.03, 2.2), Mp, tile=(2.4, 1.2), uvoff=(0.5, -0.8333))


def video_fisio(B, rnd):
    V = B['Video_Fisio']
    L = B['Centro_Luminarias']
    W_ = B['Centro_Espejos']
    # --- sala de vídeo x[10,19]
    suelo_techo(V, 10.0 + T_INT / 2, -34.0 + T_INT / 2, 19.0 - T_INT / 2, -24.3, 'moqueta', C_WP)
    luces(L, 10.0, -34.0, 19.0, -24.3, 2.3, 2.4)
    Ms = T(10.0 + T_INT / 2, -29.15, FZ) @ Rz(-math.pi / 2) @ Rz(math.pi)
    # pantalla grande en la pared oeste (mirando a +x)
    V.box('acero_negro', (-2.0, -0.08, 0.85), (2.0, 0.0, 3.1), Ms)
    L.box('pantalla', (-1.92, -0.081, 0.93), (1.92, -0.08, 3.02), Ms)
    V.box('acero_negro', (-0.1, -0.6, 0.0), (0.1, -0.1, 1.1), Ms)
    V.box('madera_oscura', (-0.35, -1.05, 0.0), (0.35, -0.6, 1.12), Ms)
    portatil(V, L, Ms @ T(0, -0.82, 1.12) @ Rz(math.pi))
    # proyector / altavoces
    V.box('plastico_blanco', (13.2, -29.5, ZC - 0.35), (13.6, -28.9, ZC - 0.2))
    V.box('acero_negro', (13.38, -29.22, ZC - 0.2), (13.42, -29.18, ZC))
    # mesas de análisis (3 filas) con sillas mirando a la pantalla (oeste)
    for i, x in enumerate((12.4, 14.6, 16.8)):
        mesa(V, T(x, -32.6, FZ), 0.6, 6.6)
        for k in range(5):
            y = -32.2 + k * 1.35
            silla(V, T(x + 0.95, y, FZ) @ Rz(-math.pi / 2))
            if (k + i) % 2 == 0:
                portatil(V, L, T(x + 0.32, y, FZ + 0.74) @ Rz(-math.pi / 2))
            V.box('pintura_blanca', (x + 0.1, y - 0.3, FZ + 0.74), (x + 0.32, y - 0.1, FZ + 0.742))
    # pizarra táctica magnética (pared este)
    Mp = T(19.0 - T_INT / 2, -29.15, FZ) @ Rz(-math.pi / 2)
    V.box('aluminio', (-1.85, -0.03, 0.8), (1.85, 0.0, 2.7), Mp)
    V.box('pizarra_tactica', (-1.8, -0.035, 0.85), (1.8, -0.03, 2.65), Mp, tile=(3.6, 1.8), uvoff=(0.5, -0.4722))
    for k in range(7):
        V.cyl('gorro_blanco' if k < 4 else 'gorro_azul', 0.04, -0.05, -0.035, 12,
              Mp @ T(-1.1 + k * 0.3, 0, 1.4 + (k % 3) * 0.3) @ Rx(math.pi / 2))
    V.box('aluminio', (-1.8, -0.1, 0.78), (1.8, -0.03, 0.8), Mp)
    # paneles acústicos (pared sur)
    for x in (10.5, 11.75, 14.4, 15.65, 16.9):
        V.box('tela', (x, -34.0 + T_INT / 2, FZ + 1.1), (x + 1.1, -34.0 + T_INT / 2 + 0.05, FZ + 2.5), tint=(0.06, 0.13, 0.32))

    # --- fisioterapia / recuperación x[23,27.7]
    suelo_techo(V, 23.0 + T_INT / 2, -34.0 + T_INT / 2, 27.7, -24.3, 'vinilo_piso', C_WP)
    luces(L, 23.0, -34.0, 27.7, -24.3, 2.3, 2.4)
    camilla(V, T(25.6, -27.2, FZ) @ Rz(math.pi / 2))
    camilla(V, T(25.6, -31.6, FZ) @ Rz(math.pi / 2))
    tina(V, W_, T(23.9, -25.3, FZ))
    tina(V, W_, T(23.9, -26.75, FZ))
    V.box('pintura_blanca', (23.1, -29.8, FZ), (23.7, -27.6, FZ + 0.9))
    V.box('acero_inox', (23.1, -29.8, FZ + 0.9), (23.75, -27.6, FZ + 0.94))
    V.lathe('acero_inox', [(0.0, -0.15), (0.2, -0.15), (0.2, 0.0), (0.0, 0.0)], 16, T(23.4, -28.2, FZ + 0.94))
    V.box('acero_inox', (23.2, -29.7, FZ + 0.94), (23.6, -29.2, FZ + 1.6))
    est = estanteria(V, T(26.6, -33.75, FZ) @ Rz(0), w=1.0, d=0.45, h=1.9, n=4)
    for z in est:
        for k in range(4):
            V.box('tela', (26.65 + k * 0.23, -33.7, FZ + z + 0.03), (26.85 + k * 0.23, -33.35, FZ + z + 0.15),
                  tint=(0.95, 0.95, 0.95) if k % 2 else (0.06, 0.15, 0.42))
    for k in range(6):
        V.cyl('goma_bumper', 0.075, 0.0, 0.9, 16, T(26.2, -29.0 + k * 0.17, FZ + 0.075) @ Ry(math.pi / 2),
              tint=(0.05, 0.12, 0.3) if k % 2 else (0.06, 0.06, 0.06))
    for k in range(3):
        V.box('vinilo_pad', (26.0, -32.9 + k * 0.7, FZ), (27.0, -32.3 + k * 0.7, FZ + 0.012), tint=(0.05, 0.12, 0.3))
    # botiquín
    V.box('pintura_blanca', (27.65, -30.4, FZ + 1.3), (27.7, -29.6, FZ + 2.0))


def vestuario(B, rnd, eq, x0, x1, lado_taquillas, duchas):
    """Vestuario de equipo con taquillas abiertas numeradas, banco central y duchas."""
    S = B['Vestuarios']
    L = B['Centro_Luminarias']
    y0, y1 = -47.7, -36.0 - T_INT / 2
    xa = x0 + (T_INT / 2 if x0 > 3 else 0)
    xb = x1 - (T_INT / 2 if x1 < 27 else 0)
    suelo_techo(S, xa, y0, xb, y1, 'ceramica_suelo', C_WP)
    luces(L, x0, y0, x1, -36.0, 2.0, 2.4)
    n = 1
    if lado_taquillas == 'oeste':
        for k in range(11):
            taquilla(S, T(xa + 0.55, -46.6 + k * 0.8, FZ) @ Rz(math.pi / 2), n, eq, rnd, L)
            n += 1
        for k in range(6):
            taquilla(S, T(3.2 + k * 0.8, y1 - 0.55, FZ), n, eq, rnd, L)
            n += 1
        banco_isla(S, T(4.4, -45.5, FZ), 1.6, 6.0, eq)
    else:
        for k in range(11):
            taquilla(S, T(xb - 0.55, -46.6 + (k + 1) * 0.8, FZ) @ Rz(-math.pi / 2), n, eq, rnd, L)
            n += 1
        for k in range(5):
            taquilla(S, T(19.2 + (k + 1) * 0.8, y0 + 0.55, FZ) @ Rz(math.pi), n, eq, rnd, L)
            n += 1
        banco_isla(S, T(19.6, -45.0, FZ), 1.6, 5.5, eq)
    # duchas
    (dx0, dy0, dx1, dy1), muro_d, rociadores = duchas
    S.box('ceramica_azul', (dx0, dy0, FZ), (dx1, dy1, FZ + 0.004), tint=(0.85, 0.9, 1.0))
    for (a, b_) in muro_d:
        S.box('ceramica_pared', (a[0], a[1], 0.0), (b_[0], b_[1], ZC))
    for (x, y, ang) in rociadores:
        ducha(S, T(x, y, FZ) @ Rz(ang))
    # pizarra táctica pequeña + TV
    return S


def banco_isla(S, M, w, l, eq):
    S.box('madera_oscura', (0.1, 0.1, 0), (w - 0.1, l - 0.1, 0.38), M)
    S.box('pad_club', (0, 0, 0.38), (w, l, 0.46), M, tint=(1, 1, 1) if eq is LOCAL else (0.8, 0.1, 0.1))
    S.text('pintura_blanca', eq['nombre'], 0.22, M @ T(w / 2, l / 2, 0.462) @ Rx(-math.pi / 2) @ Rz(math.pi / 2), extrude=0.001)


def vestuarios(B, rnd):
    S = B['Vestuarios']
    L = B['Centro_Luminarias']
    # LOCAL x[2.3,10.5]: taquillas oeste + norte, duchas SE
    vestuario(B, rnd, LOCAL, 2.3, 10.5, 'oeste',
              ((7.68, -47.7, 10.43, -42.0), [((7.6, -47.7), (7.75, -42.0))],
               [(10.43, y, -math.pi / 2) for y in (-47.0, -45.9, -44.8, -43.7, -42.6)]))
    Mp = T(7.6, -45.0, FZ) @ Rz(math.pi / 2) @ Rz(math.pi)
    S.box('aluminio', (-1.25, -0.03, 0.95), (1.25, 0.0, 2.25), Mp)
    S.box('pizarra_tactica', (-1.2, -0.035, 1.0), (1.2, -0.03, 2.2), Mp, tile=(2.4, 1.2), uvoff=(0.5, -0.8333))
    S.text('pintura_club', 'EQUIPO LOCAL', 0.25, T(4.2, -47.7 + 0.01, FZ + 2.75) @ Rz(math.pi), extrude=0.005)
    # VISITANTE x[15.5,23.7]: taquillas este + sur, duchas NO
    vestuario(B, rnd, VISITA, 15.5, 23.7, 'este',
              ((15.58, -42.4, 18.4, -36.08), [((15.5, -42.5), (18.4, -42.35)), ((18.3, -42.5), (18.45, -38.2))],
               [(15.58, y, math.pi / 2) for y in (-41.8, -40.7, -39.6, -38.5, -37.4)]))
    Mp = T(16.95, -42.5, FZ) @ Rz(0)
    S.box('aluminio', (-1.25, -0.03, 0.95), (1.25, 0.0, 2.25), Mp)
    S.box('pizarra_tactica', (-1.2, -0.035, 1.0), (1.2, -0.03, 2.2), Mp, tile=(2.4, 1.2), uvoff=(0.5, -0.8333))
    # ENFERMERÍA x[23.7,27.7]
    suelo_techo(S, 23.7 + T_INT / 2, -47.7, 27.7, -36.0 - T_INT / 2, 'vinilo_piso', C_WP)
    luces(L, 23.7, -47.7, 27.7, -36.0, 2.0, 2.4)
    camilla(S, T(26.9, -46.8, FZ) @ Rz(math.pi / 2))
    mesa(S, T(24.0, -40.0, FZ), 1.2, 0.7)
    silla(S, T(24.6, -40.5, FZ) @ Rz(math.pi))
    est = estanteria(S, T(23.85, -43.5, FZ) @ Rz(0), w=1.2, d=0.4, h=1.9, n=4)
    S.box('pintura_blanca', (27.62, -39.4, FZ + 1.2), (27.7, -38.8, FZ + 1.8), tint=(0.1, 0.6, 0.25))
    S.text('pintura_blanca', 'DEA', 0.12, T(27.615, -39.1, FZ + 1.5) @ Rz(math.pi / 2), extrude=0.002)
    S.box('pintura_blanca', (25.0, -36.0 - T_INT / 2 - 0.01, FZ + 1.6), (25.9, -36.0 - T_INT / 2, FZ + 2.4), tint=(0.95, 0.95, 0.95))
    S.box('gorro_rojo', (25.38, -36.0 - T_INT / 2 - 0.015, FZ + 1.75), (25.52, -36.0 - T_INT / 2 - 0.01, FZ + 2.25))
    S.box('gorro_rojo', (25.2, -36.0 - T_INT / 2 - 0.015, FZ + 1.93), (25.7, -36.0 - T_INT / 2 - 0.01, FZ + 2.07))


def almacen(B, rnd):
    A = B['Almacen_WP']
    L = B['Centro_Luminarias']
    xa, xb = 10.5 + T_INT / 2, 15.5 - T_INT / 2
    y0, y1 = -47.7, -36.0 - T_INT / 2
    suelo_techo(A, xa, y0, xb, y1, 'concreto', C_WP, tint=(0.85, 0.87, 0.9))
    A.box('pintura_amarilla', (11.4, -47.65, FZ), (14.6, -47.55, FZ + 0.002))
    luces(L, 10.5, -47.7, 15.5, -36.0, 2.5, 2.4)
    # porterías flotantes (2) contra la pared oeste, boca hacia la sala
    porteria(A, T(xa + 1.25, -43.8, FZ) @ Rz(math.pi / 2))
    porteria(A, T(xa + 1.25, -39.9, FZ) @ Rz(math.pi / 2))
    # carros de balones
    carro_balones(A, T(13.2, -45.2, FZ), rnd)
    carro_balones(A, T(13.2, -43.8, FZ) @ Rz(0.12), rnd)
    carro_balones(A, T(13.4, -46.7, FZ) @ Rz(1.57), rnd)
    # carretes de corcheras
    carrete_corchera(A, T(14.0, -41.6, FZ) @ Rz(math.pi / 2))
    # paneles de gorros (blancos, azules, rojos de portero) en la pared este
    for j, (mat, z) in enumerate((('gorro_blanco', 1.0), ('gorro_azul', 1.55), ('gorro_rojo', 2.1))):
        Mg = T(xb, -39.6, FZ + z) @ Rz(math.pi / 2)
        A.box('madera_clara', (-1.4, -0.02, -0.18), (1.4, 0.0, 0.18), Mg @ Rz(math.pi))
        n = 13 if j < 2 else 4
        for k in range(n):
            x = -1.3 + k * (2.6 / max(1, n - 1))
            A.cyl('cromo', 0.006, 0.0, 0.05, 6, Mg @ Rz(math.pi) @ T(x, 0, 0.05) @ Rx(math.pi / 2))
            gorro(A, Mg @ Rz(math.pi) @ T(x, -0.08, -0.02) @ Rx(-math.pi / 2) @ Rz(0), mat)
    # estanterías con tablas y pull-buoys
    for (yy, contenido) in ((-37.4, 'tablas'), (-47.6, 'buoys')):
        Ms = T(xb, yy, FZ) @ Rz(math.pi / 2)
        est = estanteria(A, Ms, w=1.2, d=1.0, h=2.0, n=4)
        for z in est:
            for k in range(3):
                for m in range(4 if contenido == 'tablas' else 3):
                    tint = [(0.95, 0.75, 0.05), (0.08, 0.2, 0.7), (0.8, 0.08, 0.08), (0.1, 0.55, 0.2)][(k + m) % 4]
                    if contenido == 'tablas':
                        tabla(A, Ms @ T(0.2 + k * 0.4, 0.5, z + 0.03 + m * 0.036) @ Rz(math.pi / 2), tint)
                    else:
                        pullbuoy(A, Ms @ T(0.2 + k * 0.4, 0.2 + m * 0.3, z + 0.03), tint)
    # relojes de posesión portátiles guardados
    reloj_posesion(A, L, T(11.0, -37.2, FZ), '30')
    reloj_posesion(A, L, T(11.75, -37.2, FZ), '20')
    # balones sueltos y bolsa de red
    for k in range(5):
        balon(A, T(11.6 + k * 0.25, -47.2 + (k % 2) * 0.2, FZ + 0.11) @ Rz(k))


def construir(B, rnd):
    particiones(B)
    recepcion(B, rnd)
    video_fisio(B, rnd)
    vestuarios(B, rnd)
    almacen(B, rnd)
