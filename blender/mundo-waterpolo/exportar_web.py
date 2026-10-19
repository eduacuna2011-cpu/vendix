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


def textura_web(src, dst, clase):
    """Albedo a resolución completa; rugosidad y normal a la mitad (bastan en pantalla y
    reducen el peso del visor a la mitad)."""
    im = bpy.data.images.load(src)
    w, h = im.size
    if clase != 'albedo' and w > 256:
        im.scale(w // 2, h // 2)
    im.filepath_raw = dst
    im.file_format = 'JPEG'
    im.save(filepath=dst, quality=88 if clase == 'albedo' else 85)
    bpy.data.images.remove(im)


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


def geometria_compacta(glb, destino):
    """GLB sin comprimir -> binario propio gzip (posiciones/UV cuantizadas a 16 bits, normales 8 bits,
    color sRGB 8 bits). El visor lo descomprime con DecompressionStream: sin Draco, sin Workers,
    sin WebAssembly ni fetch (funciona abriendo el .html como archivo local, también en móvil)."""
    import gzip
    import struct
    data = open(glb, 'rb').read()
    jl = struct.unpack('<I', data[12:16])[0]
    J = json.loads(data[20:20 + jl])
    o = 20 + jl
    bl = struct.unpack('<I', data[o:o + 4])[0]
    BIN = data[o + 8:o + 8 + bl]
    tipos = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8, 5122: np.int16, 5120: np.int8}
    comps = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def acc(i):
        a = J['accessors'][i]
        bv = J['bufferViews'][a['bufferView']]
        dt = tipos[a['componentType']]
        n = comps[a['type']]
        ini = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        arr = np.frombuffer(BIN, dt, a['count'] * n, ini).reshape(a['count'], n)
        if a.get('normalized'):
            arr = arr.astype(np.float32) / np.iinfo(dt).max
        return arr

    out = bytearray()

    def put(arr):
        while len(out) % 4:
            out.append(0)
        ini = len(out)
        out.extend(np.ascontiguousarray(arr).tobytes())
        return ini

    prims = []
    for nd in J['nodes']:
        if 'mesh' not in nd:
            continue
        for p in J['meshes'][nd['mesh']]['primitives']:
            at = p['attributes']
            P = acc(at['POSITION']).astype(np.float64)
            nv = len(P)
            pmin = P.min(0)
            pesc = np.maximum(P.max(0) - pmin, 1e-6) / 65535.0
            d = {'mat': J['materials'][p['material']]['name'] if 'material' in p else 'pintura', 'nv': nv,
                 'pmin': pmin.tolist(), 'pesc': pesc.tolist(), 'o': {}}
            d['o']['pos'] = put(np.round((P - pmin) / pesc).astype(np.uint16))
            N = acc(at['NORMAL'])
            d['o']['nrm'] = put(np.clip(np.round(N * 127), -127, 127).astype(np.int8))
            T0 = acc(at['TEXCOORD_0']).astype(np.float64)
            tmin = T0.min(0)
            tesc = np.maximum(T0.max(0) - tmin, 1e-6) / 65535.0
            d['tmin'], d['tesc'] = tmin.tolist(), tesc.tolist()
            d['o']['uv0'] = put(np.round((T0 - tmin) / tesc).astype(np.uint16))
            if 'TEXCOORD_1' in at:
                d['o']['uv1'] = put(np.round(np.clip(acc(at['TEXCOORD_1']), 0, 1) * 65535).astype(np.uint16))
            if 'COLOR_0' in at:
                C = np.clip(acc(at['COLOR_0'])[:, :3], 0, 1)
                d['o']['col'] = put(np.round(srgb(C) * 255).astype(np.uint8))
            I = acc(p['indices']).ravel()
            d['i32'] = bool(nv > 65535)
            d['ni'] = len(I)
            d['o']['idx'] = put(I.astype(np.uint32 if d['i32'] else np.uint16))
            prims.append(d)
    with open(destino, 'wb') as fh:
        fh.write(gzip.compress(bytes(out), 9))
    print(f'  geometría compacta: {len(prims)} primitivas, {sum(q["nv"] for q in prims)} vértices, '
          f'{len(out) / 1e6:.1f} MB -> {os.path.getsize(destino) / 1e6:.1f} MB gzip', flush=True)
    return {'archivo': 'mundo.bin', 'prims': prims}


