# -*- coding: utf-8 -*-
"""Ciudad europea: manzanas de edificios (haussmanniano, clásico mediterráneo,
ladrillo), calles, plaza adoquinada con fuente, árboles y mobiliario urbano."""
import math
import random
from mathutils import Vector
from .geo import T, Rz, Ry, Rx, Sc, frame, TAU
from . import arq

PALETA_ESTUCO = [(0.95, 0.86, 0.66), (0.93, 0.76, 0.56), (0.88, 0.62, 0.48), (0.96, 0.92, 0.80),
                 (0.80, 0.84, 0.74), (0.93, 0.80, 0.76), (0.80, 0.86, 0.90), (0.97, 0.95, 0.90)]
PALETA_PIEDRA = [(1.0, 0.98, 0.94), (0.97, 0.93, 0.86), (0.93, 0.90, 0.84), (1.0, 0.95, 0.88)]
PERSIANAS = [(0.35, 0.55, 0.42), (0.45, 0.32, 0.22), (0.45, 0.55, 0.62), (0.25, 0.32, 0.30), (0.62, 0.62, 0.58)]
TIENDAS = ['CAFÉ CENTRAL', 'PANADERÍA', 'FARMACIA', 'LIBRERÍA', 'FLORES', 'BOUTIQUE', 'HELADERÍA',
           'BISTRÓ', 'ÓPTICA', 'DEPORTES', 'ULTRAMARINOS', 'PASTELERÍA', 'ZAPATERÍA', 'JOYERÍA',
           'ENOTECA', 'FERRETERÍA', 'PESCADERÍA', 'CHARCUTERÍA']
TOLDOS = [(0.55, 0.08, 0.08), (0.10, 0.25, 0.18), (0.08, 0.12, 0.30), (0.75, 0.55, 0.18), (0.25, 0.25, 0.27)]


