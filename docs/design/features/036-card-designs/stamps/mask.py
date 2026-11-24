from PIL import Image, ImageDraw, ImageFont
import numpy as np, os, sys
def ink(path, mode='auto'):
    im = np.array(Image.open(path).convert('RGBA')).astype(float) / 255
    rgb, a = im[..., :3], im[..., 3]
    L = rgb @ np.array([.299, .587, .114])
    if mode == 'alpha': return a / max(a.max(), 1e-6)
    if mode == 'lum':
        op = a > .5; lo, hi = np.percentile(L[op], 3), np.percentile(L[op], 97)
        return a * ((hi + .03 - L) / (hi + .03 - lo)).clip(0, 1)
    trans = (a < .5).mean() > .05
    if trans or mode == 'trans':
        op = a > .5
        if not op.any(): return a
        lo, hi = np.percentile(L[op], 5), np.percentile(L[op], 95)
        if mode == 'light' or (hi - lo < .25) or np.median(L[op]) > .72: return a
        return a * ((hi + .02 - L) / (hi + .02 - lo)).clip(0, 1)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    d = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    m = (d / .55).clip(0, 1)
    if mode == 'dark':  # only dark ink counts (drop colored fills)
        m = ((bg @ np.array([.299, .587, .114])) - L).clip(0, 1) / .6
    m[m < .1] = 0
    return m.clip(0, 1)
def tile(m, size, label, font):
    h, w = m.shape; k = min(size / w, (size - 18) / h)
    im = Image.fromarray((m * 255).astype('uint8')).resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    t = Image.new('RGB', (size, size), (40, 44, 52)); t.paste(Image.new('RGB', im.size, (245, 245, 245)), ((size - im.size[0]) // 2, 18), im)
    ImageDraw.Draw(t).text((4, 2), label, fill=(255, 200, 80), font=font); return t
if __name__ == '__main__':
    d = sys.argv[1]; files = sorted(os.listdir(d)); font = ImageFont.load_default()
    per, cols, size = 24, 6, 220
    for s in range(0, len(files), per):
        chunk = files[s:s + per]; rows = (len(chunk) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * size, rows * size), (0, 0, 0))
        for i, f in enumerate(chunk):
            sheet.paste(tile(ink(os.path.join(d, f)), size - 4, f[:-4][:34], font), ((i % cols) * size, (i // cols) * size))
        sheet.save(f'sheet{s // per}.png')
    print(len(files))
