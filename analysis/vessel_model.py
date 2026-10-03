#!/usr/bin/env python3
"""Draft a straight-line vessel model of a whole CD31 stack, for the owner to correct in the viewer.

The model is a few hundred KB of JSON instead of a stack of pictures: points in 3D joined by straight
segments, with the same number of slices as the stack it was drawn from. It is a DRAFT answer key:
the owner checks it against the stack in the 3D MicroViewer (side by side or overlaid), corrects it
there, and only the corrected model is ground truth.

    python3 analysis/vessel_model.py STACK.tif OUT.json [--channel N]

Reads a single-channel stack (the CD31-only trimmed files) or the two-channel originals (CD31 is
channel 1 there, data/README.md).

Tracing is the owner's chosen "flat plus depth": each slice is put in its own noise units, the slices
are flattened, the flat picture is thresholded and skeletonised, and every centerline point takes
the depth (in slices) where its signal sits. Each traced vessel is then cut into the fewest straight
segments that stay within half its own width of the centerline.
"""
import argparse, json, os
import numpy as np
import tifffile
from scipy import ndimage as ndi
from skimage.filters import apply_hysteresis_threshold
from skimage.morphology import skeletonize, remove_small_objects

# Every constant is in noise units, µm read off the file, or multiples of the vessel's own width.
BACKGROUND_UM = 11.0   # haze varies over tens of µm; capillaries are ~2-6 µm wide (Stefanitsch digest)
SMOOTH_UM = 0.55       # about the lateral resolution of a 20x objective
SEED_SIGMA, GROW_SIGMA = 5.0, 2.5   # hysteresis, in each slice's own robust noise units
SIGNAL_OVER_NOISE = 1.5             # a slice counts only if its top 0.1% beats pure noise (3.09 sigma) by this
MIN_OBJECT_UM2 = 20.0  # flattened specks; Rust et al. 2020 drop objects below the same area
SPUR_WIDTHS = 2.0      # a side branch shorter than 2 parent widths is a wall bump (Murray floor 1.29, analysis/3D-STACKS.md)
ISLAND_WIDTHS = 4.0    # a lone piece shorter than 4 of its own widths is a speck
NETWORK_WIDTHS = 10.0  # a connected piece whose vessels add up to less than 10 widths is noise, not network
STRAIGHT_WIDTHS = 0.5  # a segment may stray from the centerline by half the vessel's width
DEPTH_SMOOTH_WIDTHS = 2.0  # the per-pixel depth is noisy on faint vessels: median along the path over this span

FORMAT = 'vessel-model/1'
ABOUT = ('status: draft as drawn by analysis/vessel_model.py, or corrected once the owner has edited it in the '
         '3D MicroViewer; a draft is not ground truth. '
         'nodes: id, x and y in µm from the top-left corner of the image, z in slices (0 = the middle of the first '
         'slice; the spacing between slices is not recorded in the file). segments: straight lines between two '
         'node ids. Points where two segments meet are bends along one vessel; three or more, a junction.')


def read_cd31(path, channel):
    with tifffile.TiffFile(path) as tf:
        s = tf.series[0]
        a = s.asarray()
        axes = s.axes
        page = tf.pages[0]
        xres = page.tags.get('XResolution')
        ij = tf.imagej_metadata or {}
    if axes == 'ZCYX':
        a = a[:, 1 if channel is None else channel]
    elif axes != 'ZYX':
        raise SystemExit(f'unexpected layout {axes} {a.shape}')
    um = xres.value[1] / xres.value[0] if xres and ij.get('unit') in ('micron', 'um', 'µm') else None
    if not um:
        raise SystemExit('the file records no pixel size in µm')
    return a.astype(np.float32), um, ij.get('spacing')


def noise_units(vol, um):
    """Each slice with its background removed, in its own robust noise units; slices with no signal
    above noise are zeroed (the signal fades with depth, so one stack-wide scale would not do)."""
    r = vol - ndi.gaussian_filter(vol, (0, BACKGROUND_UM / um, BACKGROUND_UM / um))
    r = ndi.gaussian_filter(r, (0, SMOOTH_UM / um, SMOOTH_UM / um))
    dev = np.abs(r - np.median(r, axis=(1, 2), keepdims=True))
    z = r / (1.4826 * np.median(dev, axis=(1, 2), keepdims=True) + 1e-9)
    keep = np.percentile(z, 99.9, axis=(1, 2)) >= SIGNAL_OVER_NOISE * 3.09
    return np.where(keep[:, None, None], z, 0), keep


