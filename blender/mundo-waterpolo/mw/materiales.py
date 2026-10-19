# -*- coding: utf-8 -*-
"""Materiales PBR con conmutador global HORNEADO / DINÁMICO.

Cada material PBR tiene:
  - albedo / roughness / normal (texturas tileables en canal 'UVMap')
  - tinte del material x atributo de color 'Tinte' (variaciones sin más materiales)
  - un lightmap (canal 'Lightmap') propio de su grupo horneado

El grupo de nodos 'MW_Modo' contiene un único valor k:
  k = 0  -> PBR completo iluminado por las luces reales (se usa para HORNEAR)
  k = 1  -> modo HORNEADO: color = albedo x lightmap como emisión, base negra
            (sólo quedan los reflejos especulares del entorno) => casi gratis en
            tiempo real (EEVEE no necesita luces ni sombras dinámicas).
"""
import os
import bpy
from . import texturas as TX
from .geo import MAT_TILE

# ---------------------------------------------------------------------------
# catálogo de materiales:  tex, tile (m), tinte, metal, rough(mult), normal
# ---------------------------------------------------------------------------
def _m(tex, tile=1.0, tint=(1, 1, 1), metal=None, rough=1.0, nrm=1.0, kind='pbr', **kw):
    t = tile if isinstance(tile, tuple) else (tile, tile)
    d = dict(tex=tex, tile=t, tint=tint, metal=metal, rough=rough, nrm=nrm, kind=kind)
    d.update(kw)
    return d