def main(destino_html=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv:   # uso con python+bpy: exportar_web.py -- ruta/al/mundo.blend
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(argv[0]))
    os.makedirs(os.path.join(WEB, 'lm'), exist_ok=True)
    os.makedirs(os.path.join(WEB, 'tex'), exist_ok=True)
    blend_dir = os.path.dirname(bpy.data.filepath) or AQUI
    man = {'materiales': {}, 'lightmaps': {}, 'camaras': [], 'texturas': [],
           'sol': {'elevacion': H.SOL_ELEV, 'azimut': H.SOL_AZIM},
           'titulo': bpy.context.scene.get('mw_titulo'),
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
            textura_web(src, os.path.join(WEB, 'tex', f'{t}_{k}.jpg'), k)
    man['texturas'] = sorted(tex)

    # cámaras (coordenadas Blender Z-arriba; el visor convierte)
    for c in sorted((o for o in bpy.data.objects if o.type == 'CAMERA'), key=lambda o: o.name):
        mw = c.matrix_world
        pos = mw.translation
        fwd = -(mw.to_3x3() @ Vector((0, 0, 1)))
        tgt = pos + fwd * 12.0
        man['camaras'].append({'nombre': c.name, 'pos': list(pos), 'obj': list(tgt),
                               'hfov': math.degrees(2 * math.atan(18.0 / c.data.lens)),
                               'expo': float(c.get('exposicion', 0.0)),
                               'etiqueta': c.get('etiqueta'), 'grupo': c.get('grupo')})

    # GLB: sólo mallas, sin imágenes (el visor monta los materiales con el manifiesto).
    # 1) GLB sin comprimir -> geometría compacta propia (mundo.bin) que usa el visor
    # 2) GLB con Draco (mundo.glb) para importar en motores / otros visores
    for o in bpy.context.view_layer.objects:
        o.select_set(o.type == 'MESH')
    comun = dict(export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True,
                 export_materials='EXPORT', export_image_format='NONE', export_vertex_color='NAME',
                 export_vertex_color_name='Tinte', export_all_vertex_colors=False, export_cameras=False,
                 export_lights=False, export_yup=True, export_apply=False)
    tmp = os.path.join(WEB, '_crudo.glb')
    bpy.ops.export_scene.gltf(filepath=tmp, **comun)
    man['geo'] = geometria_compacta(tmp, os.path.join(WEB, 'mundo.bin'))
    os.remove(tmp)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(WEB, 'mundo.glb'), **comun,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=16, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=14, export_draco_color_quantization=8)
    with open(os.path.join(WEB, 'mundo.json'), 'w', encoding='utf-8') as fh:
        json.dump(man, fh, ensure_ascii=False, indent=1)
    index_html()
    html_unico(destino_html)
    print('> web exportada en', WEB, flush=True)


def index_html():
    """web/index.html = visor.html envuelto en un documento completo (para alojarlo en cualquier hosting)."""
    frag = open(os.path.join(WEB, 'visor.html'), encoding='utf-8').read()
    i = frag.index('</style>') + len('</style>')
    html = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>html,body{margin:0}[hidden]{display:none!important}</style>\n'
            + frag[:i] + '\n</head>\n<body>\n' + frag[i:] + '\n</body>\n</html>\n')
    if os.path.exists(os.path.join(WEB, 'visor.bundle.js')):
        # usa el visor empaquetado (three.js incluido): no depende de ningún CDN
        a = html.index('<script type="importmap">')
        b = html.index('</script>', html.index('<script type="module">')) + len('</script>')
        html = html[:a] + '<script src="visor.bundle.js"></script>' + html[b:]
    with open(os.path.join(WEB, 'index.html'), 'w', encoding='utf-8') as fh:
        fh.write(html)



def html_unico(destino=None):
    """Un solo .html con TODO incrustado (abre con doble clic, sin servidor ni internet).
    Si existe web/visor.bundle.js, three.js va dentro; si no, se carga del CDN."""
    import base64
    destino = destino or os.path.join(AQUI, 'mundo_waterpolo_3d.html')
    tipos = {'.jpg': 'image/jpeg', '.bin': 'application/octet-stream'}
    datos = {}
    man = json.load(open(os.path.join(WEB, 'mundo.json'), encoding='utf-8'))
    rutas = ['mundo.bin']
    rutas += [lm['archivo'] for lm in man['lightmaps'].values() if not lm.get('uniforme')]
    rutas += [f'tex/{t}_{k}.jpg' for t in man['texturas'] for k in ('albedo', 'rough', 'normal')]
    for r in rutas:
        b = open(os.path.join(WEB, r), 'rb').read()
        datos[r] = f'data:{tipos[os.path.splitext(r)[1]]};base64,' + base64.b64encode(b).decode('ascii')
    datos['mundo.json'] = man
    html = open(os.path.join(WEB, 'index.html'), encoding='utf-8').read()
    carga = '<script>window.MW_DATOS = ' + json.dumps(datos, ensure_ascii=False) + ';</script>\n'
    paquete = os.path.join(WEB, 'visor.bundle.js')
    etiqueta = '<script src="visor.bundle.js"></script>'
    if etiqueta in html:
        # three.js + visor empaquetados (web/empaquetar.mjs) dentro del archivo: sin CDN, funciona sin internet
        js = open(paquete, encoding='utf-8').read().replace('</script', '<\\/script')
        html = html.replace(etiqueta, carga + '<script>\n' + js + '\n</script>', 1)
    else:
        html = html.replace('<script type="importmap">', carga + '<script type="importmap">', 1)
    with open(destino, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print(f'> archivo único {destino} ({os.path.getsize(destino) / 1e6:.1f} MB)', flush=True)


if __name__ == '__main__':
    main()
