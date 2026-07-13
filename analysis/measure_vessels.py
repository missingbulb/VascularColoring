#!/usr/bin/env python3
"""First-pass vessel quantification for the gP-CD31 red-channel panels.

Delivers the professor's three asks per image:
  - CATEGORIZE : each vessel as capillary vs penetrating artery, by centerline diameter
  - COUNT      : number of branch segments (junction-to-junction / junction-to-tip pieces)
  - MEASURE    : total centerline length (px, plus a provisional um estimate)

Pipeline: red-dominance segmentation (ignores the white 'A2/B2' panel labels)
-> bridge small gaps -> skeletonize -> prune spurs -> branch graph + width.

Run:  python3 analysis/measure_vessels.py [--overlays]
Prints a per-image table + region rollup; with --overlays also writes annotated
3-view PNGs (original | measure+count | categorize) to analysis/overlays/.

CAVEATS (first pass, figure-resolution crops):
  * um calibration is PROVISIONAL: assumes each panel spans the full 310 um 40x
    confocal field (digest 5). Verify against the 50 um scale bar / raw .oib data
    before quoting absolute lengths.
  * the capillary/artery split is a single diameter threshold; borderline vessels
    flip. Directionally right, not final.
  * some fragmentation survives pruning (short breaks where the stain dims).
"""
import argparse, glob, os, warnings
warnings.filterwarnings('ignore')
import numpy as np
from PIL import Image
from skimage.filters import frangi, threshold_otsu, gaussian
from skimage.morphology import skeletonize, disk
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, '..', 'references', 'figures', 'panels'))
OUT = os.path.join(HERE, 'overlays')

ARTERY_DIAM_PX = 9.0    # branch mean diameter >= this -> penetrating artery/arteriole
FOV_UM = 310.0          # 40x confocal field of view (digest 5); provisional
S8 = np.ones((3, 3), int)
REGIONS = ['ischemic', 'penumbra', 'contralateral', 'normal', 'healthy']


def rm_small(mask, minsz):
    lab, n = ndi.label(mask, structure=S8)
    if n == 0:
        return mask
    sizes = ndi.sum(np.ones_like(lab), lab, range(1, n + 1))
    return np.concatenate([[False], sizes >= minsz])[lab]


def nbrs(skel):
    return ndi.convolve(skel.astype(np.uint8), np.ones((3, 3), int), mode='constant') - skel


def segment(rgb):
    R, G, B = [rgb[..., i].astype(float) for i in range(3)]
    reddom = (R > G + 12) & (R > B + 12)
    inten = np.where(reddom, R, 0) / 255.0
    sm = gaussian(inten, 1.0)
    vals = sm[sm > 0.03]
    t = max(threshold_otsu(vals) if vals.size else 1.0, 0.13)     # floor: no noise in dim fields
    mask_int = sm > t
    fr = frangi(sm, sigmas=range(1, 7), black_ridges=False)
    fr /= (fr.max() + 1e-9)
    fv = fr[fr > 1e-4]
    mask_fr = fr > 0.6 * (threshold_otsu(fv) if fv.size else 1.0)
    mask = (mask_int | mask_fr) & reddom
    mask = ndi.binary_closing(mask, disk(2))                      # bridge <=~4px gaps
    mask = ndi.binary_fill_holes(mask)
    return rm_small(mask, 20)


def prune(skel, min_len=8):
    skel = skel.copy()
    for _ in range(40):
        nb = nbrs(skel)
        junc = skel & (nb >= 3)
        branch_lbl, n = ndi.label(skel & ~junc, structure=S8)
        if n == 0:
            break
        ends = skel & (nb == 1)
        sizes = ndi.sum(np.ones_like(branch_lbl), branch_lbl, range(1, n + 1))
        end_here = ndi.sum(ends, branch_lbl, range(1, n + 1)) > 0
        junc_adj = ndi.sum(ndi.binary_dilation(junc, S8), branch_lbl, range(1, n + 1)) > 0
        removed = False
        for lab in np.where((sizes < min_len) & end_here & junc_adj)[0] + 1:
            skel[branch_lbl == lab] = False
            removed = True
        if not removed:
            break
    return rm_small(skel, 3)


def analyze(rgb):
    h, w = rgb.shape[:2]
    umpp = FOV_UM / ((h + w) / 2.0)
    mask = segment(rgb)
    skel = prune(skeletonize(mask))
    nb = nbrs(skel)
    junc = skel & (nb >= 3)
    ends = skel & (nb == 1)
    branch_lbl, nbr = ndi.label(skel & ~junc, structure=S8)
    diam = 2 * ndi.distance_transform_edt(mask)
    classmap = np.zeros(skel.shape, np.uint8)                      # 1=capillary, 2=artery
    n_cap = n_art = 0
    if nbr:
        for lab, dm in enumerate(ndi.mean(diam, branch_lbl, range(1, nbr + 1)), start=1):
            cls = 2 if dm >= ARTERY_DIAM_PX else 1
            classmap[branch_lbl == lab] = cls
            n_art += cls == 2
            n_cap += cls == 1
    widths = diam[skel]
    m = dict(area=100 * mask.mean(), length_px=int(skel.sum()),
             length_um=round(skel.sum() * umpp, 0),
             segments=nbr, capillary=int(n_cap), artery=int(n_art),
             junctions=int(ndi.label(junc, S8)[1]), vessels=int(ndi.label(mask, S8)[1]),
             wp90=round(float(np.percentile(widths, 90)) if widths.size else 0.0, 1))
    return m, dict(mask=mask, skel=skel, junc=junc, ends=ends, classmap=classmap)


