# -*- coding: utf-8 -*-
"""
Exporta el mundo horneado a la carpeta web/ para verlo en el navegador (three.js).

    blender -b mundo_waterpolo.blend -P exportar_web.py

Genera:
  web/mundo.glb          geometría (Draco) con 2 canales UV (textura + lightmap) y color 'Tinte'
  web/lm/*.jpg           lightmaps codificados en 8 bits (sRGB de lm / escala)
  web/tex/*.jpg          texturas tileables (albedo / rough / normal)
  web/mundo.json         manifiesto: materiales, lightmaps (escala), cámaras, zonas interiores, sol
  web/index.html         visor three.js (generado a partir de web/visor.html)
"""
import os
import sys
import json
import math
import shutil

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

import bpy
import numpy as np
from mathutils import Vector
from mw import materiales as MT
from mw import horneado as H

WEB = os.path.join(AQUI, 'web')


def srgb(x):
    return np.where(x <= 0.0031308, 12.92 * x, 1.055 * np.power(np.maximum(x, 0), 1 / 2.4) - 0.055)


def lightmap_jpg(img, path):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    rgb = px.reshape(h, w, 4)[..., :3]
    escala = float(max(1.0, np.percentile(rgb.max(-1), 99.7)))
    v = np.clip(srgb(np.clip(rgb / escala, 0, 1)), 0, 1)
    out = np.concatenate([v, np.ones((h, w, 1))], -1).astype(np.float32)
    im = bpy.data.images.new('lm_tmp', w, h, alpha=False)
    im.pixels.foreach_set(out.ravel())
    im.filepath_raw = path
    im.file_format = 'JPEG'
    im.save(filepath=path, quality=90)
    bpy.data.images.remove(im)
    cobertura = float((rgb.max(-1) > 1e-4).mean())
    return escala, cobertura


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv:   # uso con python+bpy: exportar_web.py -- ruta/al/mundo.blend
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(argv[0]))
    os.makedirs(os.path.join(WEB, 'lm'), exist_ok=True)
    os.makedirs(os.path.join(WEB, 'tex'), exist_ok=True)
    blend_dir = os.path.dirname(bpy.data.filepath) or AQUI
    man = {'materiales': {}, 'lightmaps': {}, 'camaras': [], 'texturas': [],
           'sol': {'elevacion': H.SOL_ELEV, 'azimut': H.SOL_AZIM},
           'interiores': [
               {'nombre': 'Gimnasio', 'min': [-28, -46, 0], 'max': [-6, -24, 6.4], 'expo': 1.0},
               {'nombre': 'Centro de waterpolo', 'min': [2, -48, 0], 'max': [28, -24, 4.4], 'expo': 0.9}]}

    # lightmaps
    obs = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in obs:
        img = bpy.data.images.get(f'LM_{o.name}')
        if img is None or not o.data.uv_layers.get('Lightmap'):
            continue
        if img.source == 'FILE':
            img.reload()
        f = f'lm/LM_{o.name}.jpg'
        esc, cob = lightmap_jpg(img, os.path.join(WEB, f))
        # un lightmap casi vacío (resolución insuficiente) se sustituye por luz uniforme en el visor
        man['lightmaps'][o.name] = {'archivo': f, 'escala': esc, 'uniforme': cob < 0.05}
        print('  lightmap', o.name, man['lightmaps'][o.name]['escala'], flush=True)

    # materiales (por nombre base) + texturas usadas
    usadas = set()
    for o in obs:
        for s in o.material_slots:
            if s.material:
                usadas.add(s.material.name.split('@')[0])
    tex = set()
    for nom in sorted(usadas):
        sp = MT.MATS.get(nom)
        if sp is None:
            continue
        d = {'tipo': sp.get('kind', 'pbr')}
        if d['tipo'] == 'pbr':
            d.update(tex=sp['tex'], tinte=list(sp['tint']), rough=sp['rough'], nrm=sp['nrm'],
                     metal=sp['metal'] if sp['metal'] is not None else MT.TEX_METAL.get(sp['tex'], 0.0))
            tex.add(sp['tex'])
        elif d['tipo'] == 'emision':
            d.update(color=list(sp['color']), fuerza=sp['fuerza'])
        man['materiales'][nom] = d
    for t in sorted(tex):
        for k in ('albedo', 'rough', 'normal'):
            src = os.path.join(blend_dir, MT.DIR_TEX, f'{t}_{k}.jpg')
            shutil.copy(src, os.path.join(WEB, 'tex', f'{t}_{k}.jpg'))
    man['texturas'] = sorted(tex)

    # cámaras (coordenadas Blender Z-arriba; el visor convierte)
    for c in sorted((o for o in bpy.data.objects if o.type == 'CAMERA'), key=lambda o: o.name):
        mw = c.matrix_world
        pos = mw.translation
        fwd = -(mw.to_3x3() @ Vector((0, 0, 1)))
        tgt = pos + fwd * 12.0
        man['camaras'].append({'nombre': c.name, 'pos': list(pos), 'obj': list(tgt),
                               'hfov': math.degrees(2 * math.atan(18.0 / c.data.lens)),
                               'expo': float(c.get('exposicion', 0.0))})

    # GLB: sólo mallas, sin imágenes (el visor monta los materiales con el manifiesto)
    for o in bpy.context.view_layer.objects:
        o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(WEB, 'mundo.glb'), export_format='GLB', use_selection=True,
        export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='NONE',
        export_vertex_color='NAME', export_vertex_color_name='Tinte', export_all_vertex_colors=False,
        export_cameras=False, export_lights=False, export_yup=True, export_apply=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=16, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=14, export_draco_color_quantization=8)
    with open(os.path.join(WEB, 'mundo.json'), 'w', encoding='utf-8') as fh:
        json.dump(man, fh, ensure_ascii=False, indent=1)
    index_html()
    html_unico()
    print('> web exportada en', WEB, flush=True)


