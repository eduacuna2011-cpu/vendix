# -*- coding: utf-8 -*-
"""Envolventes de los dos edificios deportivos:

  GIMNASIO (edificio independiente)     x[-28,-6]  y[-46,-24]   techo 5.6 m
  CENTRO DE WATERPOLO (instalaciones)   x[  2,28]  y[-48,-24]   techo 3.6 m

Al sur queda una parcela LIBRE x[-28,28] y[-86,-50] para colocar el pool deck
(no se modela aquí). Una pasarela cubierta une el gimnasio y el centro.

Distribución del centro de waterpolo:
  banda norte  y[-34,-24.3]: Recepción | Sala de vídeo | Entrenadores | Fisioterapia
  pasillo      y[-36,-34]
  banda sur    y[-47.7,-36]: Vest. LOCAL | Almacén material | Vest. VISITANTE | Enfermería
"""
import math
from .geo import T, Rz, Rx, Ry, frame, TAU
from . import arq

FZ = 0.16          # cota del suelo interior
GYM = (-28.0, -46.0, -6.0, -24.0)
WP = (2.0, -48.0, 28.0, -24.0)
T_EXT = 0.3
T_INT = 0.15
C_GYM = 5.6        # altura libre gimnasio
C_WP = 3.6         # altura libre centro


def Mwall(lado, box):
    """Matriz de un muro perimetral: x local a lo largo del muro, -y local = exterior."""
    x0, y0, x1, y1 = box
    if lado == 'N':
        return frame((x1, y1, 0), (-1, 0, 0)), x1 - x0
    if lado == 'S':
        return frame((x0, y0, 0), (1, 0, 0)), x1 - x0
    if lado == 'O':
        return frame((x0, y1, 0), (0, -1, 0)), y1 - y0
    return frame((x1, y0, 0), (0, 1, 0)), y1 - y0


def perimetro(B, ext, M, L, zt, tramos, huecos, matE, tintE=(1, 1, 1), recorte=(0.0, 0.0)):
    """tramos = [(x0, x1, grupo_interior, mat_interior)] ; huecos = [(x0, x1, zb, zt, tipo)]
    tipo: v ventana, e esmerilada, p puerta vidrio, pm puerta maciza, pr persiana enrollable."""
    G = B['Centro_Vidrios']
    for (a, b_, gi, mi) in tramos:
        a2 = max(a, recorte[0])
        b2 = min(b_, L - recorte[1])
        hs = [(h[0] - a2, h[1] - a2, h[2], h[3]) for h in huecos if h[0] >= a2 - 1e-3 and h[1] <= b2 + 1e-3]
        arq.muro(ext, B[gi], matE, mi, M @ T(a2, 0, 0), b2 - a2, T_EXT, 0.0, zt, hs, tintA=tintE)
    for (x0, x1, zb, zt_, tipo) in huecos:
        if tipo in ('v', 'e'):
            vid = 'vidrio' if tipo == 'v' else 'vidrio_esmerilado'
            divs = max(1, int(round((x1 - x0) / 1.4)))
            arq.ventana(ext, G, M, x0, x1, zb, zt_, T_EXT * 0.35, divs=divs, vidrio=vid, perfil=0.06)
            ext.box('aluminio', (x0 - 0.03, -0.06, zb - 0.04), (x1 + 0.03, 0.02, zb), M)
        elif tipo == 'p':
            w = (x1 - x0) / 2
            arq.puerta(ext, M, x0, x0 + w, FZ, zt_, T_EXT, bG=G, vidriada=True)
            arq.puerta(ext, M @ T(x1, T_EXT, 0) @ Rz(math.pi), 0, w, FZ, zt_, 0.0, bG=G, vidriada=True)
        elif tipo == 'pm':
            arq.puerta(ext, M, x0, x1, FZ, zt_, T_EXT, mat_hoja='pintura_gris', tint=(0.8, 0.8, 0.8))
        elif tipo == 'pr':
            ext.box('chapa', (x0, T_EXT * 0.3, FZ), (x1, T_EXT * 0.3 + 0.03, zt_), M @ T(0, 0, 0), tile=(0.76, 0.1))
            ext.box('aluminio', (x0 - 0.08, -0.05, zt_), (x1 + 0.08, T_EXT * 0.5, zt_ + 0.45), M)


