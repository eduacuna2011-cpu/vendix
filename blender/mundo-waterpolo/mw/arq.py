# -*- coding: utf-8 -*-
"""Piezas arquitectónicas: muros con huecos, ventanas, puertas, fachadas con
huecos rehundidos (soldando vértices para que el lightmap sea continuo)."""
import math
from mathutils import Vector
from .geo import T, Rz, Ry, Rx


class Weld:
    """Acumulador de malla con soldadura de vértices (para fachadas)."""

    def __init__(self):
        self.verts = []
        self.idx = {}
        self.faces = []

    def v(self, x, y, z):
        k = (round(x, 4), round(y, 4), round(z, 4))
        i = self.idx.get(k)
        if i is None:
            i = len(self.verts)
            self.idx[k] = i
            self.verts.append((x, y, z))
        return i

    def quad(self, pts, normal):
        ids = [self.v(*p) for p in pts]
        a, b, c = (Vector(pts[i]) for i in range(3))
        n = (b - a).cross(c - a)
        if n.dot(Vector(normal)) < 0:
            ids = ids[::-1]
        self.faces.append(tuple(ids))

    def flush(self, b, mat, M, **kw):
        if self.faces:
            b.add(self.verts, self.faces, M, mat, **kw)


def fachada(b, M, W, H, huecos, d, mat, tint=(1, 1, 1)):
    """Plano de fachada x∈[0,W], z∈[0,H] en y=0 mirando a -Y, con huecos
    rehundidos de profundidad d. huecos = [(x0, x1, z0, z1), ...].
    Devuelve nada; las jambas/dinteles/alféizares van con el material del muro."""
    xs = sorted({0.0, W, *[h[0] for h in huecos], *[h[1] for h in huecos]})
    zs = sorted({0.0, H, *[h[2] for h in huecos], *[h[3] for h in huecos]})

    def hueco(cx, cz):
        for i, h in enumerate(huecos):
            if h[0] < cx < h[1] and h[2] < cz < h[3]:
                return i
        return -1

    nx, nz = len(xs) - 1, len(zs) - 1
    cell = [[hueco((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2) for j in range(nz)] for i in range(nx)]
    w = Weld()
    for i in range(nx):
        for j in range(nz):
            x0, x1, z0, z1 = xs[i], xs[i + 1], zs[j], zs[j + 1]
            h = cell[i][j]
            if h < 0:
                w.quad([(x0, 0, z0), (x1, 0, z0), (x1, 0, z1), (x0, 0, z1)], (0, -1, 0))
                continue
            # jambas / dintel / alféizar donde el vecino no es el mismo hueco
            if i == 0 or cell[i - 1][j] != h:
                w.quad([(x0, 0, z0), (x0, d, z0), (x0, d, z1), (x0, 0, z1)], (1, 0, 0))
            if i == nx - 1 or cell[i + 1][j] != h:
                w.quad([(x1, 0, z0), (x1, d, z0), (x1, d, z1), (x1, 0, z1)], (-1, 0, 0))
            if j == 0 or cell[i][j - 1] != h:
                w.quad([(x0, 0, z0), (x1, 0, z0), (x1, d, z0), (x0, d, z0)], (0, 0, 1))
            if j == nz - 1 or cell[i][j + 1] != h:
                w.quad([(x0, 0, z1), (x1, 0, z1), (x1, d, z1), (x0, d, z1)], (0, 0, -1))
    w.flush(b, mat, M, tint=tint)


def muro(bA, bB, matA, matB, M, L, t, z0, z1, huecos=(), tintA=(1, 1, 1), tintB=(1, 1, 1)):
    """Muro local x∈[0,L], y∈[0,t]; cara A en y=0 (mira a -Y), cara B en y=t.
    Cada mitad del espesor va a su propio builder (A: un lado, B: el otro), así
    el exterior y el interior de un muro pueden hornearse en grupos distintos.
    huecos = [(x0, x1, zb, zt)] (puertas: zb = z0)."""
    tA = t * 0.5
    piezas = []
    cur = 0.0
    for (a, c, zb, zt) in sorted(huecos):
        if a > cur + 1e-4:
            piezas.append((cur, a, z0, z1))
        if zb > z0 + 1e-4:
            piezas.append((a, c, z0, zb))
        if zt < z1 - 1e-4:
            piezas.append((a, c, zt, z1))
        cur = c
    if cur < L - 1e-4:
        piezas.append((cur, L, z0, z1))
    for (xa, xb, za, zb) in piezas:
        if bA is not None:
            bA.box(matA, (xa, 0, za), (xb, tA, zb), M, skip=('back', 'bottom'), tint=tintA)
        if bB is not None:
            bB.box(matB, (xa, tA, za), (xb, t, zb), M, skip=('front', 'bottom'), tint=tintB)


def ventana(bF, bG, M, x0, x1, zb, zt, y, prof=0.08, perfil=0.055, divs=1, travesano=None,
            mat='aluminio', vidrio='vidrio', tint=(1, 1, 1)):
    """Carpintería (marco + montantes + travesaño opcional) y vidrio en el plano y."""
    p = perfil
    ya, yb = y - prof / 2, y + prof / 2
    bF.box(mat, (x0, ya, zb), (x1, yb, zb + p), M, tint=tint)
    bF.box(mat, (x0, ya, zt - p), (x1, yb, zt), M, tint=tint)
    bF.box(mat, (x0, ya, zb + p), (x0 + p, yb, zt - p), M, tint=tint)
    bF.box(mat, (x1 - p, ya, zb + p), (x1, yb, zt - p), M, tint=tint)
    for k in range(1, divs):
        xm = x0 + (x1 - x0) * k / divs
        bF.box(mat, (xm - p * 0.4, ya + 0.005, zb + p), (xm + p * 0.4, yb - 0.005, zt - p), M, tint=tint)
    if travesano:
        bF.box(mat, (x0 + p, ya + 0.005, travesano - p * 0.4), (x1 - p, yb - 0.005, travesano + p * 0.4), M, tint=tint)
    if bG is not None:
        bG.box(vidrio, (x0 + p * 0.5, y - 0.004, zb + p * 0.5), (x1 - p * 0.5, y + 0.004, zt - p * 0.5), M)


def puerta(bF, M, x0, x1, z0, zt, t, mat_marco='aluminio', mat_hoja='madera_clara', abierta=0.0,
           bG=None, vidriada=False, tint=(1, 1, 1)):
    """Marco en el hueco del muro (y∈[0,t]) y hoja (bisagra en x0, gira hacia +y)."""
    m = 0.05
    bF.box(mat_marco, (x0 - m, -0.01, z0), (x0, t + 0.01, zt + m), M)
    bF.box(mat_marco, (x1, -0.01, z0), (x1 + m, t + 0.01, zt + m), M)
    bF.box(mat_marco, (x0 - m, -0.01, zt), (x1 + m, t + 0.01, zt + m), M)
    w = x1 - x0
    Mh = M @ T(x0, t * 0.5, z0) @ Rz(abierta)
    if vidriada and bG is not None:
        bF.box(mat_marco, (0, -0.02, 0), (w, 0.02, 0.12), Mh)
        bF.box(mat_marco, (0, -0.02, zt - z0 - 0.08), (w, 0.02, zt - z0 - 0.005), Mh)
        bF.box(mat_marco, (0, -0.02, 0.12), (0.07, 0.02, zt - z0 - 0.08), Mh)
        bF.box(mat_marco, (w - 0.07, -0.02, 0.12), (w, 0.02, zt - z0 - 0.08), Mh)
        bG.box('vidrio', (0.07, -0.004, 0.12), (w - 0.07, 0.004, zt - z0 - 0.08), Mh)
    else:
        bF.box(mat_hoja, (0, -0.02, 0), (w, 0.02, zt - z0 - 0.005), Mh, tint=tint)
    # manilla
    bF.box('acero_inox', (w - 0.12, -0.07, 1.0), (w - 0.06, -0.02, 1.03), Mh)
    bF.box('acero_inox', (w - 0.12, 0.02, 1.0), (w - 0.06, 0.07, 1.03), Mh)


def letrero(b, mat, txt, size, M, extrude=0.02, **kw):
    b.text(mat, txt, size, M, extrude=extrude, **kw)


def barandilla(b, M, L, h=1.0, paso=0.12, mat='hierro_forjado', r=0.012, pasamanos='hierro_forjado'):
    """Barandilla recta a lo largo de x (0..L) en y=0."""
    b.box(pasamanos, (0, -0.03, h - 0.04), (L, 0.03, h), M)
    b.box(mat, (0, -0.012, 0.06), (L, 0.012, 0.09), M)
    n = max(2, int(L / paso))
    for i in range(n + 1):
        x = L * i / n
        b.box(mat, (x - r, -r, 0.0), (x + r, r, h - 0.04), M)