# ---------------------------------------------------------------------------
# EDIFICIO
# ---------------------------------------------------------------------------
def edificio(B, G, M, W, D, pisos, estilo, rnd, tienda=None):
    h0 = 4.3
    hf = 3.2
    H = h0 + pisos * hf
    ncol = max(2, int(W / 2.6))
    colw = W / ncol
    ww = min(1.3, colw * 0.52)
    d = 0.24
    if estilo == 'haussmann':
        mat_muro, tint_muro = 'piedra', rnd.choice(PALETA_PIEDRA)
        mat_bajo, tint_bajo = 'piedra', tuple(c * 0.9 for c in tint_muro)
        marco = 'marco_ventana'
    elif estilo == 'clasico':
        mat_muro, tint_muro = 'estuco', rnd.choice(PALETA_ESTUCO)
        mat_bajo, tint_bajo = 'piedra', (0.82, 0.8, 0.76)
        marco = 'marco_ventana'
    else:
        mat_muro, tint_muro = 'ladrillo', rnd.choice([(1, 1, 1), (0.9, 0.85, 0.82), (1.05, 0.95, 0.85)])
        mat_bajo, tint_bajo = 'piedra', (0.75, 0.73, 0.7)
        marco = 'marco_ventana'
    persiana = rnd.choice(PERSIANAS)

    # ---- masa del edificio (caras ocultas omitidas)
    B.box(mat_muro, (0, 0, 0), (W, D, H), M, skip=('front', 'bottom', 'top'), tint=tint_muro)
    B.box('estuco', (0, 0, H - 0.01), (W, D, H), M, skip=('front', 'bottom', 'left', 'right', 'back'), tint=(0.6, 0.6, 0.6))

    # ---- planta baja
    hb = []
    comercio = tienda is not None
    puerta_col = rnd.randrange(ncol)
    for c in range(ncol):
        cx = colw * (c + 0.5)
        if c == puerta_col:
            hb.append(('puerta', cx - 0.75, cx + 0.75, 0.0, 3.1))
        elif comercio:
            hb.append(('tienda', cx - colw * 0.42, cx + colw * 0.42, 0.45, 3.35))
        else:
            hb.append(('ventana', cx - ww / 2, cx + ww / 2, 0.9, 3.1))
    arq.fachada(B, M, W, h0, [h[1:] for h in hb], d, mat_bajo, tint=tint_bajo)
    # zócalo
    B.box('granito', (0, -0.05, 0), (W, 0.0, 0.45), M)
    for kind, x0, x1, z0, z1 in hb:
        if kind == 'puerta':
            Mp = M @ T(0, d - 0.06, 0)
            B.box('puerta_madera', (x0, 0, z0), (x1, 0.06, z1), Mp, tint=persiana)
            for k in (0, 1):
                xa = x0 + 0.1 + k * 0.75
                B.box('puerta_madera', (xa, -0.02, 0.25), (xa + 0.55, 0.0, 1.5), Mp, tint=persiana)
                B.box('puerta_madera', (xa, -0.02, 1.7), (xa + 0.55, 0.0, 2.9), Mp, tint=persiana)
            B.box('acero_inox', (x0 + 0.68, -0.05, 1.2), (x0 + 0.82, -0.02, 1.25), Mp)
            # montante sobre la puerta
            B.box('piedra', (x0 - 0.15, -0.08, z1), (x1 + 0.15, 0, z1 + 0.3), M, tint=tint_bajo)
        elif kind == 'tienda':
            arq.ventana(B, G, M, x0, x1, z0, z1, d - 0.06, divs=2, travesano=z1 - 0.55,
                        mat='carpinteria_oscura', vidrio='vidrio_oscuro', perfil=0.07)
            B.box('carpinteria_oscura', (x0, d - 0.12, 0), (x1, d, z0), M)
        else:
            arq.ventana(B, G, M, x0, x1, z0, z1, d - 0.05, divs=2, travesano=z1 - 0.5, mat=marco,
                        vidrio='vidrio_oscuro')
            # rejas
            for k in range(6):
                x = x0 + 0.1 + (x1 - x0 - 0.2) * k / 5
                B.box('hierro_forjado', (x - 0.01, 0.02, z0), (x + 0.01, 0.04, z1), M)
            B.box('piedra', (x0 - 0.08, -0.07, z0 - 0.07), (x1 + 0.08, 0.0, z0), M, tint=tint_bajo)
    if comercio:
        # rótulo + toldo
        tx = [h for h in hb if h[0] == 'tienda']
        if tx:
            x0, x1 = tx[0][1], tx[-1][2]
            col = rnd.choice(TOLDOS)
            B.box('carpinteria_oscura', (x0, -0.08, 3.45), (x1, 0, 4.0), M, tint=(1, 1, 1))
            B.text('oro', tienda, 0.34, M @ T((x0 + x1) / 2, -0.085, 3.73), extrude=0.008)
            # toldo inclinado
            ang = math.radians(22)
            Mt = M @ T(x0 - 0.1, 0, 3.4) @ Rx(-ang)
            B.box('toldo', (0, -1.5, -0.01), (x1 - x0 + 0.2, 0, 0.01), Mt, tint=col)
            B.box('toldo', (0, -1.5, -0.25), (x1 - x0 + 0.2, -1.48, 0.0), Mt, tint=col)
            for xa in (0, x1 - x0 + 0.18):
                B.box('hierro_forjado', (xa, -1.5, -0.02), (xa + 0.02, 0, 0.0), Mt)

    # ---- plantas superiores
    hu = []
    for k in range(pisos):
        z = h0 + k * hf
        frances = estilo in ('haussmann', 'clasico')
        zb = z + (0.05 if frances else 0.85)
        zt = z + 2.45
        for c in range(ncol):
            cx = colw * (c + 0.5)
            hu.append((cx - ww / 2, cx + ww / 2, zb - h0, zt - h0))
    arq.fachada(B, M @ T(0, 0, h0), W, H - h0, hu, d, mat_muro, tint=tint_muro)
    for (x0, x1, zb, zt) in hu:
        zb += h0
        zt += h0
        arq.ventana(B, G, M, x0, x1, zb, zt, d - 0.05, divs=2, travesano=zt - 0.5, mat=marco,
                    vidrio='vidrio_oscuro')
        if estilo == 'ladrillo':
            B.box('piedra', (x0 - 0.06, -0.06, zb - 0.08), (x1 + 0.06, 0.0, zb), M, tint=(1, 1, 1))
            B.box('piedra', (x0 - 0.1, -0.03, zt), (x1 + 0.1, 0.0, zt + 0.22), M, tint=(1, 1, 1))
        else:
            B.box(mat_muro if estilo == 'haussmann' else 'piedra', (x0 - 0.1, -0.08, zt + 0.06),
                  (x1 + 0.1, 0.0, zt + 0.2), M, tint=tint_muro if estilo == 'haussmann' else (0.95, 0.93, 0.9))
        if estilo == 'clasico':
            # contraventanas abiertas
            B.box('contraventana', (x0 - ww / 2 - 0.02, -0.06, zb), (x0 - 0.02, -0.03, zt), M, tint=persiana)
            B.box('contraventana', (x1 + 0.02, -0.06, zb), (x1 + ww / 2 + 0.02, -0.03, zt), M, tint=persiana)
        if estilo in ('haussmann', 'clasico'):
            # barandilla de ventana francesa (si no hay balcón corrido)
            arq.barandilla(B, M @ T(x0 + 0.02, 0.05, zb), x1 - x0 - 0.04, h=0.95, paso=0.11, r=0.009)

    # ---- impostas / cornisas
    for k in range(1, pisos + 1):
        z = h0 + (k - 1) * hf
        if k == 1 or estilo == 'haussmann':
            B.box(mat_bajo if k == 1 else mat_muro, (0, -0.14, z - 0.18), (W, 0, z), M,
                  tint=tint_bajo if k == 1 else tint_muro)
    B.box(mat_muro, (0, -0.22, H - 0.5), (W, 0, H - 0.25), M, tint=tint_muro)
    B.box('piedra', (0, -0.42, H - 0.25), (W, 0, H - 0.08), M, tint=(0.95, 0.93, 0.9))
    for i in range(int(W / 0.35)):
        x = 0.1 + i * 0.35
        B.box('piedra', (x, -0.2, H - 0.62), (x + 0.12, 0, H - 0.5), M, tint=(0.95, 0.93, 0.9))

    # ---- balcones corridos (haussmann: 2º y último piso)
    if estilo == 'haussmann':
        for k in sorted({1, pisos - 1}):
            z = h0 + k * hf
            B.box('piedra', (0.1, -0.85, z - 0.16), (W - 0.1, 0, z + 0.04), M, tint=tint_muro)
            for i in range(ncol * 2 + 1):
                x = 0.25 + (W - 0.5) * i / (ncol * 2)
                B.box('piedra', (x - 0.07, -0.7, z - 0.45), (x + 0.07, 0, z - 0.16), M, tint=tint_muro)
            arq.barandilla(B, M @ T(0.15, -0.8, z + 0.04), W - 0.3, h=1.0)
    elif estilo == 'clasico':
        z = h0 + hf * 0
        for (x0, x1, zb, zt) in hu[:ncol]:
            B.box('piedra', (x0 - 0.3, -0.6, h0 - 0.12), (x1 + 0.3, 0, h0 + 0.05), M, tint=(0.9, 0.88, 0.84))
            arq.barandilla(B, M @ T(x0 - 0.28, -0.57, h0 + 0.05), x1 - x0 + 0.56, h=0.95)
            for xs in (x0 - 0.28, x1 + 0.28):
                arq.barandilla(B, M @ T(xs, -0.57, h0 + 0.05) @ Rz(math.pi / 2), 0.55, h=0.95)

    # ---- cubierta
    if estilo == 'haussmann':
        mansarda(B, G, M, W, D, H, ncol, colw, tint_muro)
    else:
        tejado(B, M, W, D, H, 'teja' if (estilo == 'clasico' or rnd.random() < 0.5) else 'zinc', tint_muro, mat_muro)
    # chimeneas
    for i in range(rnd.randint(1, 3)):
        x = rnd.uniform(0.8, W - 1.6)
        y = rnd.uniform(D * 0.35, D * 0.6)
        zt = H + (3.4 if estilo == 'haussmann' else D / 2 * math.tan(math.radians(30)) + 0.4)
        B.box('ladrillo', (x, y, H), (x + 0.75, y + 1.1, zt + 0.3), M)
        B.box('piedra', (x - 0.05, y - 0.05, zt + 0.3), (x + 0.8, y + 1.15, zt + 0.38), M, tint=(0.8, 0.78, 0.74))
        for j in range(3):
            B.cyl('teja', 0.07, zt + 0.38, zt + 0.7, 8, M @ T(x + 0.38, y + 0.2 + j * 0.35, 0))
    return H