def segment(z, keep, um):
    """The flattened mask, its skeleton, the distance map in px, and the depth (slices) of each pixel."""
    mask = apply_hysteresis_threshold(z[keep].max(axis=0), GROW_SIGMA, SEED_SIGMA)
    mask = ndi.binary_closing(mask, np.ones((3, 3)))
    mask = remove_small_objects(mask, max_size=int(MIN_OBJECT_UM2 / um ** 2))
    zk = ndi.gaussian_filter(z[keep], (0, 2 * SMOOTH_UM / um, 2 * SMOOTH_UM / um))
    w = np.clip(zk - GROW_SIGMA, 0, None)
    slices = np.flatnonzero(keep)
    # where the blurred signal clears the growth level nowhere, the brightest slice stands in
    depth = np.where(w.sum(0) > 0, (w * slices[:, None, None]).sum(0) / (w.sum(0) + 1e-9), slices[zk.argmax(0)])
    return skeletonize(mask), ndi.distance_transform_edt(mask), depth


NB = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]


def skeleton_graph(skel):
    """2D skeleton -> node positions (px, y x) and edges as pixel paths between node ids."""
    count = ndi.convolve(skel.astype(np.uint8), np.array([[1, 1, 1], [1, 0, 1], [1, 1, 1]]), mode='constant') * skel
    node_px = skel & (count != 2)
    lab, n = ndi.label(node_px, np.ones((3, 3)))
    H, W = skel.shape
    on = lambda y, x: 0 <= y < H and 0 <= x < W and skel[y, x]
    edges, seen = [], set()
    for sy, sx in zip(*np.nonzero(node_px)):
        for dy, dx in NB:
            y, x = sy + dy, sx + dx
            if not on(y, x) or node_px[y, x]:
                continue
            path, prev = [(sy, sx), (y, x)], (sy, sx)
            while not node_px[path[-1]]:
                cy, cx = path[-1]
                nxt = [(cy + a, cx + b) for a, b in NB if on(cy + a, cx + b) and (cy + a, cx + b) not in path[-3:]]
                if not nxt:
                    break
                # prefer stepping onto a node, then orthogonal steps, so paths do not cut corners off each other
                nxt.sort(key=lambda p: (not node_px[p], abs(p[0] - cy) + abs(p[1] - cx)))
                prev, _ = path[-1], path.append(nxt[0])
            key = (min(path[1], path[-2]), max(path[1], path[-2]), len(path))
            if key in seen:
                continue
            seen.add(key)
            end = int(lab[path[-1]]) if node_px[path[-1]] else 0
            edges.append([int(lab[sy, sx]), end, np.array(path)])
    cent = ndi.center_of_mass(node_px, lab, range(1, n + 1))
    return {i: np.array(c) for i, c in enumerate(cent, 1)}, edges


def plen(p):
    return float(np.linalg.norm(np.diff(p, axis=0), axis=1).sum())


def clean(pos, edges, dist):
    """Drop wall bumps and specks, then join edges through points where only two meet."""
    E = dict(enumerate(edges))
    nid = max(pos, default=0)
    for j, (a, b, p) in E.items():   # a trace that ran round a loop ends on no node
        if b == 0:
            nid += 1; pos[nid] = p[-1].astype(float); E[j][1] = nid

    def degrees():
        d = {}
        for a, b, _ in E.values():
            d[a] = d.get(a, 0) + 1; d[b] = d.get(b, 0) + 1
        return d

    def join_pass_through():
        while True:
            for n in [n for n, d in degrees().items() if d == 2]:
                es = [k for k, (a, b, _) in E.items() if n in (a, b)]
                if len(es) != 2 or es[0] == es[1]:
                    continue
                (a1, b1, p1), (a2, b2, p2) = E[es[0]], E[es[1]]
                if b1 != n: a1, b1, p1 = b1, a1, p1[::-1]
                if a2 != n: a2, b2, p2 = b2, a2, p2[::-1]
                E[es[0]] = [a1, b2, np.concatenate([p1, p2[1:]])]; del E[es[1]]
                break
            else:
                return

    width = lambda p: 2 * float(dist[p[:, 0], p[:, 1]].mean())
    changed = True
    while changed:
        changed = False
        join_pass_through()
        deg = degrees()
        spurs = {}   # only the shortest spur per junction goes per pass, so a vessel's last stretch survives its bump
        for j, (a, b, p) in list(E.items()):
            L = plen(p)
            if a == b and L < 4 * max(width(p), 1):
                del E[j]; changed = True; continue
            ends = (deg[a] == 1) + (deg[b] == 1)
            if ends == 2 and L < ISLAND_WIDTHS * max(width(p), 1):
                del E[j]; changed = True; continue
            if ends == 1 and a != b:
                junc = a if deg[b] == 1 else b
                parent = [width(q) for k, (c, d, q) in E.items() if k != j and junc in (c, d)]
                if parent and L < SPUR_WIDTHS * max(float(np.median(parent)), 1):
                    if junc not in spurs or L < spurs[junc][1]:
                        spurs[junc] = (j, L)
        for j, _ in spurs.values():
            del E[j]; changed = True
        # two short paths between the same two junctions are one vessel the skeleton split around a hole
        pairs = {}
        for j, (a, b, p) in E.items():
            if a != b:
                pairs.setdefault((min(a, b), max(a, b)), []).append(j)
        for js in pairs.values():
            if len(js) > 1:
                short = min(js, key=lambda j: plen(E[j][2]))
                if plen(E[short][2]) < ISLAND_WIDTHS * max(width(E[short][2]), 1):
                    del E[short]; changed = True
    join_pass_through()
    root = {}
    def find(n):
        while root.get(n, n) != n:
            n = root[n]
        return n
    for a, b, _ in E.values():
        root[find(a)] = find(b)
    total, wsum = {}, {}
    for a, b, p in E.values():
        r = find(a); L = plen(p)
        total[r] = total.get(r, 0) + L; wsum[r] = wsum.get(r, 0) + L * width(p)
    return [e for e in E.values() if total[find(e[0])] >= NETWORK_WIDTHS * max(wsum[find(e[0])] / max(total[find(e[0])], 1e-9), 1)]