MATS = {
    # --- ciudad
    'asfalto': _m('asfalto', 4.0),
    'adoquin': _m('adoquin', 1.6),
    'acera': _m('acera', 1.6),
    'bordillo': _m('granito', 1.0),
    'granito': _m('granito', 1.5),
    'piedra': _m('piedra', 4.0),
    'estuco': _m('estuco', 3.0),
    'ladrillo': _m('ladrillo', 0.9),
    'teja': _m('teja', 1.2),
    'zinc': _m('zinc', 2.0),
    'cesped': _m('cesped', 3.0),
    'toldo': _m('toldo', (1.2, 1.2)),
    'hojas': _m('hojas', 1.2),
    'corteza': _m('corteza', 0.6),
    'marco_ventana': _m('pintura', 1.0, (0.93, 0.92, 0.88)),
    'carpinteria_oscura': _m('pintura', 1.0, (0.10, 0.11, 0.10)),
    'hierro_forjado': _m('pintura', 1.0, (0.05, 0.05, 0.05), rough=1.3),
    'contraventana': _m('madera', 1.2, (0.35, 0.55, 0.42)),
    'puerta_madera': _m('madera', 1.2, (0.45, 0.3, 0.2)),
    'agua_fuente': dict(kind='agua'),
    'vidrio_oscuro': dict(kind='vidrio_oscuro'),
    'farola_luz': dict(kind='emision', color=(1.0, 0.8, 0.55), fuerza=6.0),
    # --- centro deportivo
    'concreto': _m('concreto', 2.4),
    'panel_fachada': _m('panel', 2.4, (0.82, 0.83, 0.84)),
    'chapa': _m('chapa', 0.76, (0.6, 0.62, 0.64), rough=1.0),
    'aluminio': _m('cromo', 1.0, (0.75, 0.76, 0.78), metal=1.0, rough=2.2),
    'listones_madera': _m('madera', (1.2, 1.2), (0.95, 0.85, 0.75)),
    'pintura_blanca': _m('pintura', 1.0, (0.93, 0.93, 0.92), rough=2.0),
    'pintura_gris': _m('pintura', 1.0, (0.55, 0.57, 0.6), rough=2.0),
    'pintura_azul': _m('pintura', 1.0, (0.06, 0.18, 0.42), rough=2.0),
    'pintura_club': _m('pintura', 1.0, (0.04, 0.12, 0.30), rough=2.0),
    'pintura_amarilla': _m('pintura', 1.0, (0.95, 0.72, 0.05), rough=2.0),
    'acustico': _m('acustico', 1.2),
    'porcelanato': _m('porcelanato', 2.4),
    'ceramica_suelo': _m('ceramica', 0.8, (0.78, 0.8, 0.82)),
    'ceramica_pared': _m('ceramica', (0.8, 1.6), (0.95, 0.96, 0.97)),
    'ceramica_azul': _m('ceramica', 0.8, (0.25, 0.5, 0.75)),
    'goma_gym': _m('goma', 2.0),
    'cesped_artificial': _m('cesped_art', 1.0),
    'madera_plataforma': _m('madera', (1.2, 1.2), (1.0, 0.95, 0.88)),
    'madera_clara': _m('madera', 1.2, (1.05, 1.0, 0.92)),
    'madera_oscura': _m('madera', 1.2, (0.55, 0.42, 0.32)),
    'moqueta': _m('moqueta', 1.0, (0.28, 0.32, 0.38)),
    'vinilo_piso': _m('vinilo_piso', 2.0),
    'acero_negro': _m('pintura', 1.0, (0.035, 0.035, 0.038), rough=1.4),
    'acero_rack': _m('rack', (0.075, 0.05)),
    'cromo': _m('cromo', 0.3, metal=1.0),
    'acero_inox': _m('cromo', 0.5, (0.8, 0.8, 0.82), metal=1.0, rough=2.0),
    'moleteado': _m('moleteado', 0.012, metal=1.0),
    'goma_bumper': _m('vinilo_pad', 0.3, rough=1.6),
    'acero_disco': _m('pintura', 1.0, (0.12, 0.12, 0.13), metal=0.6, rough=1.2),
    'vinilo_pad': _m('vinilo_pad', 0.4),
    'pad_negro': _m('vinilo_pad', 0.25, (0.04, 0.04, 0.045)),
    'pad_club': _m('vinilo_pad', 0.25, (0.05, 0.12, 0.30)),
    'plastico_negro': _m('vinilo_pad', 0.5, (0.03, 0.03, 0.03), rough=1.2),
    'plastico_blanco': _m('vinilo_pad', 0.5, (0.85, 0.86, 0.87), rough=0.8),
    'tela': _m('tela', 0.3),
    'pelota_wp': _m('pelota', 1.0),
    'pizarra_tactica': _m('pizarra', 1.0),
    'pizarra_blanca': _m('pintura', 1.0, (0.96, 0.96, 0.97), rough=0.4),
    'gorro_blanco': _m('tela', 0.2, (0.95, 0.95, 0.95)),
    'gorro_azul': _m('tela', 0.2, (0.06, 0.15, 0.45)),
    'gorro_rojo': _m('tela', 0.2, (0.75, 0.06, 0.06)),
    'red': _m('pintura', 1.0, (0.95, 0.95, 0.95), rough=2.5),
    'corchera': _m('pintura', 1.0, (1, 1, 1), rough=1.2),
    'oro': _m('cromo', 0.3, (1.0, 0.76, 0.33), metal=1.0, rough=1.4),
    'plata': _m('cromo', 0.3, (0.92, 0.92, 0.94), metal=1.0, rough=1.2),
    'bronce': _m('cromo', 0.3, (0.78, 0.48, 0.28), metal=1.0, rough=1.6),
    'espejo': dict(kind='espejo'),
    'vidrio': dict(kind='vidrio'),
    'vidrio_esmerilado': dict(kind='vidrio_esmerilado'),
    'luz_panel': dict(kind='emision', color=(1.0, 0.97, 0.92), fuerza=14.0),
    'luz_linea': dict(kind='emision', color=(1.0, 0.97, 0.92), fuerza=20.0),
    'pantalla': dict(kind='emision', color=(0.10, 0.22, 0.40), fuerza=1.5),
    'pantalla_negra': dict(kind='vidrio_oscuro'),
    'led_rojo': dict(kind='emision', color=(1.0, 0.08, 0.03), fuerza=12.0),
    'led_ambar': dict(kind='emision', color=(1.0, 0.55, 0.05), fuerza=12.0),
    'led_blanco': dict(kind='emision', color=(1.0, 1.0, 1.0), fuerza=8.0),
    'led_verde': dict(kind='emision', color=(0.1, 1.0, 0.2), fuerza=10.0),
}

for _k, _d in MATS.items():
    if _d.get('kind') == 'pbr':
        MAT_TILE[_k] = _d['tile']

# metalicidad propia de algunas texturas (si el material no la fija)
TEX_METAL = {'zinc': 0.75, 'cromo': 1.0, 'moleteado': 1.0, 'chapa': 0.6}

# carpeta de texturas (relativa al .blend)
DIR_TEX = 'texturas'
DIR_LM = 'lightmaps'
_imgs = {}
_base_mats = {}
ESCALA_TEX = 1.0


def _save_img(name, arr, path, non_color, quality=92):
    import numpy as np
    h, w = arr.shape[:2]
    if arr.ndim == 2:
        arr = np.stack([arr, arr, arr], -1)
    px = np.concatenate([arr, np.ones((h, w, 1))], -1).astype('float32')
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = quality
    img.save(filepath=path, quality=quality)
    img.filepath = path
    img.source = 'FILE'
    img.reload()
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def texturas(tex, outdir):
    """Genera (o carga si ya existen) albedo/rough/normal de una textura."""
    if tex in _imgs:
        return _imgs[tex]
    os.makedirs(os.path.join(outdir, DIR_TEX), exist_ok=True)
    paths = {k: os.path.join(outdir, DIR_TEX, f'{tex}_{k}.jpg') for k in ('albedo', 'rough', 'normal')}
    if all(os.path.exists(p) for p in paths.values()):
        res = {}
        for k, p in paths.items():
            img = bpy.data.images.load(p, check_existing=True)
            if k != 'albedo':
                img.colorspace_settings.name = 'Non-Color'
            res[k] = img
    else:
        d = TX.generar(tex, ESCALA_TEX)
        res = {
            'albedo': _save_img(f'{tex}_albedo', d['albedo'], paths['albedo'], False),
            'rough': _save_img(f'{tex}_rough', d['rough'], paths['rough'], True),
            'normal': _save_img(f'{tex}_normal', d['normal'], paths['normal'], True, 95),
        }
    _imgs[tex] = res
    return res