def mansarda(B, G, M, W, D, H, ncol, colw, tint):
    hr = 3.3
    ins = 1.15
    w = arq.Weld()
    P = [(0, 0, H), (W, 0, H), (W, ins, H + hr), (0, ins, H + hr)]
    w.quad(P, (0, -1, 0.35))
    w.quad([(0, ins, H + hr), (W, ins, H + hr), (W, D - ins, H + hr), (0, D - ins, H + hr)], (0, 0, 1))
    w.quad([(0, D - ins, H + hr), (W, D - ins, H + hr), (W, D, H), (0, D, H)], (0, 1, 0.35))
    w.flush(B, 'zinc', M)
    w = arq.Weld()
    for x, nx in ((0, -1), (W, 1)):
        ids = [w.v(x, 0, H), w.v(x, ins, H + hr), w.v(x, D - ins, H + hr), w.v(x, D, H)]
        w.faces.append(tuple(ids) if nx < 0 else tuple(ids[::-1]))
    w.flush(B, 'estuco', M, tint=(0.7, 0.7, 0.7))
    # canalón
    B.box('zinc', (0, -0.2, H - 0.05), (W, 0.02, H + 0.12), M)
    # buhardillas
    for c in range(ncol):
        cx = colw * (c + 0.5)
        x0, x1 = cx - 0.62, cx + 0.62
        zb, zt = H + 0.5, H + 2.2
        y0 = 0.32
        B.box('piedra', (x0, y0, zb), (x0 + 0.14, 1.6, zt), M, tint=tint)
        B.box('piedra', (x1 - 0.14, y0, zb), (x1, 1.6, zt), M, tint=tint)
        B.box('piedra', (x0, y0, zb - 0.1), (x1, 1.6, zb + 0.05), M, tint=tint)
        B.box('piedra', (x0 - 0.05, y0 - 0.03, zt), (x1 + 0.05, 1.6, zt + 0.15), M, tint=tint)
        B.prism('zinc', [(x0 - 0.1, zt + 0.15), (x1 + 0.1, zt + 0.15), (cx, zt + 0.7)], y0 - 0.06, 1.7, M)
        arq.ventana(B, G, M, x0 + 0.14, x1 - 0.14, zb + 0.05, zt, y0 + 0.08, divs=2, mat='marco_ventana',
                    vidrio='vidrio_oscuro', perfil=0.05)


