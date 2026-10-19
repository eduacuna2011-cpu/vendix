# -*- coding: utf-8 -*-
"""
MUNDO WATERPOLO — generador procedural para Blender 5.0+

Crea un barrio europeo con un GIMNASIO de alto rendimiento (edificio propio)
y un CENTRO DE WATERPOLO (recepción, vestuarios local/visitante, sala de
vídeo, entrenadores, fisioterapia, enfermería y almacén de material), dejando
libre la parcela del pool deck (x[-28,28] y[-86,-50]), con texturas PBR tileables e
iluminación HORNEADA (lightmaps Cycles + OIDN) para máximo rendimiento.

Uso (línea de comandos):
    blender -b -P generar_mundo.py -- --calidad alta
    blender -b -P generar_mundo.py -- --calidad borrador --render

Opciones:
    --calidad borrador|media|alta   resolución / muestras de los lightmaps
    --sin-hornear                    sólo geometría + materiales (modo dinámico)
    --render                         renderiza las vistas de cámara en ./renders
    --salida DIR                     carpeta de salida (por defecto, la del script)

Resultado: mundo_waterpolo.blend + texturas/ + lightmaps/ (+ renders/)
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
from mw import ciudad
from mw import centro
from mw import gimnasio
from mw import waterpolo

CALIDADES = {
    #            escala res. lightmap, muestras interior, muestras exterior, escala texturas
    'borrador': (0.5, 16, 12, 0.5),
    'media': (0.5, 64, 32, 1.0),
    'alta': (1.0, 112, 56, 1.0),
}

# grupo: (colección, horneado, resolución base del lightmap, interior)
GRUPOS = {
    'Ciudad_Suelo': ('Ciudad', True, 2048, False),
    'Edificios_Norte': ('Ciudad', True, 4096, False),
    'Edificios_Oeste': ('Ciudad', True, 2048, False),
    'Edificios_Este': ('Ciudad', True, 2048, False),
    'Edificios_Sur': ('Ciudad', True, 1024, False),
    'Mobiliario_Urbano': ('Ciudad', True, 2048, False),
    'Arboles': ('Ciudad', True, 1024, False),
    'Ciudad_Vidrios': ('Ciudad', False, 0, False),
    'Ciudad_Agua': ('Ciudad', False, 0, False),
    'Centro_Exterior': ('Centro_Waterpolo', True, 2048, False),
    'Recepcion': ('Centro_Waterpolo', True, 2048, True),
    'Gimnasio_Sala': ('Centro_Waterpolo', True, 2048, True),
    'Gimnasio_Equipos': ('Centro_Waterpolo', True, 2048, True),
    'Vestuarios': ('Centro_Waterpolo', True, 2048, True),
    'Video_Fisio': ('Centro_Waterpolo', True, 2048, True),
    'Almacen_WP': ('Centro_Waterpolo', True, 1024, True),
    'Centro_Vidrios': ('Centro_Waterpolo', False, 0, False),
    'Centro_Luminarias': ('Centro_Waterpolo', False, 0, False),
    'Centro_Espejos': ('Centro_Waterpolo', False, 0, False),
}

# cámaras: nombre, posición, objetivo, focal, exposición
CAMARAS = [
    ('CAM_01_Aerea', (-52, 8, 40), (0, -42, 0), 24, 0.0),
    ('CAM_02_Plaza', (-14, 24, 1.7), (2, -6, 4), 22, 0.0),
    ('CAM_03_Calle_Centro', (-1, -9.5, 1.7), (0, -26, 3.5), 18, 0.0),
    ('CAM_04_Calle_Haussmann', (-26, 31, 1.7), (26, 31, 9), 24, 0.0),
    ('CAM_05_Gimnasio', (-6.9, -24.9, 1.75), (-20, -36, 0.9), 15, 1.0),
    ('CAM_06_Gimnasio_Racks', (-24.2, -29.4, 1.7), (-8, -29.4, 1.2), 17, 1.0),
    ('CAM_07_Gimnasio_Mancuernas', (-7.2, -38.2, 1.6), (-24, -34.5, 0.9), 17, 1.0),
    ('CAM_08_Recepcion', (9.2, -25.0, 1.7), (3, -33, 1.4), 16, 0.8),
    ('CAM_09_Vestuario_Local', (7.2, -37.2, 1.7), (2.5, -45.5, 1.0), 15, 1.0),
    ('CAM_10_Vestuario_Visitante', (16.3, -46.9, 1.7), (23.5, -38.5, 1.0), 15, 1.0),
    ('CAM_11_Sala_Video', (18.6, -25.0, 1.75), (10.5, -31.5, 1.4), 16, 1.0),
    ('CAM_12_Fisioterapia', (23.5, -33.5, 1.75), (24.6, -25.5, 0.8), 16, 1.0),
    ('CAM_13_Almacen', (13.6, -37.0, 1.75), (11.5, -45.5, 0.6), 15, 1.0),
    ('CAM_14_Pasillo', (2.7, -35.0, 1.7), (27, -35, 1.4), 20, 0.8),
    ('CAM_15_Parcela_PoolDeck', (6, -91.5, 7.5), (0, -45, 2.5), 18, 0.0),
    ('CAM_16_Patio', (-2.0, -49.0, 1.7), (-2.0, -22, 3.5), 18, 0.0),
    ('CAM_17_Aerea_Centro', (42, -12, 30), (0, -42, 1), 22, 0.0),
]


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--calidad', default='alta', choices=list(CALIDADES))
    p.add_argument('--sin-hornear', action='store_true')
    p.add_argument('--render', action='store_true')
    p.add_argument('--solo', default='', help='renderizar sólo cámaras que contengan este texto')
    p.add_argument('--salida', default=AQUI)
    p.add_argument('--res-render', default='1600x900')
    return p.parse_args(argv)


def coleccion(nombre, padre=None):
    c = bpy.data.collections.get(nombre)
    if c is None:
        c = bpy.data.collections.new(nombre)
        (padre or bpy.context.scene.collection).children.link(c)
    return c


def config_eevee(sc):
    """Ajustes de EEVEE para ver el modo horneado (sin luces dinámicas)."""
    sc.render.engine = 'BLENDER_EEVEE'
    ee = sc.eevee
    for attr, val in (('use_raytracing', False), ('use_shadows', False), ('taa_render_samples', 16),
                      ('taa_samples', 8), ('use_gtao', True), ('fast_gi_method', 'GLOBAL_ILLUMINATION')):
        try:
            setattr(ee, attr, val)
        except Exception:
            pass


def camaras(col):
    out = []
    for nom, pos, obj, lens, expo in CAMARAS:
        cd = bpy.data.cameras.new(nom)
        cd.lens = lens
        cd.clip_start = 0.05
        cd.clip_end = 600
        cd.sensor_width = 36
        ob = bpy.data.objects.new(nom, cd)
        col.objects.link(ob)
        ob.location = pos
        d = Vector(obj) - Vector(pos)
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        ob['exposicion'] = expo
        out.append(ob)
    return out


def sondas(col):
    """Sondas de reflexión de EEVEE por estancia (hornear en EEVEE: Render >
    Bake Light Probes), para que el cromo y el vidrio reflejen la sala y no el cielo."""
    salas = [('Sonda_Gimnasio', (-16.8, -35, 2.8), 12), ('Sonda_Recepcion', (6, -29, 1.8), 6),
             ('Sonda_Pasillo', (15, -35, 1.6), 13), ('Sonda_Vest_Local', (6.4, -42, 1.6), 7),
             ('Sonda_Vest_Visita', (19.6, -42, 1.6), 7), ('Sonda_Video', (14.5, -29, 1.6), 6),
             ('Sonda_Fisio', (25.3, -29, 1.6), 5), ('Sonda_Almacen', (13, -42, 1.6), 6),
             ('Sonda_Exterior', (0, -10, 6), 60)]
    for nom, pos, r in salas:
        lp = bpy.data.lightprobes.new(nom, 'SPHERE')
        try:
            lp.influence_distance = r
        except Exception:
            pass
        ob = bpy.data.objects.new(nom, lp)
        ob.location = pos
        col.objects.link(ob)


def main():
    a = args()
    t0 = time.time()
    esc_lm, spp_int, spp_ext, esc_tex = CALIDADES[a.calidad]
    out = os.path.abspath(a.salida)
    os.makedirs(out, exist_ok=True)
    MT.ESCALA_TEX = esc_tex

    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = 'Mundo_Waterpolo'
    sc.unit_settings.system = 'METRIC'
    # guardar primero para que las rutas relativas (//texturas) funcionen
    blend = os.path.join(out, 'mundo_waterpolo.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)

    col_luces = coleccion('Luces_Horneado')
    col_cam = coleccion('Camaras')

    B = {}
    for nom, (cn, bake, res, interior) in GRUPOS.items():
        B[nom] = G.Builder(nom, bake, max(256, int(res * esc_lm)) if bake else 0)

    rnd = random.Random(2026)
    print('> construyendo ciudad...', flush=True)
    ciudad.suelos(B['Ciudad_Suelo'])
    ciudad.edificios(B['Edificios_Oeste'], B['Edificios_Este'], B['Edificios_Norte'], B['Edificios_Sur'],
                     B['Ciudad_Vidrios'], rnd)
    ciudad.mobiliario(B['Mobiliario_Urbano'], B['Arboles'], B['Ciudad_Vidrios'], B['Ciudad_Agua'], rnd)
    print('> construyendo centro de waterpolo...', flush=True)
    centro.construir(B, rnd)
    gimnasio.construir(B, rnd)
    waterpolo.construir(B, rnd)

    print('> creando objetos...', flush=True)
    objetos = []
    for nom, b in B.items():
        if not b.F:
            continue
        cn, bake, res, interior = GRUPOS[nom]
        col = coleccion(cn)
        ob = b.build(col, lambda m, g, _r=b.res: MT.get_material(m, g, out, _r))
        objetos.append((ob, b, interior))
        print(f'   {nom}: {len(b.F)} caras, {len(b.mats)} materiales', flush=True)
    for ob, b, interior in objetos:
        if b.bake:
            G.lightmap_uv(ob, b.res)

    H.mundo(col_luces)
    sondas(coleccion('Sondas_Reflexion'))
    cams = camaras(col_cam)
    sc.camera = cams[0]
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass

    if not a.sin_hornear:
        print(f'> horneando lightmaps ({a.calidad})...', flush=True)
        H.config_cycles(spp_int)
        MT.set_modo(False)
        for ob, b, interior in objetos:
            if b.bake:
                H.hornear(ob, b.res, spp_int if interior else spp_ext, out)
        H.limpiar_denoise()
        MT.set_modo(True)
        col_luces.hide_render = True
        col_luces.hide_viewport = True
    else:
        MT.set_modo(False)

    config_eevee(sc)
    sc.render.resolution_x, sc.render.resolution_y = (int(v) for v in a.res_render.split('x'))
    bpy.ops.file.make_paths_relative()
    bpy.ops.wm.save_as_mainfile(filepath=blend, relative_remap=True, compress=True)
    print(f'> guardado {blend}  ({time.time() - t0:.0f}s)', flush=True)

    if a.render:
        render_vistas(sc, cams, out, horneado=not a.sin_hornear, solo=a.solo)
    print(f'> listo en {time.time() - t0:.0f}s', flush=True)


def render_vistas(sc, cams, out, horneado=True, solo=''):
    """Render de las cámaras con Cycles. En modo horneado sólo hay emisión
    (albedo x lightmap) + reflejos: es una vista previa fiel de lo que verá EEVEE."""
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = 24 if horneado else 64
    cy.use_denoising = True
    if horneado:
        cy.max_bounces = 3
        cy.diffuse_bounces = 0
        cy.glossy_bounces = 2
        cy.transparent_max_bounces = 8
    os.makedirs(os.path.join(out, 'renders'), exist_ok=True)
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 90
    for cam in cams:
        if solo and solo not in cam.name:
            continue
        sc.camera = cam
        sc.view_settings.exposure = cam.get('exposicion', 0.0)
        sc.render.filepath = os.path.join(out, 'renders', cam.name + '.jpg')
        t = time.time()
        bpy.ops.render.render(write_still=True)
        print(f'   render {cam.name} {time.time() - t:.0f}s', flush=True)


if __name__ == '__main__':
    main()