def save_overlay(name, rgb, m, aux):
    from PIL import ImageDraw, ImageFont
    try:
        FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
        FS = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    except OSError:
        FB = FS = ImageFont.load_default()
    UP = 2
    skel, junc, ends, cm = aux['skel'], aux['junc'], aux['ends'], aux['classmap']
    sk = ndi.binary_dilation(skel, iterations=1)
    v_meas = (rgb * 0.26).astype(np.uint8); v_meas[sk] = (255, 235, 40)
    cmd = ndi.grey_dilation(cm, footprint=np.ones((3, 3)))
    v_cat = (rgb * 0.20).astype(np.uint8)
    v_cat[sk & (cmd == 1)] = (0, 200, 255)
    v_cat[sk & (cmd == 2)] = (255, 60, 30)

    def up(a):
        return Image.fromarray(a).resize((a.shape[1] * UP, a.shape[0] * UP), Image.NEAREST)

    v0, v1, v2 = up(rgb), up(v_meas), up(v_cat)
    d1 = ImageDraw.Draw(v1)
    for cond, r, col in [(junc, 4, (255, 0, 255)), (ends, 3, (0, 220, 255))]:
        for y, x in zip(*np.where(cond)):
            d1.ellipse([x * UP - r, y * UP - r, x * UP + r, y * UP + r], fill=col)
    W, H, pad, cap, lab = v0.width, v0.height, 8, 54, 22
    canvas = Image.new('RGB', (W * 3 + pad * 4, H + cap + lab + pad * 2), (18, 18, 18))
    for i, im in enumerate([v0, v1, v2]):
        canvas.paste(im, (pad + i * (W + pad), cap))
    d = ImageDraw.Draw(canvas)
    d.text((pad, 8), name, font=FB, fill=(255, 255, 255))
    d.text((pad, 30), f"length {m['length_px']}px (~{m['length_um']:.0f}um)   segments {m['segments']} "
                      f"(cap {m['capillary']} / artery {m['artery']})   junctions {m['junctions']}   "
                      f"area {m['area']:.1f}%", font=FS, fill=(170, 225, 170))
    for i, t in enumerate(["original",
                           f"MEASURE+COUNT: {m['segments']} segments, {m['junctions']} junctions, {m['length_px']}px",
                           f"CATEGORIZE: capillary(cyan) {m['capillary']} / artery(red) {m['artery']}"]):
        d.text((pad + i * (W + pad), cap + H + 3), t, font=FS, fill=(200, 200, 200))
    os.makedirs(OUT, exist_ok=True)
    canvas.save(os.path.join(OUT, name + '.png'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--overlays', action='store_true', help='also write annotated PNGs to analysis/overlays/')
    args = ap.parse_args()
    rows = []
    hdr = ('panel', 'len_px', 'len_um', 'seg', 'cap', 'art', 'junc', 'area%', 'wp90')
    print(f'{hdr[0]:28s}' + ''.join(f'{h:>7s}' for h in hdr[1:]))
    for fn in sorted(glob.glob(os.path.join(SRC, 'VESSEL_*.png'))):
        rgb = np.asarray(Image.open(fn).convert('RGB'))
        m, aux = analyze(rgb)
        name = os.path.basename(fn).replace('VESSEL_', '').replace('_gP-CD31_red.png', '')
        rows.append((name, m))
        print(f'{name:28s}{m["length_px"]:7d}{m["length_um"]:7.0f}{m["segments"]:7d}{m["capillary"]:7d}'
              f'{m["artery"]:7d}{m["junctions"]:7d}{m["area"]:7.1f}{m["wp90"]:7.1f}')
        if args.overlays:
            save_overlay(name, rgb, m, aux)

    from collections import defaultdict
    agg = defaultdict(lambda: defaultdict(list))
    for name, m in rows:
        for r in REGIONS:
            if r in name:
                for k in ('length_px', 'segments', 'capillary', 'artery', 'area'):
                    agg[r][k].append(m[k])
                break
    print('\nregion means:')
    print(f'{"region":15s}{"len_px":>8s}{"seg":>6s}{"cap":>6s}{"art":>6s}{"area%":>7s}  n')
    for r in REGIONS:
        if agg[r]['length_px']:
            g = agg[r]
            print(f'{r:15s}{np.mean(g["length_px"]):8.0f}{np.mean(g["segments"]):6.0f}'
                  f'{np.mean(g["capillary"]):6.0f}{np.mean(g["artery"]):6.1f}{np.mean(g["area"]):7.1f}'
                  f'  {len(g["length_px"])}')
    if args.overlays:
        print('\noverlays ->', OUT)


if __name__ == '__main__':
    main()
