# -*- coding: utf-8 -*-
"""Genera cargador_barra.html: un solo archivo (sin internet) con la barra, la plataforma, el rack
y los discos de equipamiento/equipamiento_gym.glb.

    python3 crear_cargador.py
Requiere: equipamiento/equipamiento_gym.glb (exportar_equipamiento.py) y
          web/cargador.bundle.js (cd web && node empaquetar.mjs cargador.html cargador.bundle.js)
"""
import os
import base64

AQUI = os.path.dirname(os.path.abspath(__file__))


def main():
    frag = open(os.path.join(AQUI, 'web', 'cargador.html'), encoding='utf-8').read()
    i = frag.index('</style>') + len('</style>')
    a = frag.index('<script type="importmap">')
    b = frag.index('</script>', frag.index('<script type="module">')) + len('</script>')
    js = open(os.path.join(AQUI, 'web', 'cargador.bundle.js'), encoding='utf-8').read().replace('</script', '<\\/script')
    glb = base64.b64encode(open(os.path.join(AQUI, 'equipamiento', 'equipamiento_gym.glb'), 'rb').read()).decode('ascii')
    cuerpo = frag[i:a] + '<script>window.MW_GLB = "' + glb + '";</script>\n<script>\n' + js + '\n</script>' + frag[b:]
    html = ('<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>html,body{margin:0}[hidden]{display:none!important}</style>\n'
            + frag[:i] + '\n</head>\n<body>\n' + cuerpo + '\n</body>\n</html>\n')
    destino = os.path.join(AQUI, 'cargador_barra.html')
    open(destino, 'w', encoding='utf-8').write(html)
    print(f'> {destino} ({os.path.getsize(destino) / 1e6:.1f} MB)')


if __name__ == '__main__':
    main()
