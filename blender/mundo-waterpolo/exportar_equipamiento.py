# -*- coding: utf-8 -*-
"""
Biblioteca de equipamiento reutilizable (modo de juego): cada pieza es un objeto independiente.

    python exportar_equipamiento.py          (python + bpy)
    blender -b -P exportar_equipamiento.py

Salida: equipamiento/equipamiento_gym.glb

Convenciones (para el código del juego):
  - Unidades en metros, glTF Y-arriba (en Blender Z-arriba).
  - Discos, barras, mancuernas, collarines y balones: pivote en su CENTRO; eje de la barra / del
    agujero del disco a lo largo de X.
  - Kettlebells, bancos, racks, plataformas, cajas y soportes: pivote en el centro de su BASE (suelo).
  - extras de cada objeto: tipo, peso_kg y medidas útiles (p. ej. en las barras, dónde empieza y
    acaba cada manga para cargar discos: manga_x_min / manga_x_max, simétrico en -X).
  - Materiales PBR estándar (sin lightmap: los objetos del juego se mueven, usan luz dinámica o la
    sonda de entorno).
Requiere web/tex (se genera con exportar_web.py).
"""
import os
import re
import sys
import math

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

import bpy
from mathutils import Vector, Matrix
from mw import geo as G
from mw import materiales as MT
from mw import gimnasio as GYM
from mw.geo import T, Rz, Ry, Rx
import exportar_glb

SALIDA = os.path.join(AQUI, 'equipamiento')
CENTRO = ('Disco_', 'Barra_', 'Mancuerna_', 'Collarin', 'Balon_')