def suelo_techo(Bg, x0, y0, x1, y1, mat_suelo, c, mat_techo='acustico', tint=(1, 1, 1)):
    Bg.box(mat_suelo, (x0, y0, 0.0), (x1, y1, FZ), skip=('bottom',), tint=tint)
    Bg.box(mat_techo, (x0, y0, FZ + c), (x1, y1, FZ + c + 0.08), skip=('top',))


def tabique_x(B, gA, gB, x0, x1, y, zt, huecos=(), matA='pintura_blanca', matB='pintura_blanca'):
    """Tabique a lo largo de X en la cota y (cara A mira a -Y)."""
    arq.muro(B[gA], B[gB], matA, matB, T(x0, y - T_INT / 2, 0), x1 - x0, T_INT, 0.0, zt,
             [(h[0] - x0, h[1] - x0, h[2], h[3]) for h in huecos])


def tabique_y(B, gA, gB, x, y0, y1, zt, huecos=(), matA='pintura_blanca', matB='pintura_blanca'):
    """Tabique a lo largo de Y en la cota x (cara A mira a +X)."""
    M = frame((x + T_INT / 2, y0, 0), (0, 1, 0))
    arq.muro(B[gA], B[gB], matA, matB, M, y1 - y0, T_INT, 0.0, zt,
             [(h[0] - y0, h[1] - y0, h[2], h[3]) for h in huecos])


def puerta_int_x(B, g, x0, x1, y, zt=FZ + 2.15, abierta=1.3, tint=(1, 1, 1)):
    arq.puerta(B[g], T(0, y - T_INT / 2, 0), x0, x1, FZ, zt, T_INT, mat_marco='acero_inox',
               mat_hoja='madera_clara', abierta=abierta, tint=tint)


def puerta_int_y(B, g, y0, y1, x, zt=FZ + 2.15, abierta=1.3, tint=(1, 1, 1)):
    M = frame((x + T_INT / 2, 0, 0), (0, 1, 0))
    arq.puerta(B[g], M, y0, y1, FZ, zt, T_INT, mat_marco='acero_inox', mat_hoja='madera_clara',
               abierta=abierta, tint=tint)


def cubierta(ext, box, zc, zr, pretil=0.45):
    x0, y0, x1, y1 = box
    ext.box('concreto', (x0, y0, zc), (x1, y1, zr - 0.06), skip=('bottom',), tint=(0.9, 0.9, 0.9))
    ext.box('asfalto', (x0 + 0.3, y0 + 0.3, zr - 0.06), (x1 - 0.3, y1 - 0.3, zr), skip=('bottom',), tint=(2.6, 2.5, 2.4))
    for (a, b_) in (((x0, y0), (x1, y0 + 0.3)), ((x0, y1 - 0.3), (x1, y1)),
                    ((x0, y0 + 0.3), (x0 + 0.3, y1 - 0.3)), ((x1 - 0.3, y0 + 0.3), (x1, y1 - 0.3))):
        ext.box('concreto', (a[0], a[1], zr - 0.06), (b_[0], b_[1], zr + pretil), skip=('bottom',))
    ext.box('aluminio', (x0 - 0.04, y0 - 0.04, zr + pretil), (x1 + 0.04, y0 + 0.34, zr + pretil + 0.05))
    ext.box('aluminio', (x0 - 0.04, y1 - 0.34, zr + pretil), (x1 + 0.04, y1 + 0.04, zr + pretil + 0.05))
    ext.box('aluminio', (x0 - 0.04, y0 + 0.34, zr + pretil), (x0 + 0.34, y1 - 0.34, zr + pretil + 0.05))
    ext.box('aluminio', (x1 - 0.34, y0 + 0.34, zr + pretil), (x1 + 0.04, y1 - 0.34, zr + pretil + 0.05))


def climatizadora(ext, x, y, z, w=3.0, d=1.6, h=1.4):
    ext.box('pintura_gris', (x, y, z), (x + w, y + d, z + h), tint=(1.2, 1.2, 1.2))
    for i in range(int(w / 1.0)):
        cx = x + 0.5 + i * 1.0
        ext.cyl('acero_negro', 0.38, z + h, z + h + 0.05, 16, T(cx, y + d / 2, 0))
        ext.box('acero_negro', (cx - 0.02, y + d / 2 - 0.36, z + h + 0.05), (cx + 0.02, y + d / 2 + 0.36, z + h + 0.07))
    for i in range(10):
        zz = z + 0.15 + i * 0.1
        ext.box('acero_negro', (x - 0.01, y + 0.1, zz), (x, y + d - 0.1, zz + 0.04))
    ext.box('aluminio', (x + w * 0.3, y + d, z + 0.3), (x + w * 0.3 + 0.5, y + d + 0.6, z + 0.8))