def tejado(B, M, W, D, H, mat, tint, mat_muro):
    pend = math.tan(math.radians(30))
    zr = H + D / 2 * pend
    ov = 0.45
    zf = H - ov * pend
    w = arq.Weld()
    w.quad([(-0.15, -ov, zf), (W + 0.15, -ov, zf), (W + 0.15, D / 2, zr), (-0.15, D / 2, zr)], (0, -1, 1))
    w.quad([(-0.15, D / 2, zr), (W + 0.15, D / 2, zr), (W + 0.15, D + ov, zf), (-0.15, D + ov, zf)], (0, 1, 1))
    w.flush(B, mat, M)
    w = arq.Weld()
    t = 0.12
    w.quad([(-0.15, -ov, zf - t), (W + 0.15, -ov, zf - t), (W + 0.15, D / 2, zr - t), (-0.15, D / 2, zr - t)], (0, 0, -1))
    w.quad([(-0.15, D / 2, zr - t), (W + 0.15, D / 2, zr - t), (W + 0.15, D + ov, zf - t), (-0.15, D + ov, zf - t)], (0, 0, -1))
    w.quad([(-0.15, -ov, zf - t), (W + 0.15, -ov, zf - t), (W + 0.15, -ov, zf), (-0.15, -ov, zf)], (0, -1, 0))
    w.quad([(-0.15, D + ov, zf - t), (W + 0.15, D + ov, zf - t), (W + 0.15, D + ov, zf), (-0.15, D + ov, zf)], (0, 1, 0))
    w.flush(B, 'madera_oscura', M)
    # hastiales
    w = arq.Weld()
    for x, nx in ((0, -1), (W, 1)):
        ids = [w.v(x, 0, H), w.v(x, D, H), w.v(x, D / 2, zr - 0.1)]
        w.faces.append(tuple(ids) if nx > 0 else tuple(ids[::-1]))
    w.flush(B, mat_muro, M, tint=tint)
    # cumbrera
    B.box(mat, (-0.15, D / 2 - 0.12, zr - 0.05), (W + 0.15, D / 2 + 0.12, zr + 0.08), M, tint=(0.85, 0.85, 0.85))


def fila(B, G, origen, xdir, largo, rnd, estilos, fondo=(13, 15), pisos=(4, 6), tiendas=None):
    xdir = Vector(xdir).normalized()
    x = 0.0
    while x < largo - 1.0:
        W = rnd.uniform(7.5, 11.5)
        if largo - (x + W) < 6.5:
            W = largo - x
        D = rnd.uniform(*fondo)
        estilo = rnd.choice(estilos)
        p = rnd.randint(*pisos)
        if estilo == 'haussmann':
            p = max(p, 5)
        o = Vector((origen[0], origen[1], 0.0)) + xdir * x
        M = frame(o, xdir)
        tienda = tiendas.pop(0) if tiendas and rnd.random() < 0.8 else None
        edificio(B, G, M, W, D, p, estilo, rnd, tienda)
        x += W


# ---------------------------------------------------------------------------
# SUELOS, CALLES Y PLAZA
# ---------------------------------------------------------------------------
ACERA_Z = 0.15


