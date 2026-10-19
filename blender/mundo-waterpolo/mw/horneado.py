# -*- coding: utf-8 -*-
"""Iluminación (cielo + sol + luminarias) y horneado de lightmaps con Cycles.

Se hornea el pase DIFFUSE (directa + indirecta, SIN color) => irradiancia pura.
El material multiplica luego albedo (tileable, alta resolución) x lightmap
(baja frecuencia), igual que hacen los motores de juego. Resultado: los suelos
mantienen el detalle de la textura y la luz global (GI, sombras suaves, AO)
queda horneada a coste cero.
"""
import math
import os
import time
import bpy
import numpy as np
from mathutils import Vector
from . import materiales as MT
from .geo import _select_only

SOL_ELEV = 34.0      # grados sobre el horizonte (tarde)
SOL_AZIM = 235.0     # grados (0 = norte +Y, sentido horario)


def sol_dir():
    e = math.radians(SOL_ELEV)
    a = math.radians(SOL_AZIM)
    return Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))


def mundo(coll_luces):
    sc = bpy.context.scene
    w = bpy.data.worlds.new('Cielo')
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'MULTIPLE_SCATTERING'
    sky.sun_disc = False
    sky.sun_elevation = math.radians(SOL_ELEV)
    # en el cielo de Blender la rotación 0 apunta a -Y y gira antihorario
    sky.sun_rotation = math.radians(180.0 - SOL_AZIM) % math.tau
    sky.altitude = 200.0
    sky.air_density = 1.0
    sky.aerosol_density = 1.2
    bg.inputs['Strength'].default_value = 0.22
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])

    ld = bpy.data.lights.new('Sol', 'SUN')
    ld.energy = 4.2
    ld.angle = math.radians(0.8)
    ld.color = (1.0, 0.93, 0.84)
    sol = bpy.data.objects.new('Sol', ld)
    coll_luces.objects.link(sol)
    d = sol_dir()
    sol.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    return sol


def config_cycles(samples):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = samples
    cy.use_adaptive_sampling = False
    cy.max_bounces = 8
    cy.diffuse_bounces = 4
    cy.glossy_bounces = 2
    cy.transmission_bounces = 4
    cy.transparent_max_bounces = 16
    cy.sample_clamp_direct = 0.0
    cy.sample_clamp_indirect = 8.0
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    sc.render.bake.margin = 0
    sc.render.bake.use_clear = False
    try:
        sc.render.threads_mode = 'AUTO'
    except Exception:
        pass


# ---------------------------------------------------------------------------
# post-proceso del lightmap: filtro con máscara (reduce ruido sin mezclar
# con píxeles vacíos) + dilatación (evita costuras negras por mip/filtrado)
# ---------------------------------------------------------------------------
def _gauss1d(sigma):
    r = max(1, int(math.ceil(sigma * 2.5)))
    x = np.arange(-r, r + 1)
    k = np.exp(-x * x / (2 * sigma * sigma))
    return k / k.sum(), r


def _blur(a, sigma):
    k, r = _gauss1d(sigma)
    out = np.zeros_like(a)
    for i, w in enumerate(k):
        out += np.roll(a, i - r, axis=0) * w
    a = out
    out = np.zeros_like(a)
    for i, w in enumerate(k):
        out += np.roll(a, i - r, axis=1) * w
    return out


def limpiar(rgb, mask, sigma=1.1, iters=12):
    m = mask.astype(np.float32)[..., None]
    if sigma > 0:
        num = _blur(rgb * m, sigma)
        den = _blur(m, sigma)
        rgb = np.where(den > 1e-4, num / np.maximum(den, 1e-4), 0.0) * m + rgb * (1 - m)
    # dilatación
    filled = m.copy()
    for _ in range(iters):
        acc = np.zeros_like(rgb)
        cnt = np.zeros_like(filled)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            acc += np.roll(np.roll(rgb * filled, dy, 0), dx, 1)
            cnt += np.roll(np.roll(filled, dy, 0), dx, 1)
        nuevo = (cnt > 0) & (filled < 0.5)
        rgb = np.where(nuevo, acc / np.maximum(cnt, 1e-6), rgb)
        filled = np.maximum(filled, nuevo.astype(np.float32))
    return rgb


