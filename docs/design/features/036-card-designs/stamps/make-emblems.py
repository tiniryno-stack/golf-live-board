from PIL import Image, ImageDraw, ImageFont
import numpy as np, os, json, sys
from mask import ink
P = 'lg/png/'
# slug: (file, rule, mode)  rule: whole | top | left | right | (x0,y0,x1,y1) fractions of the image
SPEC = {
 'twin-creeks': ('twin-creeks', (.27,.2,.73,.74), 'auto'), 'bridlewood': ('bridlewood', (.2,0,.8,.44), 'alpha'), 'firewheel': ('firewheel', (.24,.2,.8,.73), 'dark'),
 'pga-frisco': ('pga-frisco', 'top', 'auto'), 'tpc-craig-ranch': ('tpc-craig-ranch', 'top', 'auto'), 'westin-stonebriar': ('westin-stonebriar', 'whole', 'auto'),
 'colonial': ('colonial-building', 'whole', 'auto'), 'rockwood-park': ('rockwood-park', (.38,.0,.62,.42), 'auto'), 'tpc-las-colinas': ('tpc-las-colinas-n', 'whole', 'auto'),
 'trinity-forest': ('trinity-forest-header', 'top', 'auto'), 'stevens-park': ('stevens-park-white', (.56,0,1,1), 'auto'), 'cedar-crest': ('cedar-crest', 'top', 'auto'),
 'tour-18-dallas': ('tour-18-dallas-flag', 'whole', 'auto'), 'cowboys-golf-club': ('cowboys-golf-club', 'top', 'auto'), 'grapevine': ('grapevine', (.0,.0,1,.72), 'auto'),
 'texas-star': ('texas-star', (0,.22,1,.84), 'auto'), 'tribute': ('tribute', 'top', 'auto'), 'old-american': ('old-american', 'top', 'auto'),
 'sherrill-park': ('sherrill-park', 'whole', 'lum'), 'pecan-hollow': ('pecan-hollow-emblem', 'whole', 'auto'), 'texas-rangers-golf-club': ('texas-rangers-golf-club-t', 'whole', 'auto'),
 'tierra-verde': (None, None, None), 'buffalo-creek': ('buffalo-creek-site', 'top', 'auto'), 'coyote-ridge': ('coyote-ridge-white', 'top', 'auto'),
 'indian-creek': ('indian-creek-stacked', 'top', 'auto'), 'riverchase': (None, None, None), 'lake-park': ('lake-park-mark', 'whole', 'auto'),
 'wildhorse-robson-ranch': ('wildhorse-robson-ranch-horse', 'whole', 'auto'), 'lantana': ('lantana-mark', 'whole', 'auto'), 'ridgeview-ranch': ('ridgeview-ranch-white', (.22,.22,.78,.72), 'auto'),
 'watters-creek': ('watters-creek-site', (0,0,.235,1), 'auto'), 'heritage-ranch': ('heritage-ranch-white', (.0,.0,1,.42), 'auto'), 'plantation': ('plantation-mark', 'whole', 'auto'),
 'woodbridge': ('woodbridge-color', 'whole', 'auto'), 'tenison-park': ('tenison-park', 'whole', 'auto'), 'luna-vista': ('luna-vista', 'whole', 'auto'),
 'golf-club-of-dallas': ('golf-club-of-dallas', (.2,0,.8,.56), 'auto'), 'waterview': ('waterview', 'top', 'auto'), 'mesquite': ('mesquite', 'top', 'auto'),
 'bear-creek': ('bear-creek-bear', 'whole', 'auto'), 'iron-horse': ('iron-horse', 'top', 'auto'), 'sky-creek-ranch': ('sky-creek-ranch-horse', 'whole', 'auto'),
 'riverside': ('riverside-site', 'top', 'lum'), 'tangle-ridge': (None, None, None), 'prairie-lakes': ('prairie-lakes', 'top', 'auto'),
 'lake-arlington': ('lake-arlington', 'top', 'auto'), 'mansfield-national': ('mansfield-national-star', 'whole', 'auto'), 'hidden-creek': ('hidden-creek', 'top', 'auto'),
 'old-brickyard': ('old-brickyard', 'whole', 'auto'), 'pecan-valley': ('pecan-valley', (0,0,1,.56), 'alpha'), 'meadowbrook': ('meadowbrook', 'top', 'alpha'),
 'waterchase': ('waterchase-flag-icon', 'whole', 'alpha'), 'hawks-creek': ('hawks-creek-scorecard', (.36,0,1,.72), 'auto'), 'austin-country-club': ('austin-country-club', 'whole', 'auto'),
 'barton-creek': ('barton-creek', 'top', 'auto'), 'wolfdancer': ('wolfdancer', 'top', 'auto'), 'lions-municipal': ('lions-municipal-bluegolf', (0,0,1,.9), 'auto'),
 'avery-ranch': ('avery-ranch-site', (0,0,.34,1), 'auto'), 'grey-rock': (None, None, None), 'roy-kizer': ('roy-kizer-bird', 'whole', 'auto'),
 'jimmy-clay': ('roy-kizer-bird', 'whole', 'auto'), 'morris-williams': ('morris-williams-monogram', 'whole', 'auto'), 'hancock': (None, None, None),
 'falconhead': ('falconhead-falcon', 'whole', 'auto'), 'teravista': ('teravista-bluegolf', 'top', 'auto'), 'forest-creek': ('forest-creek-tower', 'whole', 'auto'),
 'crystal-falls': ('crystal-falls', (0,0,1,.42), 'auto'), 'plum-creek': ('plum-creek-tee', 'whole', 'auto'),
}
CLEAR = {'watters-creek': [(.93,0,1,1)], 'avery-ranch': [(.94,0,1,1)], 'texas-star': [(0,0,.4,.14),(.6,0,1,.14)], 'hawks-creek': [(0,.72,.28,1)]}
def bands(prof, gapfrac=.03, minink=.004):
    on = prof > minink * prof.max(); n = len(prof); gap = max(2, int(n * gapfrac)); out = []; i = 0
    while i < n:
        if not on[i]: i += 1; continue
        j = i; last = i
        while j < n and (on[j] or j - last <= gap):
            if on[j]: last = j
            j += 1
        out.append((i, last + 1)); i = j
    return out