def suelos(S):
    S.box('cesped', (-90, -120, -0.3), (90, 80, -0.02), skip=('bottom',))
    # calzadas
    S.box('asfalto', (-48, -16, -0.2), (48, -8, 0.0), skip=('bottom',))
    S.box('asfalto', (-48, 22, -0.2), (48, 30, 0.0), skip=('bottom',))
    S.box('asfalto', (-30, -8, -0.2), (-22, 22, 0.0), skip=('bottom',))
    S.box('asfalto', (22, -8, -0.2), (30, 22, 0.0), skip=('bottom',))
    S.box('asfalto', (-58, -110, -0.2), (-50, 70, 0.0), skip=('bottom',))
    S.box('asfalto', (50, -110, -0.2), (58, 70, 0.0), skip=('bottom',))
    S.box('asfalto', (-50, -16, -0.2), (-48, -8, 0.0), skip=('bottom',))
    S.box('asfalto', (48, -16, -0.2), (50, -8, 0.0), skip=('bottom',))
    S.box('asfalto', (-50, 22, -0.2), (-48, 30, 0.0), skip=('bottom',))
    S.box('asfalto', (48, 22, -0.2), (50, 30, 0.0), skip=('bottom',))
    # aparcamientos del centro
    S.box('asfalto', (-48, -100, -0.2), (-30, -36, 0.0), skip=('bottom',), tint=(1.15, 1.15, 1.15))
    S.box('asfalto', (30, -100, -0.2), (48, -36, 0.0), skip=('bottom',), tint=(1.15, 1.15, 1.15))
    S.box('asfalto', (-30, -100, -0.2), (30, -86, 0.0), skip=('bottom',), tint=(1.15, 1.15, 1.15))
    # aceras
    z = ACERA_Z
    S.box('acera', (-34, -16, 0), (-30, 30, z), skip=('bottom',))
    S.box('acera', (30, -16, 0), (34, 30, z), skip=('bottom',))
    S.box('acera', (-48, 30, 0), (48, 34, z), skip=('bottom',))
    S.box('acera', (-48, -20, 0), (48, -16, z), skip=('bottom',))
    S.box('acera', (-50, -110, 0), (-48, 70, z), skip=('bottom',))
    S.box('acera', (48, -110, 0), (50, 70, z), skip=('bottom',))
    S.box('acera', (-48, -36, 0), (-30, -34, z), skip=('bottom',))
    S.box('acera', (30, -36, 0), (48, -34, z), skip=('bottom',))
    S.box('acera', (-48, 34, 0), (48, 36, z), skip=('bottom',), tint=(0.9, 0.9, 0.9))
    # plataforma del centro deportivo (hormigón peinado)
    S.box('concreto', (-30, -86, 0), (30, -20, z), skip=('bottom',), tint=(1.1, 1.1, 1.08))
    # plaza adoquinada
    S.box('adoquin', (-22, -8, 0), (22, 22, z), skip=('bottom',))
    # bordillos de granito
    zc = z + 0.012
    for (a, b_) in [((-22.15, -8.15), (22.15, -8)), ((-22.15, 22), (22.15, 22.15)),
                    ((-22.15, -8), (-22, 22)), ((22, -8), (22.15, 22)),
                    ((-30.15, -16), (-30, 30)), ((30, -16), (30.15, 30)),
                    ((-48, 29.85), (48, 30)), ((-48, -16), (48, -15.85)),
                    ((-48.15, -110), (-48, 70)), ((48, -110), (48.15, 70)),
                    ((-50, -110), (-49.85, 70)), ((49.85, -110), (50, 70))]:
        S.box('bordillo', (a[0], a[1], -0.05), (b_[0], b_[1], zc), skip=('bottom',))
    # marcas viales
    for y in (-12.0, 26.0):
        x = -46
        while x < 46:
            if not (-4 < x < 4):
                S.box('pintura_blanca', (x, y - 0.06, 0), (x + 3, y + 0.06, 0.006), skip=('bottom',))
            x += 6
    for xc in (-26.0, 26.0, -54.0, 54.0):
        y = -108 if abs(xc) > 50 else -6
        while y < (68 if abs(xc) > 50 else 20):
            S.box('pintura_blanca', (xc - 0.06, y, 0), (xc + 0.06, y + 3, 0.006), skip=('bottom',))
            y += 6
    # paso de cebra frente al centro
    for i in range(7):
        y = -15.4 + i * 1.0
        S.box('pintura_blanca', (-3, y, 0), (3, y + 0.5, 0.006), skip=('bottom',))
    for i in range(6):
        x = -27.5 + i * 1.0
        S.box('pintura_blanca', (x, 9, 0), (x + 0.5, 15, 0.006), skip=('bottom',))
        S.box('pintura_blanca', (-x - 0.5, 9, 0), (-x, 15, 0.006), skip=('bottom',))
    # plazas de aparcamiento
    for xa, xb in ((-47.5, -30.5), (30.5, 47.5)):
        for row_y in (-40, -58, -76, -94):
            for i in range(int((xb - xa) / 2.5) + 1):
                x = xa + i * 2.5
                S.box('pintura_blanca', (x - 0.06, row_y - 5, 0), (x + 0.06, row_y, 0.006), skip=('bottom',))
    for i in range(int(56 / 2.5) + 1):
        x = -28 + i * 2.5
        S.box('pintura_blanca', (x - 0.06, -91, 0), (x + 0.06, -86.5, 0.006), skip=('bottom',))