def extras(nombre):
    """Metadatos por nombre de pieza."""
    d = {}
    m = re.match(r'Disco_([\d_]+)kg', nombre)
    if m:
        kg = float(m.group(1).replace('_', '.'))
        d.update(tipo='disco', peso_kg=kg, diametro_m=round(2 * GYM.RADIO[kg], 3), grosor_m=GYM.GROSOR[kg],
                 agujero_mm=50.4, eje='X')
    elif nombre.startswith('Barra_Olimpica_20kg'):
        d.update(tipo='barra', peso_kg=20, largo_m=2.2, agarre_mm=28, manga_mm=50,
                 manga_x_min=0.70, manga_x_max=1.11, eje='X')
    elif nombre.startswith('Barra_Olimpica_15kg'):
        d.update(tipo='barra', peso_kg=15, largo_m=2.01, agarre_mm=25, manga_mm=50,
                 manga_x_min=0.70, manga_x_max=1.015, eje='X')
    elif nombre.startswith('Barra_EZ'):
        d.update(tipo='barra', peso_kg=10, largo_m=1.24, manga_mm=50, manga_x_min=0.425, manga_x_max=0.62, eje='X')
    elif nombre.startswith('Barra_Hexagonal'):
        d.update(tipo='barra', peso_kg=25, largo_m=2.08, manga_mm=50, manga_x_min=0.63, manga_x_max=1.04, eje='X')
    elif nombre.startswith('Barra_Safety_Squat'):
        d.update(tipo='barra', peso_kg=30, largo_m=2.1, manga_mm=50, manga_x_min=0.63, manga_x_max=1.05, eje='X')
    elif (m := re.match(r'Mancuerna_([\d_]+)kg', nombre)):
        d.update(tipo='mancuerna', peso_kg=float(m.group(1).replace('_', '.')), eje='X')
    elif (m := re.match(r'Kettlebell_([\d_]+)kg', nombre)):
        d.update(tipo='kettlebell', peso_kg=float(m.group(1).replace('_', '.')))
    elif (m := re.match(r'Balon_Medicinal_(\d+)kg', nombre)):
        d.update(tipo='balon_medicinal', peso_kg=float(m.group(1)))
    elif (m := re.match(r'Caja_Pliometrica_(\d+)cm', nombre)):
        d.update(tipo='caja_pliometrica', altura_m=int(m.group(1)) / 100)
    elif nombre.startswith('Collarin'):
        d.update(tipo='collarin', peso_kg=0.15, eje='X')
    elif nombre.startswith('Banco'):
        d.update(tipo='banco')
    elif nombre.startswith('Rack_'):
        d.update(tipo='rack')
    return d


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(SALIDA, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SALIDA, '_equipamiento.blend'))
    col = bpy.data.collections.new('Equipamiento')
    bpy.context.scene.collection.children.link(col)

    # (builder, prefijos de piezas que se conservan o None = todas)
    tandas = []

    def tanda(nombre, conservar=None):
        b = G.Builder(nombre, bake=False)
        tandas.append((b, conservar))
        return b

    X = Ry(math.pi / 2)        # eje del disco a lo largo de X
    # --- discos (fila y = 0)
    b = tanda('Discos')
    for i, kg in enumerate((25, 20, 15, 10, 5, 2.5, 1.25)):
        GYM.disco(b, T(i * 0.6, 0, GYM.RADIO[kg]) @ X, kg)
    GYM.collarin(b, T(4.4, 0, 0.05) @ X)
    # --- barras (y = -1.5 ...)
    b = tanda('Barras')
    GYM.barra(b, T(0, -1.5, 0.03), tipo='H20')
    GYM.barra(b, T(0, -1.9, 0.03), tipo='M15')
    GYM.barra_ez(b, T(0, -2.3, 0.04))
    GYM.barra_hex(b, T(0, -3.2, 0.04))
    GYM.barra_ssb(b, T(0, -4.3, 0.12))
    # --- mancuernas 2.5 - 50 kg (eje X)
    b = tanda('Mancuernas')
    for i in range(20):
        kg = 2.5 * (i + 1)
        r = 0.05 + 0.0125 * kg ** 0.5
        GYM.mancuerna(b, T((i % 10) * 0.5, -5.4 - (i // 10) * 0.5, r) @ Rz(math.pi / 2), kg)
    # --- kettlebells
    b = tanda('Kettlebells')
    for i, kg in enumerate((8, 12, 16, 20, 24, 28, 32)):
        GYM.kettlebell(b, T(i * 0.4, -6.8, 0), kg)
    # --- bancos
    b = tanda('Bancos')
    GYM.banco_plano(b, T(0, -8.0, 0))
    for i, ang in enumerate((0, 15, 30, 45, 60, 80)):
        GYM.banco_regulable(b, T(1.6 + i * 0.9, -8.0, 0) @ Rz(math.pi / 2), ang=ang)
    # --- balones, cajas, fitball, BOSU
    b = tanda('Accesorios')
    for i, (kg, c) in enumerate(((3, (0.78, 0.07, 0.06)), (5, (0.05, 0.22, 0.65)), (7, (0.95, 0.74, 0.05)))):
        r = 0.15 + 0.01 * i
        GYM.balon_medicinal(b, T(i * 0.5, -9.4, r), r, c, f'Balon_Medicinal_{kg}kg')
    for i, h in enumerate((30, 45, 60, 75)):
        GYM.caja_plio(b, T(1.8 + i * 0.9, -9.7, 0), 0.75, 0.6, h / 100, f'Caja_Pliometrica_{h}cm')
    GYM.fitball(b, T(5.6, -9.4, 0), 0.33, (0.05, 0.22, 0.65))
    GYM.bosu(b, T(6.5, -9.4, 0))
    GYM.soporte_magnesio(b, T(7.4, -9.4, 0))
    # --- rack con sus piezas (sin discos ni barra)
    b = tanda('Rack', ('Rack_',))
    GYM.rack(b, {'luz': b}, T(0, -11.5, 0), 'peso_muerto', None, 'Potencia')
    b = tanda('Plataforma')
    GYM.plataforma(b, T(3.0, -11.5, 0), 'Plataforma_Halterofilia')
    GYM.plataforma(b, T(6.0, -11.5, 0), 'Plataforma_Fuerza', fuerza=True)
    b = tanda('PlataformasFuerza')
    GYM.plataformas_fuerza(b, b, T(6.0, -12.95, 0.01), 'Plataformas_Fuerza_Par')
    # --- almacenaje vacío
    b = tanda('Almacenaje', ('Rack_Mancuernas', 'Arbol_Discos', 'Soporte_Barras', 'Estante_Kettlebells'))
    GYM.rack_mancuernas(b, T(0, -15.0, 0), [], 'Vacio')
    GYM.arbol_discos(b, T(4.6, -15.0, 0), [()], 'Vacio')
    GYM.soporte_barras(b, T(6.0, -15.0, 0))
    GYM.estante_kettlebells(b, T(7.0, -15.2, 0))

    objs = []
    for b, conservar in tandas:
        ob = b.build(col, lambda m, g: MT.get_material(m, None, SALIDA, 0))
        nuevos = G.separar_piezas(ob, col)
        bpy.data.objects.remove(ob)
        for o in nuevos:
            if o.name == b.name or (conservar and not o.name.startswith(conservar)):
                bpy.data.objects.remove(o)
                continue
            if o.name.startswith(CENTRO):
                # pivote en el centro geométrico (no en la base)
                bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
                cz = (min(v.z for v in bb) + max(v.z for v in bb)) / 2
                dz = cz - o.location.z
                o.data.transform(Matrix.Translation((0, 0, -dz)))
                o.location.z += dz
            for k, v in extras(o.name).items():
                o[k] = v
            objs.append(o)
    print(f'   {len(objs)} objetos', flush=True)

    exportar_glb.WEB = os.path.join(AQUI, 'web')
    man = {'lightmaps': {}}
    for o in objs:
        for s in o.material_slots:
            if s.material and not s.material.name.startswith('GLTF_'):
                s.material = exportar_glb.mat_gltf(s.material.name, man)
    exportar_glb.exportar(objs, os.path.join(SALIDA, 'equipamiento_gym.glb'), draco=False)
    with open(os.path.join(SALIDA, 'catalogo.txt'), 'w', encoding='utf-8') as fh:
        for o in sorted(objs, key=lambda o: o.name):
            ex = {k: o[k] for k in o.keys() if not k.startswith('_')}
            fh.write(f'{o.name:42s} {ex}\n')


if __name__ == '__main__':
    main()
