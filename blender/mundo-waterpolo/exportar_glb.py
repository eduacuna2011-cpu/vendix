# -*- coding: utf-8 -*-
"""
Exporta GLB "portables" (cualquier motor / visor glTF) desde el mundo horneado:

    blender -b mundo_waterpolo.blend -P exportar_glb.py
    (o con python+bpy:  exportar_glb.py -- ruta/mundo_waterpolo.blend)

Salida en glb/:
  mundo_waterpolo.glb   todo el mapa (geometría Draco)
  gimnasio.glb          sólo el edificio del gimnasio (envolvente + sala + equipamiento), sin compresión

Materiales glTF PBR estándar:
  baseColorTexture  albedo tileable (UV 0) x factor de tinte x COLOR_0 (tinte por vértice)
  metallicRoughness rugosidad de la textura + metalicidad del material
  normalTexture     normal map (UV 0)
  occlusionTexture  LIGHTMAP horneado (UV 1). En un visor cualquiera actúa como oclusión/sombra
                    horneada; para el aspecto exacto úsalo como lightmap:
                    extras.lightmap_escala -> intensidad = PI * escala (three.js: lightMap, channel 1)
Requiere haber ejecutado antes exportar_web.py (usa web/tex y web/lm).
"""
import os
import sys
import json

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

import bpy
import bmesh
from mw import materiales as MT

WEB = os.path.join(AQUI, 'web')
SALIDA = os.path.join(AQUI, 'glb')
# caja del edificio del gimnasio (con marquesina), coordenadas Blender
GYM_CAJA = (-28.6, -46.6, -5.4, -21.0)
GYM_OBJETOS = ('Gimnasio_Sala', 'Gimnasio_Equipos', 'Centro_Exterior', 'Centro_Vidrios',
               'Centro_Luminarias', 'Centro_Espejos')

_imgs = {}


def imagen(rel, color):
    if rel in _imgs:
        return _imgs[rel]
    im = bpy.data.images.load(os.path.join(WEB, rel), check_existing=True)
    im.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    _imgs[rel] = im
    return im


def grupo_salida():
    g = bpy.data.node_groups.get('glTF Material Output')
    if g is None:
        g = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        g.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        g.nodes.new('NodeGroupInput')
    return g


def mat_gltf(nombre, man):
    clave = 'GLTF_' + nombre
    m = bpy.data.materials.get(clave)
    if m:
        return m
    base, _, grupo = nombre.partition('@')
    sp = MT.MATS.get(base, MT.MATS['pintura_gris'])
    tipo = sp.get('kind', 'pbr')
    m = bpy.data.materials.new(clave)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bs.outputs[0], out.inputs[0])
    if tipo == 'pbr':
        uv0 = nt.nodes.new('ShaderNodeUVMap')
        uv0.uv_map = 'UVMap'
        tA = nt.nodes.new('ShaderNodeTexImage')
        tA.image = imagen(f"tex/{sp['tex']}_albedo.jpg", True)
        nt.links.new(uv0.outputs[0], tA.inputs[0])
        mx = nt.nodes.new('ShaderNodeMix')
        mx.data_type = 'RGBA'
        mx.blend_type = 'MULTIPLY'
        mx.inputs[0].default_value = 1.0
        nt.links.new(tA.outputs['Color'], mx.inputs[6])
        mx.inputs[7].default_value = (*MT._lin(sp['tint']), 1.0)
        nt.links.new(mx.outputs[2], bs.inputs['Base Color'])
        tR = nt.nodes.new('ShaderNodeTexImage')
        tR.image = imagen(f"tex/{sp['tex']}_rough.jpg", False)
        nt.links.new(uv0.outputs[0], tR.inputs[0])
        nt.links.new(tR.outputs['Color'], bs.inputs['Roughness'])
        tN = nt.nodes.new('ShaderNodeTexImage')
        tN.image = imagen(f"tex/{sp['tex']}_normal.jpg", False)
        nt.links.new(uv0.outputs[0], tN.inputs[0])
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.uv_map = 'UVMap'
        nm.inputs['Strength'].default_value = sp['nrm']
        nt.links.new(tN.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs[0], bs.inputs['Normal'])
        metal = sp['metal'] if sp['metal'] is not None else MT.TEX_METAL.get(sp['tex'], 0.0)
        bs.inputs['Metallic'].default_value = metal
        lm = man['lightmaps'].get(grupo) if grupo else None
        if lm:
            uv1 = nt.nodes.new('ShaderNodeUVMap')
            uv1.uv_map = 'Lightmap'
            tL = nt.nodes.new('ShaderNodeTexImage')
            tL.image = imagen(lm['archivo'], False)
            nt.links.new(uv1.outputs[0], tL.inputs[0])
            sep = nt.nodes.new('ShaderNodeSeparateColor')
            nt.links.new(tL.outputs['Color'], sep.inputs[0])
            go = nt.nodes.new('ShaderNodeGroup')
            go.node_tree = grupo_salida()
            nt.links.new(sep.outputs[0], go.inputs['Occlusion'])
            m['lightmap'] = os.path.basename(lm['archivo'])
            m['lightmap_escala'] = lm['escala']
            m['lightmap_uv'] = 1
            m['lightmap_codificacion'] = 'sRGB(lm / escala); usar intensidad PI * escala'
    elif tipo == 'emision':
        bs.inputs['Base Color'].default_value = (0, 0, 0, 1)
        bs.inputs['Emission Color'].default_value = (*sp['color'], 1)
        bs.inputs['Emission Strength'].default_value = sp['fuerza']
    elif tipo in ('vidrio', 'vidrio_esmerilado'):
        esm = tipo == 'vidrio_esmerilado'
        bs.inputs['Base Color'].default_value = (0.75, 0.8, 0.8, 1) if esm else (0.6, 0.72, 0.72, 1)
        bs.inputs['Roughness'].default_value = 0.45 if esm else 0.04
        bs.inputs['Alpha'].default_value = 0.62 if esm else 0.18
        m.surface_render_method = 'BLENDED'
    elif tipo == 'espejo':
        bs.inputs['Base Color'].default_value = (0.92, 0.93, 0.93, 1)
        bs.inputs['Metallic'].default_value = 1.0
        bs.inputs['Roughness'].default_value = 0.02
    elif tipo == 'agua':
        bs.inputs['Base Color'].default_value = (0.01, 0.03, 0.035, 1)
        bs.inputs['Roughness'].default_value = 0.04
    else:   # vidrio oscuro / pantalla apagada
        bs.inputs['Base Color'].default_value = (0.012, 0.016, 0.02, 1)
        bs.inputs['Roughness'].default_value = 0.05
    return m