# ---------------------------------------------------------------------------
def gimnasio_envolvente(B):
    ext = B['Centro_Exterior']
    box = GYM
    zt = FZ + C_GYM + 0.6
    x0, y0, x1, y1 = box
    # NORTE (calle): ventanales altos + entrada
    S = B['Gimnasio_Sala']
    G = B['Centro_Vidrios']

    def piezas(lado):
        ext.pieza(f'Gimnasio_Fachada_{lado}')
        S.pieza(f'Pared_{lado}')
        G.pieza(f'Ventanas_{lado}')
    prev = (ext.cur, S.cur, G.cur)
    piezas('Norte')
    M, L = Mwall('N', box)
    # x local medido desde x1 hacia el oeste
    hN = [(1.0, 3.0, FZ, FZ + 2.6, 'p'),                       # entrada x[-9,-7]
          (4.4, 7.9, FZ + 2.75, FZ + 5.2, 'v'), (8.9, 12.4, FZ + 2.75, FZ + 5.2, 'v'),
          (13.4, 16.9, FZ + 2.75, FZ + 5.2, 'v'), (17.9, 21.4, FZ + 2.75, FZ + 5.2, 'v')]
    perimetro(B, ext, M, L, zt, [(0, L, 'Gimnasio_Sala', 'pintura_blanca')], hN, 'ladrillo')
    # SUR (parcela piscina): puerta + ventanas altas
    piezas('Sur')
    M, L = Mwall('S', box)
    hS = [(9.7, 11.7, FZ, FZ + 2.6, 'p'), (2.0, 5.5, FZ + 3.4, FZ + 5.2, 'v'), (14.5, 18.0, FZ + 3.4, FZ + 5.2, 'v')]
    perimetro(B, ext, M, L, zt, [(0, L, 'Gimnasio_Sala', 'pintura_blanca')], hS, 'ladrillo', recorte=(0, 0))
    # OESTE: ventanales (sol de tarde sobre la zona de remoergómetros)
    piezas('Oeste')
    M, L = Mwall('O', box)
    hO = [(1.6, 5.0, FZ + 1.0, FZ + 4.8, 'v'), (6.0, 9.4, FZ + 1.0, FZ + 4.8, 'v'),
          (10.4, 13.8, FZ + 1.0, FZ + 4.8, 'v'), (14.8, 18.2, FZ + 1.0, FZ + 4.8, 'v')]
    perimetro(B, ext, M, L, zt, [(0, L, 'Gimnasio_Sala', 'pintura_blanca')], hO, 'ladrillo', recorte=(T_EXT, T_EXT))
    # ESTE: puerta a la pasarela cubierta y[-36,-34] (x local desde y0)
    piezas('Este')
    M, L = Mwall('E', box)
    hE = [(10.0, 12.0, FZ, FZ + 2.6, 'p'), (2.0, 6.0, FZ + 3.4, FZ + 5.2, 'v')]
    perimetro(B, ext, M, L, zt, [(0, L, 'Gimnasio_Sala', 'pintura_blanca')], hE, 'ladrillo', recorte=(T_EXT, T_EXT))
    # zócalo y bandas de hormigón
    ext.pieza('Gimnasio_Zocalo_Bandas')
    for lado in 'NSOE':
        M, L = Mwall(lado, box)
        ext.box('concreto', (0, -0.04, 0.0), (L, 0.0, 0.6), M, skip=('bottom', 'back'))
        ext.box('concreto', (0, -0.06, zt - 0.7), (L, 0.0, zt), M, skip=('bottom', 'back'))
    with S.p('Suelo_Caucho'):
        S.box('goma_gym', (x0 + T_EXT, y0 + T_EXT, 0.0), (x1 - T_EXT, y1 - T_EXT, FZ), skip=('bottom',))
    with S.p('Techo_Acustico'):
        S.box('acustico', (x0 + T_EXT, y0 + T_EXT, FZ + C_GYM), (x1 - T_EXT, y1 - T_EXT, FZ + C_GYM + 0.08), skip=('top',))
    ext.pieza('Gimnasio_Cubierta')
    cubierta(ext, box, FZ + C_GYM + 0.08, zt)
    ext.pieza('Climatizadora_1')
    climatizadora(ext, -24, -40, zt, 4.0, 2.0, 1.6)
    ext.pieza('Climatizadora_2')
    climatizadora(ext, -16, -30, zt, 3.0, 1.6, 1.3)
    ext.pieza('Extractor')
    ext.cyl('aluminio', 0.35, zt, zt + 1.2, 16, T(-19, -37, 0))
    ext.pieza('Marquesina_Rotulo')
    # marquesina de entrada + rótulo
    ext.box('concreto', (-11.0, -24.0, FZ + 2.9), (-5.0, -21.6, FZ + 3.2))
    ext.box('aluminio', (-11.05, -21.65, FZ + 2.85), (-4.95, -21.55, FZ + 3.25))
    for x in (-10.7, -5.3):
        ext.cyl('acero_negro', 0.06, FZ, FZ + 2.9, 12, T(x, -21.9, 0))
    ext.text('pintura_club', 'GIMNASIO', 0.9, T(-17.0, -23.97, FZ + 6.0) @ Rz(math.pi), extrude=0.06)
    ext.text('pintura_club', 'ALTO RENDIMIENTO · WATERPOLO', 0.32, T(-17.0, -23.97, FZ + 5.3) @ Rz(math.pi), extrude=0.03)
    # los textos se colocan mirando a +Y (calle): Rz(pi)
    ext.cur, S.cur, G.cur = prev