def hornear(ob, res, samples, outdir, sigma=1.1):
    t0 = time.time()
    sc = bpy.context.scene
    sc.cycles.samples = samples
    img = MT.lightmap_image(ob.name, res)
    if tuple(img.size) != (res, res):
        img.scale(res, res)
    img.source = 'GENERATED'
    img.generated_width = res
    img.generated_height = res
    img.use_generated_float = True
    img.generated_color = (0, 0, 0, 0)
    img.pixels.foreach_set(np.zeros(res * res * 4, dtype=np.float32))
    mats = []
    for s in ob.material_slots:
        m = s.material
        if m and 'BAKE_TGT' in m.node_tree.nodes:
            nt = m.node_tree
            nt.nodes['LM_TEX'].image = None
            tgt = nt.nodes['BAKE_TGT']
            tgt.image = img
            for n in nt.nodes:
                n.select = False
            tgt.select = True
            nt.nodes.active = tgt
            mats.append(m)
    _select_only(ob)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=0,
                        use_clear=False, target='IMAGE_TEXTURES', uv_layer='Lightmap')
    px = np.empty(res * res * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(res, res, 4)
    mask = px[..., 3] > 0.5
    rgb = limpiar(px[..., :3], mask, sigma=0.0, iters=16)
    out = np.concatenate([rgb, np.ones((res, res, 1), np.float32)], -1).astype(np.float32)
    img.pixels.foreach_set(out.ravel())
    os.makedirs(os.path.join(outdir, MT.DIR_LM), exist_ok=True)
    path = os.path.join(outdir, MT.DIR_LM, f'LM_{ob.name}.exr')
    raw = os.path.join(outdir, MT.DIR_LM, f'_crudo_{ob.name}.exr')
    _guardar_exr(img, raw)
    ok = _oidn(raw, path, res)
    if not ok:
        # sin OIDN: filtro gaussiano con máscara como alternativa
        rgb = limpiar(px[..., :3], mask, sigma)
        out = np.concatenate([rgb, np.ones((res, res, 1), np.float32)], -1).astype(np.float32)
        img.pixels.foreach_set(out.ravel())
        _guardar_exr(img, path)
    try:
        os.remove(raw)
    except OSError:
        pass
    # recargar desde disco
    img.source = 'FILE'
    img.filepath = path
    img.reload()
    img.colorspace_settings.name = 'Linear Rec.709'
    for m in mats:
        m.node_tree.nodes['LM_TEX'].image = img
        m.node_tree.nodes['BAKE_TGT'].image = img
    cov = mask.mean() * 100
    print(f'   horneado {ob.name}: {res}px {samples}spp  cobertura {cov:.0f}%  {time.time() - t0:.0f}s', flush=True)


def _guardar_exr(img, path):
    sc = bpy.context.scene
    st = sc.render.image_settings
    prev = (st.file_format, st.color_depth, st.exr_codec, st.color_mode)
    st.file_format = 'OPEN_EXR'
    st.color_depth = '16'
    st.exr_codec = 'DWAA'
    st.color_mode = 'RGB'
    img.save_render(path, scene=sc)
    st.file_format, st.color_depth, st.exr_codec, st.color_mode = prev


def _oidn(src, dst, res):
    """Denoise OIDN usando el compositor de Blender (escena auxiliar vacía)."""
    try:
        sc = bpy.data.scenes.get('MW_Denoise')
        if sc is None:
            sc = bpy.data.scenes.new('MW_Denoise')
            sc.render.engine = 'CYCLES'
            sc.cycles.samples = 1
            sc.cycles.device = 'CPU'
            cam = bpy.data.objects.new('MW_Denoise_cam', bpy.data.cameras.new('MW_Denoise_cam'))
            sc.collection.objects.link(cam)
            sc.camera = cam
            ng = bpy.data.node_groups.new('MW_Denoise', 'CompositorNodeTree')
            ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
            sc.compositing_node_group = ng
            i = ng.nodes.new('CompositorNodeImage')
            i.name = 'IN'
            d = ng.nodes.new('CompositorNodeDenoise')
            try:
                d.inputs['HDR'].default_value = True
            except Exception:
                pass
            o = ng.nodes.new('NodeGroupOutput')
            ng.links.new(i.outputs[0], d.inputs[0])
            ng.links.new(d.outputs[0], o.inputs[0])
            sc.render.use_compositing = True
            sc.view_settings.view_transform = 'Standard'
            st = sc.render.image_settings
            st.file_format = 'OPEN_EXR'
            st.color_depth = '16'
            st.exr_codec = 'DWAA'
            st.color_mode = 'RGB'
        im = bpy.data.images.load(src)
        sc.compositing_node_group.nodes['IN'].image = im
        sc.render.resolution_x = res
        sc.render.resolution_y = res
        sc.render.resolution_percentage = 100
        sc.render.filepath = dst
        bpy.ops.render.render(write_still=True, scene=sc.name)
        bpy.data.images.remove(im)
        return os.path.exists(dst)
    except Exception as e:  # pragma: no cover
        print('   (OIDN no disponible:', e, ')')
        return False


def limpiar_denoise():
    sc = bpy.data.scenes.get('MW_Denoise')
    if sc:
        cam = sc.camera
        ng = sc.compositing_node_group
        bpy.data.scenes.remove(sc)
        if cam:
            bpy.data.objects.remove(cam)
        if ng:
            bpy.data.node_groups.remove(ng)