def modo_group():
    g = bpy.data.node_groups.get('MW_Modo')
    if g:
        return g
    g = bpy.data.node_groups.new('MW_Modo', 'ShaderNodeTree')
    g.interface.new_socket('k', in_out='OUTPUT', socket_type='NodeSocketFloat')
    out = g.nodes.new('NodeGroupOutput')
    val = g.nodes.new('ShaderNodeValue')
    val.name = 'Valor'
    val.outputs[0].default_value = 0.0
    g.links.new(val.outputs[0], out.inputs[0])
    return g


def set_modo(horneado):
    modo_group().nodes['Valor'].outputs[0].default_value = 1.0 if horneado else 0.0


def lightmap_image(group, res):
    name = f'LM_{group}'
    img = bpy.data.images.get(name)
    if img is None:
        img = bpy.data.images.new(name, res, res, alpha=True, float_buffer=True)
        img.generated_color = (0, 0, 0, 0)
    return img


def _vmath(nt, op, a, b=None, loc=(0, 0)):
    n = nt.nodes.new('ShaderNodeVectorMath')
    n.operation = op
    n.location = loc
    nt.links.new(a, n.inputs[0])
    if b is not None:
        if isinstance(b, (int, float)):
            n.inputs[3].default_value = b  # 'Scale'
        else:
            nt.links.new(b, n.inputs[3] if op == 'SCALE' else n.inputs[1])
    return n.outputs[0]


def _math(nt, op, a, b, loc=(0, 0), clamp=False):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    n.use_clamp = clamp
    n.location = loc
    for i, x in enumerate((a, b)):
        if isinstance(x, (int, float)):
            n.inputs[i].default_value = x
        else:
            nt.links.new(x, n.inputs[i])
    return n.outputs[0]