# ---------------------------------------------------------------------------
# MOBILIARIO URBANO
# ---------------------------------------------------------------------------
def farola(U, Gv, x, y, z=ACERA_Z):
    M = T(x, y, z)
    U.lathe('hierro_forjado', [(0.0, 0), (0.22, 0), (0.22, 0.15), (0.16, 0.3), (0.12, 0.7), (0.15, 0.8),
                               (0.07, 0.95), (0.065, 3.6), (0.09, 3.7), (0.0, 3.75)], 12, M)
    for k in range(8):
        a = TAU * k / 8
        U.box('hierro_forjado', (-0.012, -0.012, 1.0), (0.012, 0.012, 3.5),
              M @ T(0.07 * math.cos(a), 0.07 * math.sin(a), 0))
    # farol
    Mf = M @ T(0, 0, 3.75)
    U.lathe('hierro_forjado', [(0.0, 0), (0.12, 0), (0.12, 0.06), (0.0, 0.06)], 8, Mf, a0=math.pi / 8, a1=math.pi / 8 + TAU)
    for k in range(4):
        a = TAU * k / 4 + math.pi / 4
        U.box('hierro_forjado', (-0.012, -0.012, 0.06), (0.012, 0.012, 0.62),
              Mf @ T(0.2 * math.cos(a), 0.2 * math.sin(a), 0) @ Ry(0.0))
    U.lathe('hierro_forjado', [(0.0, 0.6), (0.3, 0.6), (0.3, 0.66), (0.08, 0.86), (0.04, 0.95), (0.0, 0.98)], 4,
            Mf, a0=math.pi / 4, a1=math.pi / 4 + TAU)
    Gv.lathe('vidrio_oscuro', [(0.1, 0.06), (0.21, 0.6)], 4, Mf, a0=math.pi / 4, a1=math.pi / 4 + TAU, cap0=False, cap1=False)


def banco(U, M):
    for x in (0.1, 0.9, 1.7):
        U.box('hierro_forjado', (x, -0.25, 0), (x + 0.06, 0.25, 0.08), M)
        U.box('hierro_forjado', (x + 0.01, -0.2, 0.08), (x + 0.05, -0.16, 0.42), M)
        U.box('hierro_forjado', (x + 0.01, 0.16, 0.08), (x + 0.05, 0.22, 0.85), M @ T(0, 0, 0) @ Rx(0.0))
    for i in range(5):
        y = -0.22 + i * 0.09
        U.box('madera_oscura', (0, y, 0.42), (1.8, y + 0.07, 0.45), M)
    for i in range(3):
        z = 0.52 + i * 0.12
        U.box('madera_oscura', (0, 0.2, z), (1.8, 0.23, z + 0.09), M)


def arbol(U, A, x, y, z, rnd, alto=9.0, rejilla=True):
    M = T(x, y, z)
    U.lathe('corteza', [(0.0, -0.1), (0.32, -0.1), (0.24, 0.3), (0.2, alto * 0.42), (0.0, alto * 0.45)], 10, M)
    if rejilla:
        U.box('hierro_forjado', (x - 0.8, y - 0.8, z), (x + 0.8, y + 0.8, z + 0.015), tint=(0.6, 0.6, 0.6))
    base = Vector((x, y, z + alto * 0.4))
    ramas = []
    nram = rnd.randint(4, 6)
    for i in range(nram):
        a = TAU * i / nram + rnd.uniform(-0.3, 0.3)
        el = rnd.uniform(0.5, 0.95)
        L = alto * rnd.uniform(0.3, 0.42)
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        p1 = base + d * L
        U.cyl_between('corteza', base, p1, 0.11, 6)
        ramas.append(p1)
    # copa: grupos de "nubes" de hojas deformadas
    centros = ramas + [base + Vector((0, 0, alto * 0.45))]
    for c in centros:
        for k in range(4):
            r = alto * rnd.uniform(0.12, 0.2)
            off = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-0.3, 0.8))) * r * 0.9
            nube(A, c + off, r, rnd)


def nube(A, c, r, rnd, seg=10, rings=7):
    """Esfera deformada (ruido determinista) para copas de árbol."""
    ph = [rnd.uniform(0, TAU) for _ in range(6)]
    verts = []
    rows = []
    for i in range(rings + 1):
        th = math.pi * i / rings
        row = []
        n = 1 if i in (0, rings) else seg
        for j in range(n):
            a = TAU * j / seg
            dx, dy, dz = math.sin(th) * math.cos(a), math.sin(th) * math.sin(a), -math.cos(th)
            k = 1.0 + 0.18 * math.sin(3 * a + ph[0]) * math.sin(2 * th + ph[1]) + 0.1 * math.sin(5 * a + ph[2] + 3 * th)
            if dz < -0.3:
                k *= 0.85
            row.append(len(verts))
            verts.append((c.x + dx * r * k, c.y + dy * r * k, c.z + dz * r * k * 0.8))
        rows.append(row)
    faces = []
    for i in range(rings):
        a, b = rows[i], rows[i + 1]
        for j in range(seg):
            j1 = (j + 1) % seg
            if len(a) == 1:
                faces.append((a[0], b[j1], b[j]))
            elif len(b) == 1:
                faces.append((a[j], a[j1], b[0]))
            else:
                faces.append((a[j], a[j1], b[j1], b[j]))
    A.add(verts, faces, None, 'hojas', tint=(rnd.uniform(0.85, 1.1),) * 3)