def straighten(p, tol):
    """Indices of the fewest points of path p (N, 3) whose straight segments stay within tol of it."""
    keep = {0, len(p) - 1}
    stack = [(0, len(p) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        a, b = p[i], p[j]
        ab = b - a
        t = np.clip(((p[i + 1:j] - a) @ ab) / max(ab @ ab, 1e-12), 0, 1)
        d = np.linalg.norm(p[i + 1:j] - (a + t[:, None] * ab), axis=1)
        k = int(np.argmax(d))
        if d[k] > tol:
            m = i + 1 + k
            keep.add(m); stack += [(i, m), (m, j)]
    return sorted(keep)


def model(vol, um, source, z_step):
    z, keep = noise_units(vol, um)
    skel, dist, depth = segment(z, keep, um)
    pos, edges = skeleton_graph(skel)
    edges = clean(pos, edges, dist)
    nodes, segs, ids = [], [], {}

    def node(key, y, x, d):
        if key not in ids:
            ids[key] = len(nodes) + 1
            nodes.append({'id': ids[key], 'x': round((float(x) + .5) * um, 2), 'y': round((float(y) + .5) * um, 2), 'z': round(float(d), 2)})
        return ids[key]

    for ei, (a, b, p) in enumerate(edges):
        w = 2 * float(dist[p[:, 0], p[:, 1]].mean())
        d = depth[p[:, 0], p[:, 1]]
        d = ndi.median_filter(d, size=max(int(DEPTH_SMOOTH_WIDTHS * w) | 1, 3), mode='nearest')
        pts = np.column_stack([p, d * 1.0])
        idx = straighten(pts, max(STRAIGHT_WIDTHS * w, 1.0))
        chain = []
        for k in idx:
            if k == 0:
                chain.append(('n', a))
            elif k == len(p) - 1:
                chain.append(('n', b))
            else:
                chain.append(node(('p', ei, k), p[k, 0], p[k, 1], d[k]))
        out = []
        for c in chain:
            if isinstance(c, tuple):   # a junction or tip sits at the median depth its edges arrive at
                n = c[1]
                arrive = [depth[tuple(q[0] if np.linalg.norm(q[0] - pos[n]) < np.linalg.norm(q[-1] - pos[n]) else q[-1])]
                          for e0, e1, q in edges if n in (e0, e1)]
                out.append(node(('n', n), *pos[n], float(np.median(arrive))))
            else:
                out.append(c)
        segs += [{'a': u, 'b': v} for u, v in zip(out[:-1], out[1:]) if u != v]
    Z, H, W = vol.shape
    return {'format': FORMAT, '_about': ABOUT, 'status': 'draft', 'source': source, 'slices': int(Z), 'size_px': [int(W), int(H)],
            'um_per_px': um, 'z_step_um': z_step, 'nodes': nodes, 'segments': segs}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('stack'); ap.add_argument('out')
    ap.add_argument('--channel', type=int, help='channel index in a multi-channel stack (default: CD31 = 1)')
    a = ap.parse_args()
    vol, um, z_step = read_cd31(a.stack, a.channel)
    m = model(vol, um, os.path.basename(a.stack), z_step)
    with open(a.out, 'w') as f:
        json.dump(m, f, separators=(',', ':'))
    junctions = sum(1 for v in np.bincount([s[k] for s in m['segments'] for k in 'ab']) if v >= 3)
    print(f"{len(m['nodes'])} points, {len(m['segments'])} straight segments, {junctions} junctions, "
          f"{os.path.getsize(a.out) / 1024:.0f} KB")


if __name__ == '__main__':
    main()
