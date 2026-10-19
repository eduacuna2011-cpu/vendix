# -*- coding: utf-8 -*-
"""
GIMNASIO PRO — genera sólo el edificio del gimnasio de alto rendimiento, lo hornea y lo exporta:

    blender -b -P generar_gimnasio.py -- --calidad alta
    (o con python+bpy:  python generar_gimnasio.py -- --calidad alta)

Salida en gimnasio_pro/:
  gimnasio_pro.blend          escena horneada (grupos con lightmap)
  gimnasio_pro.glb            CADA elemento como objeto independiente (suelo, paredes, racks, ganchos J,
                              brazos de seguridad, portadiscos, barras, discos, bancos, máquinas...),
                              materiales PBR + lightmap en UV 1 (ver exportar_glb.py)
  gimnasio_pro_3d.html        visor 3D de un solo archivo (abre con doble clic, sin internet)
  web/ texturas/ lightmaps/   recursos
"""
import os
import sys
import math
import time
import random
import argparse

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

import bpy
from mathutils import Vector

from mw import geo as G
from mw import materiales as MT
from mw import horneado as H
from mw import centro
from mw import gimnasio
import exportar_web
import exportar_glb

CALIDADES = {'borrador': (0.5, 16, 12, 0.5), 'media': (0.5, 64, 32, 1.0), 'alta': (1.0, 128, 64, 1.0)}

# alias de builder -> (nombre del grupo, horneado, resolución, interior)
GRUPOS = {
    'Centro_Exterior': ('Gimnasio_Exterior', True, 2048, False),
    'Gimnasio_Entorno': ('Gimnasio_Entorno', True, 1024, False),
    'Gimnasio_Sala': ('Gimnasio_Sala', True, 2048, True),
    'Gimnasio_Equipos': ('Gimnasio_Equipos', True, 4096, True),
    'Centro_Vidrios': ('Gimnasio_Vidrios', False, 0, False),
    'Centro_Luminarias': ('Gimnasio_Luminarias', False, 0, False),
    'Centro_Espejos': ('Gimnasio_Espejos', False, 0, False),
}

GX, GY, FZ = gimnasio.GX, gimnasio.GY, gimnasio.FZ


def L2W(x, y, z):
    """coordenadas locales del gimnasio -> mundo"""
    return (GX + x, GY + y, FZ + z)


# nombre, grupo, etiqueta, posición local, objetivo local, focal, exposición
CAMARAS = [
    ('CAM_G01', 'Exterior', 'Entrada del gimnasio', (2, 12.5, 1.7 - FZ), (-17, -24, 4), 20, 0.0),
    ('CAM_G02', 'Fuerza', 'Pasillo de racks', (3.6, 16.45, 1.6), (21, 16.45, 1.1), 17, 1.0),
    ('CAM_G03', 'Fuerza', 'Plataformas de fuerza', (6.2, 15.9, 1.55), (7.0, 18.4, 0.5), 17, 1.0),
    ('CAM_G04', 'Fuerza', 'Vista general NE', (20.6, 20.6, 2.6), (8, 8, 0.6), 15, 1.0),
    ('CAM_G05', 'Fuerza', 'Mancuernas y barras', (14.6, 9.3, 1.6), (5, 10.6, 0.6), 17, 1.0),
    ('CAM_G06', 'Acondicionamiento', 'Remos, Vasa y cintas', (5.2, 18.6, 1.7), (0.5, 10.5, 0.7), 16, 1.0),
    ('CAM_G07', 'Funcional', 'Rig y zona funcional', (12.0, 9.2, 1.8), (5.5, 4.6, 1.3), 16, 1.0),
    ('CAM_G08', 'Funcional', 'Césped: trineos y vallas', (3.8, 3.3, 1.5), (20, 1.3, 0.4), 18, 1.0),
    ('CAM_G09', 'Máquinas', 'Prensa, belt squat y GHD', (11.6, 9.4, 1.8), (18.5, 4.8, 0.7), 16, 1.0),
    ('CAM_G10', 'Tecnología', 'Marcador LED de velocidad', (10.4, 14.8, 1.7), (10.4, 0.0, 3.4), 18, 1.0),
    ('CAM_G11', 'Tecnología', 'Pizarra y puesto del preparador', (14.0, 17.0, 1.7), (21.4, 17.6, 1.6), 18, 1.0),
]


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--calidad', default='alta', choices=list(CALIDADES))
    p.add_argument('--sin-hornear', action='store_true')
    p.add_argument('--salida', default=os.path.join(AQUI, 'gimnasio_pro'))
    return p.parse_args(argv)


def entorno(b):
    """Losa de hormigón, acera y césped alrededor del edificio (para el horneado y el contexto)."""
    with b.p('Entorno_Cesped'):
        b.box('cesped', (-60, -80, -0.3), (30, 10, -0.02), skip=('bottom',))
    with b.p('Entorno_Losa'):
        b.box('concreto', (-34, -52, 0), (0, -20, 0.15), skip=('bottom',), tint=(1.1, 1.1, 1.08))
    with b.p('Entorno_Acera'):
        b.box('acera', (-40, -20, 0), (10, -16, 0.15), skip=('bottom',))
    with b.p('Entorno_Calle'):
        b.box('asfalto', (-40, -16, -0.2), (10, -8, 0.0), skip=('bottom',))