def fuente(U, W_, x, y, z=ACERA_Z):
    M = T(x, y, z)
    U.lathe('granito', [(0.0, 0.0), (4.2, 0.0), (4.2, 0.55), (3.9, 0.6), (3.9, 0.2), (0.0, 0.2)], 8, M,
            a0=math.pi / 8, a1=math.pi / 8 + TAU)
    W_.cyl('agua_fuente', 3.9, 0.0, 0.45, 8, M, a0=math.pi / 8, a1=math.pi / 8 + TAU, cap0=False)
    U.lathe('piedra', [(0.0, 0.2), (0.6, 0.2), (0.5, 0.5), (0.35, 0.6), (0.3, 1.6), (0.45, 1.75), (1.6, 1.85),
                       (1.6, 2.0), (1.4, 2.05), (0.3, 2.1), (0.22, 2.9), (0.6, 3.0), (0.6, 3.1), (0.15, 3.2),
                       (0.12, 3.8), (0.2, 3.9), (0.0, 4.05)], 16, M, tint=(0.95, 0.94, 0.9))
    W_.cyl('agua_fuente', 1.45, 1.95, 2.02, 16, M, cap0=False)


def kiosco(U, G, x, y, z=ACERA_Z):
    M = T(x, y, z)
    U.lathe('carpinteria_oscura', [(0.0, 0), (1.3, 0), (1.3, 0.9), (0.0, 0.9)], 8, M, a0=math.pi / 8, a1=math.pi / 8 + TAU)
    G.lathe('vidrio_oscuro', [(1.25, 0.9), (1.25, 2.2)], 8, M, a0=math.pi / 8, a1=math.pi / 8 + TAU, cap0=False, cap1=False)
    for k in range(8):
        a = TAU * k / 8 + math.pi / 8
        U.box('carpinteria_oscura', (-0.04, -0.04, 0.9), (0.04, 0.04, 2.25), M @ T(1.28 * math.cos(a), 1.28 * math.sin(a), 0))
    U.lathe('carpinteria_oscura', [(0.0, 2.2), (1.3, 2.2), (1.3, 2.75), (0.0, 2.75)], 8, M, a0=math.pi / 8, a1=math.pi / 8 + TAU)
    U.lathe('zinc', [(0.0, 2.75), (1.55, 2.75), (0.6, 3.5), (0.15, 3.9), (0.0, 4.2)], 8, M, a0=math.pi / 8, a1=math.pi / 8 + TAU)
    for k in range(8):
        a = TAU * k / 8 + math.pi / 4
        U.text('oro', 'PRENSA', 0.22, M @ Rz(a + math.pi / 2) @ T(0, -1.31, 2.48), extrude=0.005)


def terraza(U, x0, y0, n=4):
    for i in range(n):
        x = x0 + i * 2.6
        M = T(x, y0, ACERA_Z)
        U.lathe('hierro_forjado', [(0.0, 0), (0.25, 0), (0.25, 0.02), (0.03, 0.05), (0.03, 0.72), (0.0, 0.73)], 10, M)
        U.cyl('granito', 0.35, 0.72, 0.75, 16, M, tint=(1.1, 1.1, 1.1))
        for a in (0.3, math.pi + 0.3):
            Mc = M @ Rz(a) @ T(0.62, 0, 0)
            silla_bistro(U, Mc)
        # sombrilla
        U.cyl('madera_oscura', 0.02, 0.75, 2.4, 6, M)
        U.lathe('toldo', [(0.02, 2.0), (1.3, 2.05), (0.0, 2.45)], 8, M, tint=(0.95, 0.94, 0.9))


def silla_bistro(U, M):
    for (x, y) in ((-0.18, -0.18), (0.18, -0.18), (-0.18, 0.18), (0.18, 0.18)):
        U.box('aluminio', (x - 0.012, y - 0.012, 0), (x + 0.012, y + 0.012, 0.45), M)
    U.box('madera_clara', (-0.21, -0.21, 0.45), (0.21, 0.21, 0.48), M, tint=(0.6, 0.45, 0.3))
    U.box('aluminio', (0.17, -0.2, 0.48), (0.2, 0.2, 0.85), M)
    for z in (0.6, 0.75):
        U.box('madera_clara', (0.2, -0.2, z), (0.22, 0.2, z + 0.06), M, tint=(0.6, 0.45, 0.3))


