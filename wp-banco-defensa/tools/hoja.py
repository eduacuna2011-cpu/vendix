# Une capturas en una hoja de contacto: python3 tools/hoja.py salida.png patron1 patron2 ...  (cada patrón = una fila)
import sys, glob
from PIL import Image, ImageDraw
out, pats = sys.argv[1], sys.argv[2:]
filas = [sorted(glob.glob(p), key=lambda f: float(f.rsplit('_', 2)[-2] + '.' + f.rsplit('_', 1)[-1].split('.')[0]) if f.count('_') > 2 else 0) for p in pats]
W, H, esc = 1280, 760, 0.32
w, h = int(W * esc), int(H * esc)
cols = max(len(f) for f in filas)
hoja = Image.new('RGB', (w * cols, (h + 18) * len(filas)), (12, 20, 30))
d = ImageDraw.Draw(hoja)
for r, fila in enumerate(filas):
    for c, f in enumerate(fila):
        im = Image.open(f).convert('RGB').resize((w, h))
        hoja.paste(im, (c * w, r * (h + 18) + 18))
        d.text((c * w + 4, r * (h + 18) + 3), f.split('/')[-1], fill=(255, 220, 60))
hoja.save(out)
print(out, hoja.size)