def recortar(ob, caja):
    """Borra las caras cuyo centro cae fuera de la caja XY."""
    x0, y0, x1, y1 = caja
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    fuera = [f for f in bm.faces
             if not (x0 <= f.calc_center_median().x <= x1 and y0 <= f.calc_center_median().y <= y1)]
    bmesh.ops.delete(bm, geom=fuera, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()
    return len(ob.data.polygons)


def exportar(objs, ruta, draco):
    for o in bpy.context.view_layer.objects:
        o.select_set(o in objs)
    bpy.ops.export_scene.gltf(
        filepath=ruta, export_format='GLB', use_selection=True, export_texcoords=True,
        export_normals=True, export_materials='EXPORT', export_image_format='JPEG',
        export_jpeg_quality=88, export_vertex_color='NAME', export_vertex_color_name='Tinte',
        export_all_vertex_colors=False, export_extras=True, export_cameras=False,
        export_lights=False, export_yup=True, export_apply=False,
        export_draco_mesh_compression_enable=draco, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=16, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=14, export_draco_color_quantization=8)
    print(f'> {ruta}  {os.path.getsize(ruta) / 1e6:.1f} MB', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv:
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(argv[0]))
    os.makedirs(SALIDA, exist_ok=True)
    man = json.load(open(os.path.join(WEB, 'mundo.json'), encoding='utf-8'))
    mallas = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in mallas:
        for s in o.material_slots:
            if s.material and not s.material.name.startswith('GLTF_'):
                s.material = mat_gltf(s.material.name, man)
    # copia recortada sólo con el gimnasio
    gym = []
    for nom in GYM_OBJETOS:
        src = bpy.data.objects.get(nom)
        if src is None:
            continue
        c = src.copy()
        c.data = src.data.copy()
        c.name = 'Gym_' + nom
        bpy.context.scene.collection.objects.link(c)
        if not nom.startswith('Gimnasio'):
            if recortar(c, GYM_CAJA) == 0:
                bpy.data.objects.remove(c)
                continue
        gym.append(c)
    exportar(mallas, os.path.join(SALIDA, 'mundo_waterpolo.glb'), draco=True)
    exportar(gym, os.path.join(SALIDA, 'gimnasio.glb'), draco=False)


if __name__ == '__main__':
    main()