def bolardo(U, x, y, z=ACERA_Z):
    U.lathe('hierro_forjado', [(0.0, 0), (0.1, 0), (0.09, 0.15), (0.07, 0.75), (0.09, 0.8), (0.05, 0.9), (0.0, 0.92)], 10, T(x, y, z))


def papelera(U, x, y, z=ACERA_Z):
    M = T(x, y, z)
    U.cyl('pintura_gris', 0.04, 0, 0.9, 6, M, tint=(0.3, 0.33, 0.3))
    U.lathe('pintura_gris', [(0.0, 0.3), (0.2, 0.3), (0.22, 0.9), (0.0, 0.9)], 12, M @ T(0.25, 0, 0), tint=(0.25, 0.32, 0.27))


def mobiliario(U, A, G, W_, rnd):
    fuente(U, W_, 0, 7)
    # plátanos de sombra en la plaza
    for x in (-17.5, 17.5):
        for y in (-4, 2.5, 9, 15.5):
            arbol(U, A, x, y, ACERA_Z, rnd, alto=rnd.uniform(9, 11.5))
    for x in (-8, 8):
        for y in (19,):
            arbol(U, A, x, y, ACERA_Z, rnd, alto=rnd.uniform(8, 10))
    # bancos alrededor de la fuente
    for k in range(8):
        a = TAU * k / 8 + math.pi / 8
        M = T(7.0 * math.cos(a), 7 + 7.0 * math.sin(a), ACERA_Z) @ Rz(a + math.pi / 2) @ T(-0.9, 0, 0)
        banco(U, M)
    for y in (-1, 6, 13):
        banco(U, T(-19.5, y, ACERA_Z) @ Rz(-math.pi / 2) @ T(-0.9, 0, 0))
        banco(U, T(19.5, y, ACERA_Z) @ Rz(math.pi / 2) @ T(-0.9, 0, 0))
    # farolas
    for y in range(-14, 31, 14):
        farola(U, G, -31.0, y)
        farola(U, G, 31.0, y)
    for x in range(-42, 43, 14):
        farola(U, G, x, 31.0)
        farola(U, G, x, -17.0)
    for (x, y) in ((-21, -7), (21, -7), (-21, 21), (21, 21)):
        farola(U, G, x, y)
    for y in range(-100, 70, 18):
        farola(U, G, -49.0, y)
        farola(U, G, 49.0, y)
    kiosco(U, G, 15, -3)
    terraza(U, -44, 32.4, 5)
    terraza(U, 20, 32.4, 4)
    for x in range(-20, 21, 4):
        if abs(x) > 4:
            bolardo(U, x, -7.7)
    for (x, y) in ((-21.4, 0), (21.4, 0), (-21.4, 14), (21.4, 14), (-31, -5), (31, 25), (-6, -17.4), (6, -17.4)):
        papelera(U, x, y)
    # árboles del aparcamiento y bordes
    for x in (-39, 39):
        for y in (-48, -66, -84):
            arbol(U, A, x, y, 0.0, rnd, alto=rnd.uniform(7, 9), rejilla=False)
    for x in range(-24, 25, 12):
        arbol(U, A, x, -96, 0.0, rnd, alto=rnd.uniform(7, 9), rejilla=False)
    for y in range(-104, 66, 16):
        arbol(U, A, -64, y, -0.02, rnd, alto=rnd.uniform(8, 12), rejilla=False)
        arbol(U, A, 64, y, -0.02, rnd, alto=rnd.uniform(8, 12), rejilla=False)


def edificios(BO, BE, BN, BS, G, rnd):
    tiendas = list(TIENDAS)
    rnd.shuffle(tiendas)
    tiendas.insert(0, 'CAFÉ CENTRAL')
    fila(BN, G, (-48, 36), (1, 0, 0), 96, rnd, ['haussmann', 'haussmann', 'clasico'], tiendas=tiendas)
    fila(BO, G, (-34, -16), (0, 1, 0), 52, rnd, ['clasico', 'haussmann', 'ladrillo'], tiendas=tiendas)
    fila(BE, G, (34, 36), (0, -1, 0), 52, rnd, ['clasico', 'ladrillo', 'haussmann'], tiendas=tiendas)
    fila(BS, G, (-30, -20), (-1, 0, 0), 18, rnd, ['ladrillo', 'clasico'], fondo=(12, 14), pisos=(3, 5), tiendas=tiendas)
    fila(BS, G, (48, -20), (-1, 0, 0), 18, rnd, ['clasico', 'ladrillo'], fondo=(12, 14), pisos=(3, 5), tiendas=tiendas)