def centro_envolvente(B):
    ext = B['Centro_Exterior']
    box = WP
    x0, y0, x1, y1 = box
    zt = FZ + C_WP + 0.55
    tp = 'pintura_blanca'
    # NORTE (calle): recepción acristalada | vídeo | entrenadores | fisio
    M, L = Mwall('N', box)   # x local = 28 - x
    tr = [(0, 4.85, 'Video_Fisio', tp), (4.85, 9.0, 'Recepcion', tp), (9.0, 18.0, 'Video_Fisio', tp),
          (18.0, L, 'Recepcion', tp)]
    hN = [(1.0, 4.0, FZ + 0.9, FZ + 2.9, 'v'), (5.6, 8.4, FZ + 0.9, FZ + 2.9, 'v'),
          (10.0, 13.0, FZ + 0.9, FZ + 2.9, 'v'), (14.0, 17.0, FZ + 0.9, FZ + 2.9, 'v'),
          (18.2, 20.6, FZ + 0.0, FZ + 3.2, 'v'), (20.8, 23.0, FZ, FZ + 2.6, 'p'), (23.2, 25.5, FZ + 0.0, FZ + 3.2, 'v')]
    perimetro(B, ext, M, L, zt, tr, hN, 'panel_fachada')
    # SUR (hacia la parcela del pool deck)
    M, L = Mwall('S', box)   # x local = x - 2
    tr = [(0, 8.5, 'Vestuarios', 'ceramica_pared'), (8.5, 13.5, 'Almacen_WP', tp),
          (13.5, 21.7, 'Vestuarios', 'ceramica_pared'), (21.7, L, 'Vestuarios', tp)]
    hS = [(1.0, 2.4, FZ, FZ + 2.2, 'pm'), (3.2, 7.6, FZ + 2.3, FZ + 3.2, 'e'),
          (9.5, 12.5, FZ, FZ + 2.8, 'pr'),
          (14.5, 15.9, FZ, FZ + 2.2, 'pm'), (16.6, 21.0, FZ + 2.3, FZ + 3.2, 'e'), (22.8, 24.8, FZ + 1.0, FZ + 2.6, 'e')]
    perimetro(B, ext, M, L, zt, tr, hS, 'panel_fachada')
    # OESTE (patio entre edificios): puerta del pasillo a la pasarela
    M, L = Mwall('O', box)   # x local = -24 - y
    tr = [(0, 9.7, 'Recepcion', tp), (9.7, 12.0, 'Recepcion', tp), (12.0, L, 'Vestuarios', 'ceramica_pared')]
    hO = [(1.0, 3.5, FZ + 0.9, FZ + 3.0, 'v'), (10.0, 12.0, FZ, FZ + 2.6, 'p'), (14.0, 22.0, FZ + 2.3, FZ + 3.2, 'e')]
    perimetro(B, ext, M, L, zt, tr, hO, 'panel_fachada', recorte=(T_EXT, T_EXT))
    # ESTE
    M, L = Mwall('E', box)   # x local = y + 48
    tr = [(0, 12.0, 'Vestuarios', tp), (12.0, 14.0, 'Recepcion', tp), (14.0, L, 'Video_Fisio', tp)]
    hE = [(3.0, 7.0, FZ + 1.0, FZ + 2.6, 'e'), (15.5, 18.5, FZ + 0.9, FZ + 2.9, 'v'), (19.5, 22.5, FZ + 0.9, FZ + 2.9, 'v')]
    perimetro(B, ext, M, L, zt, tr, hE, 'panel_fachada', recorte=(T_EXT, T_EXT))
    for lado in 'NSOE':
        M, L = Mwall(lado, box)
        ext.box('ladrillo', (0, -0.05, 0.0), (L, 0.0, 0.85), M, skip=('bottom', 'back'))
        ext.box('aluminio', (0, -0.07, 0.85), (L, 0.0, 0.9), M, skip=('bottom', 'back'))
        ext.box('concreto', (0, -0.06, zt - 0.5), (L, 0.0, zt), M, skip=('bottom', 'back'))
    # revestimiento de listones de madera junto a la entrada
    M, L = Mwall('N', box)
    for i in range(int(1.1 / 0.09)):
        xa = 17.05 + i * 0.09
        ext.box('listones_madera', (xa, -0.1, 0.9), (xa + 0.05, -0.04, zt - 0.5), M)
    cubierta(ext, box, FZ + C_WP + 0.08, zt)
    climatizadora(ext, 14, -44, zt)
    climatizadora(ext, 20, -44, zt)
    climatizadora(ext, 8, -30, zt, 2.4, 1.4, 1.2)
    # marquesina de entrada (hormigón) + rótulo
    ext.box('concreto', (1.0, -24.0, FZ + 3.0), (10.5, -20.8, FZ + 3.35))
    ext.box('aluminio', (1.0, -20.85, FZ + 2.95), (10.5, -20.75, FZ + 3.4))
    for x in (1.6, 9.9):
        ext.cyl('acero_negro', 0.07, FZ, FZ + 3.0, 12, T(x, -21.2, 0))
    ext.text('pintura_club', 'CENTRO DE WATERPOLO', 0.42, T(5.75, -20.74, FZ + 3.18) @ Rz(math.pi), extrude=0.03)
    ext.text('pintura_club', 'CENTRO DE ALTO RENDIMIENTO', 0.55, T(17.5, -23.97, FZ + 3.65) @ Rz(math.pi), extrude=0.04)
    # escudo del club en fachada
    ext.cyl('pintura_club', 0.9, 0, 0.05, 32, T(25.0, -24.0, FZ + 2.4) @ Rx(-math.pi / 2))
    ext.cyl('pintura_amarilla', 0.75, 0.05, 0.08, 32, T(25.0, -24.0, FZ + 2.4) @ Rx(-math.pi / 2))
    ext.text('pintura_club', 'WP', 0.7, T(25.0, -23.9, FZ + 2.4) @ Rz(math.pi), extrude=0.03)