def index_html():
    """web/index.html = visor.html envuelto en un documento completo (para alojarlo en cualquier hosting)."""
    frag = open(os.path.join(WEB, 'visor.html'), encoding='utf-8').read()
    i = frag.index('</style>') + len('</style>')
    html = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>html,body{margin:0}[hidden]{display:none!important}</style>\n'
            + frag[:i] + '\n</head>\n<body>\n' + frag[i:] + '\n</body>\n</html>\n')
    with open(os.path.join(WEB, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(html)



def html_unico(destino=None):
    """Un solo .html con TODO incrustado (abre con doble clic, sin servidor).
    Sólo three.js y las fuentes se cargan de internet (CDN)."""
    import base64
    destino = destino or os.path.join(AQUI, 'mundo_waterpolo_3d.html')
    tipos = {'.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.js': 'text/javascript'}
    datos = {}
    man = json.load(open(os.path.join(WEB, 'mundo.json'), encoding='utf-8'))
    rutas = ['mundo.glb', 'draco/draco_wasm_wrapper.js', 'draco/draco_decoder.wasm']
    rutas += [lm['archivo'] for lm in man['lightmaps'].values() if not lm.get('uniforme')]
    rutas += [f'tex/{t}_{k}.jpg' for t in man['texturas'] for k in ('albedo', 'rough', 'normal')]
    for r in rutas:
        b = open(os.path.join(WEB, r), 'rb').read()
        datos[r] = f'data:{tipos[os.path.splitext(r)[1]]};base64,' + base64.b64encode(b).decode('ascii')
    datos['mundo.json'] = man
    html = open(os.path.join(WEB, 'index.html'), encoding='utf-8').read()
    carga = '<script>window.MW_DATOS = ' + json.dumps(datos, ensure_ascii=False) + ';</script>\n'
    html = html.replace('<script type="importmap">', carga + '<script type="importmap">', 1)
    with open(destino, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print(f'> archivo único {destino} ({os.path.getsize(destino) / 1e6:.1f} MB)', flush=True)


if __name__ == '__main__':
    main()