def _pbr(mat, spec, outdir, group, lm_res):
    nt = mat.node_tree
    nt.nodes.clear()
    imgs = texturas(spec['tex'], outdir)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (900, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (600, 0)
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    uvn = nt.nodes.new('ShaderNodeUVMap')
    uvn.uv_map = 'UVMap'
    uvn.location = (-900, 0)
    tA = nt.nodes.new('ShaderNodeTexImage')
    tA.image = imgs['albedo']
    tA.location = (-650, 250)
    tR = nt.nodes.new('ShaderNodeTexImage')
    tR.image = imgs['rough']
    tR.location = (-650, -50)
    tN = nt.nodes.new('ShaderNodeTexImage')
    tN.image = imgs['normal']
    tN.location = (-650, -350)
    for t in (tA, tR, tN):
        nt.links.new(uvn.outputs[0], t.inputs[0])
    attr = nt.nodes.new('ShaderNodeAttribute')
    attr.attribute_name = 'Tinte'
    attr.location = (-650, 500)
    rgb = nt.nodes.new('ShaderNodeRGB')
    rgb.outputs[0].default_value = (*_lin(spec['tint']), 1.0)
    rgb.location = (-650, 700)
    A = _vmath(nt, 'MULTIPLY', tA.outputs['Color'], attr.outputs['Color'], (-350, 400))
    A = _vmath(nt, 'MULTIPLY', A, rgb.outputs[0], (-200, 400))
    metal = spec['metal'] if spec['metal'] is not None else TEX_METAL.get(spec['tex'], 0.0)
    rough = _math(nt, 'MULTIPLY', tR.outputs['Color'], spec['rough'], (-350, -50), clamp=True)
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nm.uv_map = 'UVMap'
    nm.inputs['Strength'].default_value = spec['nrm']
    nm.location = (-350, -350)
    nt.links.new(tN.outputs['Color'], nm.inputs['Color'])
    k = nt.nodes.new('ShaderNodeGroup')
    k.node_tree = modo_group()
    k.location = (-350, 150)
    kk = k.outputs[0]
    # base = A * (1 - k*(1-metal))
    f = _math(nt, 'MULTIPLY', kk, 1.0 - metal, (-200, 200))
    f = _math(nt, 'SUBTRACT', 1.0, f, (-50, 200))
    base = _vmath(nt, 'SCALE', A, f, (100, 300))
    nt.links.new(base, bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = metal
    nt.links.new(rough, bsdf.inputs['Roughness'])
    nt.links.new(nm.outputs[0], bsdf.inputs['Normal'])
    if group is not None:
        uv2 = nt.nodes.new('ShaderNodeUVMap')
        uv2.uv_map = 'Lightmap'
        uv2.location = (-900, -650)
        tL = nt.nodes.new('ShaderNodeTexImage')
        tL.name = 'LM_TEX'
        tL.image = lightmap_image(group, lm_res)
        tL.interpolation = 'Linear'
        tL.extension = 'EXTEND'
        tL.location = (-650, -650)
        nt.links.new(uv2.outputs[0], tL.inputs[0])
        E = _vmath(nt, 'MULTIPLY', A, tL.outputs['Color'], (100, -600))
        nt.links.new(E, bsdf.inputs['Emission Color'])
        es = _math(nt, 'MULTIPLY', kk, 1.0 - metal, (100, -800))
        nt.links.new(es, bsdf.inputs['Emission Strength'])
        tgt = nt.nodes.new('ShaderNodeTexImage')
        tgt.name = 'BAKE_TGT'
        tgt.label = 'destino del horneado'
        tgt.image = tL.image
        tgt.location = (-650, -950)
    return mat


def _lin(c):
    def f(x):
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return tuple(f(x) for x in c)


def _special(mat, spec):
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (600, 0)
    kind = spec['kind']
    if kind == 'emision':
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (*spec['color'], 1)
        em.inputs['Strength'].default_value = spec['fuerza']
        nt.links.new(em.outputs[0], out.inputs[0])
    elif kind in ('vidrio', 'vidrio_esmerilado'):
        # vidrio "arquitectónico": transparente para las sombras (la luz del sol
        # entra al interior en el horneado) + reflejo fresnel
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        tr.inputs[0].default_value = (0.85, 0.92, 0.92, 1) if kind == 'vidrio' else (0.6, 0.65, 0.66, 1)
        gl = nt.nodes.new('ShaderNodeBsdfGlossy')
        gl.inputs['Roughness'].default_value = 0.02 if kind == 'vidrio' else 0.35
        gl.inputs['Color'].default_value = (1, 1, 1, 1)
        lw = nt.nodes.new('ShaderNodeLayerWeight')
        lw.inputs['Blend'].default_value = 0.25
        mx = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(lw.outputs['Fresnel'], mx.inputs[0])
        nt.links.new(tr.outputs[0], mx.inputs[1])
        nt.links.new(gl.outputs[0], mx.inputs[2])
        if kind == 'vidrio_esmerilado':
            df = nt.nodes.new('ShaderNodeBsdfDiffuse')
            df.inputs['Color'].default_value = (0.8, 0.82, 0.83, 1)
            mx2 = nt.nodes.new('ShaderNodeMixShader')
            mx2.inputs[0].default_value = 0.55
            nt.links.new(mx.outputs[0], mx2.inputs[1])
            nt.links.new(df.outputs[0], mx2.inputs[2])
            mx = mx2
        nt.links.new(mx.outputs[0], out.inputs[0])
        mat.surface_render_method = 'BLENDED'
        mat.use_transparent_shadow = True
    elif kind == 'vidrio_oscuro':
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = (0.012, 0.016, 0.02, 1)
        b.inputs['Roughness'].default_value = 0.04
        b.inputs['Specular IOR Level'].default_value = 0.6
        nt.links.new(b.outputs[0], out.inputs[0])
    elif kind == 'espejo':
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = (0.92, 0.93, 0.93, 1)
        b.inputs['Metallic'].default_value = 1.0
        b.inputs['Roughness'].default_value = 0.01
        nt.links.new(b.outputs[0], out.inputs[0])
    elif kind == 'agua':
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = (0.02, 0.05, 0.05, 1)
        b.inputs['Roughness'].default_value = 0.03
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = 6.0
        bm = nt.nodes.new('ShaderNodeBump')
        bm.inputs['Strength'].default_value = 0.08
        nt.links.new(nz.outputs[0], bm.inputs['Height'])
        nt.links.new(bm.outputs[0], b.inputs['Normal'])
        nt.links.new(b.outputs[0], out.inputs[0])
    return mat


def get_material(name, group, outdir, lm_res=1024):
    spec = MATS[name]
    if spec.get('kind') != 'pbr':
        group = None
    key = name if group is None else f'{name}@{group}'
    mat = bpy.data.materials.get(key)
    if mat:
        return mat
    mat = bpy.data.materials.new(key)
    mat.use_nodes = True
    if spec.get('kind') == 'pbr':
        _pbr(mat, spec, outdir, group, lm_res)
    else:
        _special(mat, spec)
    return mat