def camaras(col):
    out = []
    for nom, grp, etq, pos, obj, lens, expo in CAMARAS:
        cd = bpy.data.cameras.new(nom)
        cd.lens = lens
        cd.clip_start = 0.05
        ob = bpy.data.objects.new(nom, cd)
        col.objects.link(ob)
        ob.location = L2W(*pos) if nom != 'CAM_G01' else (GX + pos[0], GY + pos[1] + 21.4, pos[2] + FZ)
        if nom == 'CAM_G01':
            ob.location = (-17.0, -12.0, 1.7)
            tgt = Vector((-17.0, -24.0, 3.2))
        else:
            tgt = Vector(L2W(*obj))
        d = tgt - Vector(ob.location)
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        ob['exposicion'] = expo
        ob['grupo'] = grp
        ob['etiqueta'] = etq
        out.append(ob)
    return out


def main():
    a = args()
    t0 = time.time()
    esc_lm, spp_int, spp_ext, esc_tex = CALIDADES[a.calidad]
    out = os.path.abspath(a.salida)
    os.makedirs(out, exist_ok=True)
    MT.ESCALA_TEX = esc_tex

    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = 'Gimnasio_PRO'
    sc['mw_titulo'] = 'Gimnasio PRO 3D'
    blend = os.path.join(out, 'gimnasio_pro.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    col = bpy.data.collections.new('Gimnasio_PRO')
    sc.collection.children.link(col)
    col_luces = bpy.data.collections.new('Luces_Horneado')
    sc.collection.children.link(col_luces)
    col_cam = bpy.data.collections.new('Camaras')
    sc.collection.children.link(col_cam)

    B = {}
    for alias, (nom, bake, res, interior) in GRUPOS.items():
        B[alias] = G.Builder(nom, bake, max(256, int(res * esc_lm)) if bake else 0)
    rnd = random.Random(7)
    print('> construyendo gimnasio PRO...', flush=True)
    entorno(B['Gimnasio_Entorno'])
    centro.gimnasio_envolvente(B)
    gimnasio.construir(B, rnd)

    objetos = []
    for alias, b in B.items():
        if not b.F:
            continue
        ob = b.build(col, lambda m, g, _r=b.res: MT.get_material(m, g, out, _r))
        objetos.append((ob, b, GRUPOS[alias][3]))
        print(f'   {b.name}: {len(b.F)} caras, {len(b.piezas)} piezas', flush=True)
    for ob, b, interior in objetos:
        if b.bake:
            G.lightmap_uv(ob, b.res)

    H.mundo(col_luces)
    cams = camaras(col_cam)
    sc.camera = cams[1]
    sc.view_settings.view_transform = 'AgX'
    if not a.sin_hornear:
        print(f'> horneando ({a.calidad})...', flush=True)
        H.config_cycles(spp_int)
        MT.set_modo(False)
        for ob, b, interior in objetos:
            if b.bake:
                H.hornear(ob, b.res, spp_int if interior else spp_ext, out)
        H.limpiar_denoise()
        MT.set_modo(True)
        col_luces.hide_render = True
        col_luces.hide_viewport = True
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_as_mainfile(filepath=blend, relative_remap=True, compress=True)
    print(f'> guardado {blend} ({time.time() - t0:.0f}s)', flush=True)

    # --- visor 3D (usa los grupos sin separar: pocos draw calls)
    web = os.path.join(out, 'web')
    os.makedirs(web, exist_ok=True)
    import shutil
    for f in ('visor.html', 'visor.bundle.js'):
        shutil.copy(os.path.join(AQUI, 'web', f), os.path.join(web, f))
    exportar_web.WEB = web
    sys.argv = sys.argv[:1]          # exportar_web.main lee sus propios argumentos
    exportar_web.main(os.path.join(out, 'gimnasio_pro_3d.html'))

    # --- GLB con cada elemento separado
    import json
    exportar_glb.WEB = web
    man = json.load(open(os.path.join(web, 'mundo.json'), encoding='utf-8'))
    col_sep = bpy.data.collections.new('Gimnasio_PRO_Piezas')
    sc.collection.children.link(col_sep)
    separados = []
    for ob, b, interior in objetos:
        nuevos = G.separar_piezas(ob, col_sep)
        separados.extend(nuevos)
        print(f'   {ob.name}: {len(nuevos)} objetos', flush=True)
    for o in separados:
        for s in o.material_slots:
            if s.material and not s.material.name.startswith('GLTF_'):
                s.material = exportar_glb.mat_gltf(s.material.name, man)
    exportar_glb.exportar(separados, os.path.join(out, 'gimnasio_pro.glb'), draco=False)
    print(f'> listo en {time.time() - t0:.0f}s', flush=True)


if __name__ == '__main__':
    main()
