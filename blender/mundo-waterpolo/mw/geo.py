# -*- coding: utf-8 -*-
"""Constructor de mallas por lotes.

Para rendimiento NO se crea un objeto por pieza: cada "grupo" (p. ej. todo el
equipamiento del gimnasio) se acumula en un único Builder y se convierte en UN
objeto con varios materiales. Así hay pocos draw calls y cada grupo tiene un
único lightmap horneado.

Cada primitiva calcula sus UV (canal 'UVMap') en su espacio LOCAL con
proyección de caja escalada en metros / tamaño de tile del material, de modo
que las texturas tienen la misma densidad en todo el mundo.
"""
import math
from contextlib import contextmanager
import bpy
from mathutils import Matrix, Vector

IDENT = Matrix.Identity(4)
TAU = math.tau

# nombre de material -> (tile_u, tile_v) en metros. Lo rellena materiales.py
MAT_TILE = {}


def T(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def Rz(a):
    return Matrix.Rotation(a, 4, 'Z')


def Rx(a):
    return Matrix.Rotation(a, 4, 'X')


def Ry(a):
    return Matrix.Rotation(a, 4, 'Y')


def Sc(x, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    return Matrix.Diagonal((x, y, z, 1.0))


def frame(origin, xdir, ydir=None, zdir=(0, 0, 1)):
    """Matriz con origen y eje X dados (Z arriba por defecto)."""
    x = Vector(xdir).normalized()
    z = Vector(zdir).normalized()
    y = z.cross(x).normalized() if ydir is None else Vector(ydir).normalized()
    m = Matrix((
        (x.x, y.x, z.x, origin[0]),
        (x.y, y.y, z.y, origin[1]),
        (x.z, y.z, z.z, origin[2]),
        (0, 0, 0, 1)))
    return m


def align_z(p0, p1):
    """Matriz cuyo eje Z va de p0 a p1 (para cilindros entre dos puntos)."""
    p0 = Vector(p0)
    d = Vector(p1) - p0
    L = d.length
    z = d.normalized()
    up = Vector((0, 0, 1)) if abs(z.z) < 0.95 else Vector((1, 0, 0))
    x = up.cross(z).normalized()
    y = z.cross(x)
    m = Matrix((
        (x.x, y.x, z.x, p0.x),
        (x.y, y.y, z.y, p0.y),
        (x.z, y.z, z.z, p0.z),
        (0, 0, 0, 1)))
    return m, L


def _newell(pts):
    n = Vector((0, 0, 0))
    for i in range(len(pts)):
        a = pts[i]
        b = pts[(i + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n


def box_uv(p, n, tu, tv, off):
    ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
    if az >= ax and az >= ay:
        u, v = p.x, (p.y if n.z > 0 else -p.y)
    elif ax >= ay:
        u, v = (p.y if n.x > 0 else -p.y), p.z
    else:
        u, v = (-p.x if n.y > 0 else p.x), p.z
    return (u / tu + off[0], v / tv + off[1])


class Builder:
    def __init__(self, name, bake=True, res=1024):
        self.name = name
        self.bake = bake
        self.res = res
        self.V = []
        self.F = []
        self.FM = []
        self.FUV = []
        self.FT = []
        self.mats = []
        self._mi = {}
        # piezas: cada cara recuerda a qué objeto lógico pertenece (rack, barra, disco...)
        # para poder separarlo después en objetos independientes sin perder el lightmap
        self.FP = []
        self.piezas = [name]
        self._pi = {name: 0}
        self.cur = 0

    # ------------------------------------------------------------------
    def mi(self, mat):
        if mat not in self._mi:
            self._mi[mat] = len(self.mats)
            self.mats.append(mat)
        return self._mi[mat]

    def nfaces(self):
        return len(self.F)

    def pieza(self, nombre):
        """Fija la pieza actual; devuelve la anterior (índice) para restaurarla."""
        prev = self.cur
        # cada llamada crea una instancia nueva (dos discos de 25 kg = dos objetos)
        self.piezas.append(nombre)
        self.cur = len(self.piezas) - 1
        return prev

    @contextmanager
    def p(self, nombre):
        prev = self.pieza(nombre)
        try:
            yield self
        finally:
            self.cur = prev

    def add(self, verts, faces, M=None, mat='pintura', uvs=None, tint=(1, 1, 1),
            tile=None, uvoff=(0.0, 0.0)):
        M = IDENT if M is None else M
        base = len(self.V)
        tu, tv = tile or MAT_TILE.get(mat, (1.0, 1.0))
        lv = [Vector(v) for v in verts]
        self.V.extend(tuple(M @ v) for v in lv)
        m = self.mi(mat)
        tint = tuple(tint)
        for fi, f in enumerate(faces):
            self.F.append([base + i for i in f])
            self.FP.append(self.cur)
            self.FM.append(m)
            self.FT.append(tint)
            if uvs is not None:
                self.FUV.append(uvs[fi])
            else:
                pts = [lv[i] for i in f]
                n = _newell(pts)
                self.FUV.append([box_uv(p, n, tu, tv, uvoff) for p in pts])

    # ------------------------------------------------------------------
    # primitivas
    # ------------------------------------------------------------------
    def box(self, mat, a, b, M=None, tint=(1, 1, 1), tile=None, uvoff=(0, 0), skip=()):
        x0, y0, z0 = a
        x1, y1, z1 = b
        if x0 > x1:
            x0, x1 = x1, x0
        if y0 > y1:
            y0, y1 = y1, y0
        if z0 > z1:
            z0, z1 = z1, z0
        v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
             (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
        caras = {'bottom': (0, 3, 2, 1), 'top': (4, 5, 6, 7), 'front': (0, 1, 5, 4),
                 'back': (2, 3, 7, 6), 'left': (3, 0, 4, 7), 'right': (1, 2, 6, 5)}
        f = [c for k, c in caras.items() if k not in skip]
        self.add(v, f, M, mat, tint=tint, tile=tile, uvoff=uvoff)

    def boxc(self, mat, c, s, rz=0.0, M=None, **kw):
        """Caja por centro y tamaño, con rotación opcional en Z."""
        hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
        m = T(*c) @ Rz(rz) if rz else T(*c)
        if M is not None:
            m = M @ m
        self.box(mat, (-hx, -hy, -hz), (hx, hy, hz), m, **kw)

    def quad(self, mat, pts, M=None, **kw):
        self.add(pts, [(0, 1, 2, 3)], M, mat, **kw)

    def lathe(self, mat, prof, seg=16, M=None, a0=0.0, a1=TAU, cap0=True, cap1=True,
              closed=False, tint=(1, 1, 1), tile=None):
        """Sólido de revolución alrededor de Z. prof = [(r, z), ...] en sentido
        antihorario en el plano (r, z) => normales hacia fuera."""
        full = abs(a1 - a0) >= TAU - 1e-6
        ncol = seg if full else seg + 1
        tu, tv = tile or MAT_TILE.get(mat, (1.0, 1.0))
        rmax = max(p[0] for p in prof) or 1e-3
        verts = []
        rings = []
        for r, z in prof:
            if r < 1e-7:
                rings.append([len(verts)])
                verts.append((0.0, 0.0, z))
            else:
                ring = []
                for j in range(ncol):
                    a = a0 + (a1 - a0) * j / seg
                    ring.append(len(verts))
                    verts.append((r * math.cos(a), r * math.sin(a), z))
                rings.append(ring)
        # coordenada v = longitud de perfil
        vs = [0.0]
        for i in range(1, len(prof)):
            dr = prof[i][0] - prof[i - 1][0]
            dz = prof[i][1] - prof[i - 1][1]
            vs.append(vs[-1] + math.hypot(dr, dz))
        U = (a1 - a0) * rmax / tu
        faces = []
        uvs = []
        npts = len(prof)
        pairs = [(i, i + 1) for i in range(npts - 1)]
        if closed:
            pairs.append((npts - 1, 0))
            vs.append(vs[-1] + math.hypot(prof[0][0] - prof[-1][0], prof[0][1] - prof[-1][1]))
        for (i, k) in pairs:
            ri, rk = rings[i], rings[k]
            vi = vs[i] / tv
            vk = (vs[k] if k != 0 or not closed else vs[-1]) / tv
            for j in range(seg):
                j1 = (j + 1) % ncol if full else j + 1
                u0 = U * j / seg
                u1 = U * (j + 1) / seg
                if len(ri) == 1 and len(rk) == 1:
                    continue
                if len(ri) == 1:
                    faces.append((ri[0], rk[j1], rk[j]))
                    uvs.append([((u0 + u1) / 2, vi), (u1, vk), (u0, vk)])
                elif len(rk) == 1:
                    faces.append((ri[j], ri[j1], rk[0]))
                    uvs.append([(u0, vi), (u1, vi), ((u0 + u1) / 2, vk)])
                else:
                    faces.append((ri[j], ri[j1], rk[j1], rk[j]))
                    uvs.append([(u0, vi), (u1, vi), (u1, vk), (u0, vk)])
        if full:
            if cap0 and len(rings[0]) > 1:
                ring = rings[0][::-1]
                faces.append(tuple(ring))
                uvs.append([(verts[q][0] / tu, verts[q][1] / tv) for q in ring])
            if cap1 and len(rings[-1]) > 1 and not closed:
                ring = rings[-1]
                faces.append(tuple(ring))
                uvs.append([(verts[q][0] / tu, verts[q][1] / tv) for q in ring])
        self.add(verts, faces, M, mat, uvs=uvs, tint=tint)

    def cyl(self, mat, r, z0, z1, seg=16, M=None, **kw):
        self.lathe(mat, [(r, z0), (r, z1)], seg, M, **kw)

    def cyl_between(self, mat, p0, p1, r, seg=12, **kw):
        m, L = align_z(p0, p1)
        self.lathe(mat, [(r, 0.0), (r, L)], seg, m, **kw)

    def sphere(self, mat, r, seg=16, rings=10, M=None, **kw):
        prof = []
        for i in range(rings + 1):
            ph = math.pi * i / rings
            prof.append((r * math.sin(ph), -r * math.cos(ph)))
        prof[0] = (0.0, -r)
        prof[-1] = (0.0, r)
        self.lathe(mat, prof, seg, M, **kw)

    def torus(self, mat, R, r, seg=24, segr=8, M=None, a0=0.0, a1=TAU, **kw):
        prof = [(R + r * math.cos(TAU * i / segr), r * math.sin(TAU * i / segr)) for i in range(segr)]
        # antihorario en (r,z) empezando por fuera
        self.lathe(mat, prof, seg, M, a0=a0, a1=a1, closed=True, cap0=False, cap1=False, **kw)

    def prism(self, mat, poly, y0, y1, M=None, **kw):
        """Extruye un polígono definido en el plano XZ (antihorario visto desde -Y)."""
        n = len(poly)
        verts = [(x, y0, z) for x, z in poly] + [(x, y1, z) for x, z in poly]
        faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, n + i, n + j, j))
        self.add(verts, faces, M, mat, **kw)

    def text(self, mat, body, size, M=None, align='CENTER', extrude=0.004, bold=False, **kw):
        """Texto 3D (curva de texto convertida a malla) en el plano XZ mirando a -Y."""
        cu = bpy.data.curves.new('tmp_txt', 'FONT')
        cu.body = body
        cu.size = size
        cu.extrude = extrude
        cu.align_x = align
        cu.align_y = 'CENTER'
        cu.resolution_u = 3
        ob = bpy.data.objects.new('tmp_txt', cu)
        bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        verts = [(v.co.x, -v.co.z, v.co.y) for v in me.vertices]  # XY -> XZ
        faces = [tuple(p.vertices) for p in me.polygons]
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        bpy.data.meshes.remove(me)
        self.add(verts, faces, M, mat, **kw)

    # ------------------------------------------------------------------
    def build(self, coll, get_material):
        me = bpy.data.meshes.new(self.name)
        me.from_pydata(self.V, [], self.F)
        me.polygons.foreach_set('material_index', self.FM)
        at = me.attributes.new('pieza', 'INT', 'FACE')
        at.data.foreach_set('value', self.FP)
        uvl = me.uv_layers.new(name='UVMap')
        flat = [c for f in self.FUV for uv in f for c in uv]
        uvl.data.foreach_set('uv', flat)
        ca = me.color_attributes.new('Tinte', 'BYTE_COLOR', 'CORNER')
        cols = []
        for f, t in zip(self.F, self.FT):
            cols.extend((t[0], t[1], t[2], 1.0) * len(f))
        ca.data.foreach_set('color_srgb', cols)
        me.color_attributes.active_color = ca
        for m in self.mats:
            me.materials.append(get_material(m, self.name if self.bake else None))
        me.validate(clean_customdata=False)
        ob = bpy.data.objects.new(self.name, me)
        ob['piezas'] = list(self.piezas)
        coll.objects.link(ob)
        # suavizado por ángulo (cajas planas, cilindros suaves)
        _select_only(ob)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        return ob


def _select_only(ob):
    vl = bpy.context.view_layer
    vl.update()
    for o in vl.objects:
        if o is not None:
            o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def lightmap_uv(ob, res, margen_px=1, angulo=45.0):
    """Canal UV 'Lightmap' sin solapes, generado a mano (más fiable y denso que
    smart project con miles de islas):
      1. cartas = caras conectadas con normal a < 'angulo' de la cara semilla
      2. cada carta se proyecta en su plano, en METROS (densidad uniforme)
      3. empaquetado en estantes + búsqueda binaria de los píxeles/metro que
         caben en res x res, con un margen fijo en píxeles entre cartas."""
    import numpy as np
    me = ob.data
    nv, nf, nl = len(me.vertices), len(me.polygons), len(me.loops)
    co = np.empty(nv * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    ls = np.empty(nf, dtype=np.int64)
    lt = np.empty(nf, dtype=np.int64)
    me.polygons.foreach_get('loop_start', ls)
    me.polygons.foreach_get('loop_total', lt)
    lv = np.empty(nl, dtype=np.int64)
    me.loops.foreach_get('vertex_index', lv)
    N = np.empty(nf * 3)
    me.polygons.foreach_get('normal', N)
    N = N.reshape(-1, 3)
    A = np.empty(nf)
    me.polygons.foreach_get('area', A)
    lvl = lv.tolist()
    lsl = ls.tolist()
    ltl = lt.tolist()
    # adyacencia por aristas
    ef = {}
    for f in range(nf):
        a0 = lsl[f]
        n = ltl[f]
        for k in range(n):
            u = lvl[a0 + k]
            w = lvl[a0 + (k + 1) % n]
            key = (u, w) if u < w else (w, u)
            ef.setdefault(key, []).append(f)
    adj = [[] for _ in range(nf)]
    for fs in ef.values():
        if 1 < len(fs) < 5:
            for f in fs:
                for g in fs:
                    if g != f:
                        adj[f].append(g)
    cmin = math.cos(math.radians(angulo))
    chart = np.full(nf, -1, dtype=np.int64)
    orden = np.argsort(-A).tolist()
    charts = []
    Nl = N.tolist()
    for f in orden:
        if chart[f] >= 0:
            continue
        cid = len(charts)
        chart[f] = cid
        miembros = [f]
        if A[f] > 1e-10:
            n0 = Nl[f]
            pila = [f]
            while pila:
                g = pila.pop()
                for h in adj[g]:
                    if chart[h] < 0 and A[h] > 1e-10:
                        nh = Nl[h]
                        if nh[0] * n0[0] + nh[1] * n0[1] + nh[2] * n0[2] > cmin:
                            chart[h] = cid
                            miembros.append(h)
                            pila.append(h)
        charts.append(miembros)
    # proyección de cada carta
    uv = np.zeros((nl, 2))
    rects = []
    for cid, fs in enumerate(charts):
        f0 = fs[0]
        n = N[f0]
        if np.linalg.norm(n) < 0.5:
            n = np.array([0.0, 0.0, 1.0])
        p0 = co[lvl[lsl[f0]]]
        p1 = co[lvl[lsl[f0] + 1]] if ltl[f0] > 1 else p0 + 1
        t = (p1 - p0) - n * np.dot(p1 - p0, n)
        if np.linalg.norm(t) < 1e-9:
            t = np.cross(n, [0, 0, 1]) if abs(n[2]) < 0.9 else np.cross(n, [1, 0, 0])
        t = t / np.linalg.norm(t)
        b = np.cross(n, t)
        idx = np.concatenate([np.arange(lsl[f], lsl[f] + ltl[f]) for f in fs])
        P = co[lv[idx]]
        u = P @ t
        v = P @ b
        u -= u.min()
        v -= v.min()
        w, h = u.max(), v.max()
        if h > w:
            u, v, w, h = v, u, h, w
        uv[idx, 0] = u
        uv[idx, 1] = v
        rects.append((cid, idx, w, h))
    rects.sort(key=lambda r: -r[3])
    m = margen_px

    def empaquetar(s, colocar=False):
        x = y = fila = 0
        pos = []
        for (cid, idx, w, h) in rects:
            pw = int(math.ceil(w * s)) + 2 * m
            ph = int(math.ceil(h * s)) + 2 * m
            if pw > res:
                return res * 10, None
            if x + pw > res:
                y += fila
                x = 0
                fila = 0
            pos.append((x, y))
            x += pw
            fila = max(fila, ph)
        return y + fila, pos

    lo, hi = 0.01, 2000.0
    for _ in range(40):
        mid = (lo * hi) ** 0.5
        hgt, _p = empaquetar(mid)
        if hgt <= res:
            lo = mid
        else:
            hi = mid
    s_ = lo
    hgt, pos = empaquetar(s_)
    out = np.zeros((nl, 2))
    for (cid, idx, w, h), (x, y) in zip(rects, pos):
        out[idx, 0] = (x + m + uv[idx, 0] * s_) / res
        out[idx, 1] = (y + m + uv[idx, 1] * s_) / res
    lm = me.uv_layers.new(name='Lightmap')
    lm.data.foreach_set('uv', out.ravel())
    me.uv_layers.active = me.uv_layers['UVMap']
    me.uv_layers['UVMap'].active_render = True
    ob['lightmap_px_por_metro'] = s_
    print(f'   UV lightmap {ob.name}: {len(charts)} cartas, {s_:.1f} px/m', flush=True)


def separar_piezas(ob, coll, prefijo=''):
    """Divide un objeto de grupo en un objeto por pieza (atributo de cara 'pieza'),
    conservando materiales, UVMap, Lightmap y el color 'Tinte'. Devuelve los objetos nuevos."""
    import numpy as np
    me = ob.data
    nombres = list(ob.get('piezas', [ob.name]))
    nf, nl = len(me.polygons), len(me.loops)
    pz = np.empty(nf, dtype=np.int64)
    me.attributes['pieza'].data.foreach_get('value', pz)
    ls = np.empty(nf, dtype=np.int64)
    lt = np.empty(nf, dtype=np.int64)
    me.polygons.foreach_get('loop_start', ls)
    me.polygons.foreach_get('loop_total', lt)
    mi = np.empty(nf, dtype=np.int64)
    me.polygons.foreach_get('material_index', mi)
    lv = np.empty(nl, dtype=np.int64)
    me.loops.foreach_get('vertex_index', lv)
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    uvs = {}
    for uvl in me.uv_layers:
        a = np.empty(nl * 2)
        uvl.data.foreach_get('uv', a)
        uvs[uvl.name] = a.reshape(-1, 2)
    col = None
    if 'Tinte' in me.color_attributes:
        col = np.empty(nl * 4, dtype=np.float32)
        me.color_attributes['Tinte'].data.foreach_get('color_srgb', col)
        col = col.reshape(-1, 4)
    usados = {}
    nuevos = []
    for k in np.unique(pz):
        caras = np.nonzero(pz == k)[0]
        loops = np.concatenate([np.arange(ls[f], ls[f] + lt[f]) for f in caras])
        verts, inv = np.unique(lv[loops], return_inverse=True)
        caras_idx = []
        i = 0
        for f in caras:
            n = lt[f]
            caras_idx.append(inv[i:i + n].tolist())
            i += n
        nombre = prefijo + nombres[k]
        usados[nombre] = usados.get(nombre, 0) + 1
        if usados[nombre] > 1:
            nombre = f'{nombre}_{usados[nombre]:02d}'
        m2 = bpy.data.meshes.new(nombre)
        # origen de cada pieza en el centro de su base (útil para moverlas/animarlas)
        P = co[verts]
        org = np.array([(P[:, 0].min() + P[:, 0].max()) / 2, (P[:, 1].min() + P[:, 1].max()) / 2, P[:, 2].min()])
        m2.from_pydata((P - org).tolist(), [], caras_idx)
        mats_usadas = sorted(set(mi[caras].tolist()))
        remap = {old: j for j, old in enumerate(mats_usadas)}
        for old in mats_usadas:
            m2.materials.append(me.materials[old])
        m2.polygons.foreach_set('material_index', [remap[x] for x in mi[caras].tolist()])
        for nomuv, a in uvs.items():
            l2 = m2.uv_layers.new(name=nomuv)
            l2.data.foreach_set('uv', a[loops].ravel())
        if col is not None:
            ca = m2.color_attributes.new('Tinte', 'BYTE_COLOR', 'CORNER')
            ca.data.foreach_set('color_srgb', col[loops].ravel())
        m2.validate(clean_customdata=False)
        o2 = bpy.data.objects.new(nombre, m2)
        o2.location = org.tolist()
        coll.objects.link(o2)
        _select_only(o2)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        nuevos.append(o2)
    return nuevos