def trim(m):
    ys, xs = np.where(m > .08)
    if not len(xs): return m
    return m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def emblem(slug):
    f, rule, mode = SPEC[slug]
    if not f: return None
    m = ink(P + f + '.png', mode); nz = m[m > .04]
    if len(nz): m = (m / np.percentile(nz, 95)).clip(0, 1)
    m = trim(m); h, w = m.shape
    if rule == 'top': b = bands(m.sum(1)); m = m[b[0][0]:b[0][1]]
    elif rule == 'left': b = bands(m.sum(0)); m = m[:, b[0][0]:b[0][1]]
    elif rule == 'right': b = bands(m.sum(0)); m = m[:, b[-1][0]:b[-1][1]]
    elif isinstance(rule, tuple): x0, y0, x1, y1 = rule; m = m[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)]
    for (x0, y0, x1, y1) in CLEAR.get(slug, []): hh, ww = m.shape; m[int(y0*hh):int(y1*hh), int(x0*ww):int(x1*ww)] = 0
    m = trim(m); nz = m[m > .08]
    if len(nz): m = (m / np.percentile(nz, 90)).clip(0, 1)
    return m
if __name__ == '__main__':
    os.makedirs('emb', exist_ok=True); font = ImageFont.load_default(); tiles = []
    for slug in SPEC:
        m = emblem(slug)
        if m is None: tiles.append((slug, None)); continue
        h, w = m.shape; k = 240 / max(h, w)
        im = Image.fromarray((m * 255).astype('uint8')).resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
        Image.merge('RGBA', [Image.new('L', im.size, 0)] * 3 + [im]).save(f'emb/{slug}.png', optimize=True); tiles.append((slug, im))
    cols, size = 8, 160; rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * size, rows * size), (0, 0, 0))
    for i, (slug, im) in enumerate(tiles):
        t = Image.new('RGB', (size - 4, size - 4), (40, 44, 52)); d = ImageDraw.Draw(t); d.text((3, 2), slug[:24], fill=(255, 200, 80), font=font)
        if im: s = im.copy(); s.thumbnail((size - 14, size - 28)); t.paste(Image.new('RGB', s.size, (245, 245, 245)), ((size - 4 - s.size[0]) // 2, 20), s)
        else: d.text((40, 70), 'NO EMBLEM', fill=(200, 80, 80), font=font)
        sheet.paste(t, ((i % cols) * size, (i // cols) * size))
    sheet.save('emb-sheet.png'); print(len(tiles))