def pasarela(B):
    """Pasarela cubierta gimnasio <-> centro (y[-36.6,-33.4])."""
    ext = B['Centro_Exterior']
    z = FZ + 3.0
    ext.box('concreto', (-6.0, -36.8, z), (2.0, -33.2, z + 0.25))
    ext.box('aluminio', (-6.0, -36.85, z - 0.05), (2.0, -36.75, z + 0.3))
    ext.box('aluminio', (-6.0, -33.25, z - 0.05), (2.0, -33.15, z + 0.3))
    for x in (-3.4, -0.8):
        for y in (-36.5, -33.5):
            ext.cyl('acero_negro', 0.08, FZ, z, 12, T(x, y, 0))
    ext.box('granito', (-6.0, -36.6, 0.0), (2.0, -33.4, FZ + 0.005), skip=('bottom',), tint=(1.2, 1.2, 1.2))


def entorno(B, rnd):
    """Mástiles, aparcabicis, jardineras y bancos delante de los edificios."""
    ext = B['Centro_Exterior']
    for i, (colores) in enumerate([((0.8, 0.05, 0.08), (0.95, 0.95, 0.95), (0.8, 0.05, 0.08)),
                                   ((0.05, 0.12, 0.35), (0.95, 0.72, 0.05), (0.05, 0.12, 0.35)),
                                   ((0.95, 0.95, 0.95), (0.05, 0.12, 0.35), (0.95, 0.95, 0.95))]):
        x = 13.5 + i * 2.2
        ext.lathe('aluminio', [(0.0, 0.15), (0.08, 0.15), (0.06, 1.0), (0.04, 9.5), (0.07, 9.55), (0.0, 9.6)], 12, T(x, -21.4, 0))
        # bandera ondeando (tres franjas verticales)
        for k, c in enumerate(colores):
            for j in range(6):
                u0 = 0.05 + k * 0.6 + j * 0.1
                ola = 0.08 * math.sin((u0 + i) * 3.0)
                ola2 = 0.08 * math.sin((u0 + 0.1 + i) * 3.0)
                ext.quad('tela', [(x + u0, -21.4 + ola, 8.0), (x + u0 + 0.1, -21.4 + ola2, 8.0),
                                  (x + u0 + 0.1, -21.4 + ola2, 9.2), (x + u0, -21.4 + ola, 9.2)], tint=c)
                ext.quad('tela', [(x + u0, -21.4 + ola, 9.2), (x + u0 + 0.1, -21.4 + ola2, 9.2),
                                  (x + u0 + 0.1, -21.4 + ola2, 8.0), (x + u0, -21.4 + ola, 8.0)], tint=c)
    # aparcabicis
    for i in range(6):
        x = -2.5 + i * 0.8
        ext.torus('acero_inox', 0.35, 0.025, 16, 6, T(x, -22.5, 0.15) @ Rx(math.pi / 2), a0=0, a1=math.pi)
    # jardineras con setos
    for (x, y) in ((-13.0, -22.2), (-2.5, -38.5), (-2.5, -31.5), (11.5, -22.2), (0.0, -46.0)):
        ext.box('concreto', (x - 1.2, y - 0.5, FZ - 0.01), (x + 1.2, y + 0.5, 0.6))
        ext.box('cesped', (x - 1.1, y - 0.4, 0.6), (x + 1.1, y + 0.4, 0.62))
    A = B['Arboles']
    from .ciudad import nube
    from mathutils import Vector
    for (x, y) in ((-13.0, -22.2), (-2.5, -38.5), (-2.5, -31.5), (11.5, -22.2), (0.0, -46.0)):
        for k in range(4):
            nube(A, Vector((x - 0.85 + k * 0.57, y, 0.9)), 0.45, rnd)
    # bancos de hormigón con asiento de madera
    for (x, y) in ((-4.5, -29.0), (-1.0, -29.0)):
        ext.box('concreto', (x, y, 0), (x + 0.4, y + 0.5, 0.42))
        ext.box('concreto', (x + 1.6, y, 0), (x + 2.0, y + 0.5, 0.42))
        ext.box('listones_madera', (x - 0.05, y - 0.02, 0.42), (x + 2.05, y + 0.52, 0.47))
    # monolito señalético
    ext.box('acero_negro', (-0.6, -20.6, FZ), (0.6, -20.3, 2.6), tint=(1.6, 1.6, 1.6))
    ext.text('pintura_blanca', 'GIMNASIO  ←', 0.16, T(0, -20.62, 2.1) @ Rz(0), extrude=0.005)
    ext.text('pintura_blanca', 'WATERPOLO  →', 0.16, T(0, -20.62, 1.75) @ Rz(0), extrude=0.005)
    ext.text('pintura_blanca', 'POOL DECK  ↓', 0.16, T(0, -20.62, 1.4) @ Rz(0), extrude=0.005)
    # parcela libre para el pool deck: sólo un bordillo perimetral discreto
    for (a, b_) in (((-28, -86.1), (28, -86)), ((-28, -50), (28, -49.9)), ((-28.1, -86), (-28, -50)), ((28, -86), (28.1, -50))):
        ext.box('pintura_blanca', (a[0], a[1], FZ - 0.005), (b_[0], b_[1], FZ + 0.002), skip=('bottom',))


def construir(B, rnd):
    gimnasio_envolvente(B)
    centro_envolvente(B)
    pasarela(B)
    entorno(B, rnd)
