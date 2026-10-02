"""The 3D MicroViewer reads a stack in the browser exactly as tifffile reads it, and scales it exactly as
the exported viewer does (analysis/export_stack_view.py), whatever encoding the TIFF uses.

tifffile writes each case and is the reference reader; the stacks are drawn because what is checked is
decoding, not any detection. Needs node on the PATH.

Run: python3 tests/test_microviewer_tiff.py
"""
import json
import os
import subprocess
import tempfile

import numpy as np
import tifffile

HERE = os.path.dirname(os.path.abspath(__file__))
Z, C, Y, X = 5, 2, 24, 30
UM = 0.55


def drawn(dtype):
    rng = np.random.default_rng(7)
    top = 250 if dtype == np.uint8 else 4000
    a = rng.integers(0, top // 4, (Z, C, Y, X)).astype(dtype)
    for z in range(Z):
        a[z, 1, 10:14, :] = top - 400 // (1 if top > 255 else 20) * z
    return a


def read(path, bin_=1):
    out = subprocess.run(['node', os.path.join(HERE, 'microviewer_read.mjs'), path, str(bin_)],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def u8_reference(vol, b):
    """export_stack_view's bin_xy + to_u8, for one channel (Z, Y, X)."""
    z, y, x = vol.shape
    y, x = y - y % b, x - x % b
    v = vol[:, :y, :x].reshape(z, y // b, b, x // b, b).mean(axis=(2, 4), dtype=np.float32) if b > 1 else vol.astype(np.float32)
    lo, hi = np.percentile(v, (0.5, 99.9))
    return np.clip((v - lo) / max(hi - lo, 1e-9) * 255, 0, 255).astype(np.uint8)


def check(name, a, write, expect_layout, bin_=1, spacing=None):
    """`a` is (Z, C, Y, X) as the file should be read back."""
    Z, C = a.shape[:2]
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, 'stack.tif')
        write(path, a)
        r = read(path, bin_)
    assert (r['channels'], r['slices'], r['height'], r['width']) == (C, Z, Y, X), (name, r['channels'], r['slices'])
    assert r['layout'] == expect_layout, (name, r['layout'])
    assert abs(r['umPerPx'] - UM) < 1e-4, (name, r['umPerPx'])
    assert r['zStep'] == spacing, (name, r['zStep'])
    got = np.array(r['planes']).reshape(C, Z, Y, X)
    assert np.array_equal(got, a.transpose(1, 0, 2, 3)), f'{name}: planes differ from tifffile'
    for c in range(C):
        ref = u8_reference(a[:, c], bin_)
        vol = np.array(r['vols'][c], np.uint8).reshape(ref.shape)
        # the window comes from a histogram, not a sort: allow one grey level
        assert np.abs(vol.astype(int) - ref).max() <= 1, f'{name}: channel {c} volume differs from the export'
    print(f'ok  {name}')


def imagej(**kw):
    return lambda p, a: tifffile.imwrite(p, a, imagej=True, resolution=(1 / UM, 1 / UM),
                                         metadata={'axes': 'ZCYX', 'unit': 'micron', **kw.pop('metadata', {})}, **kw)


def ome(**kw):
    return lambda p, a: tifffile.imwrite(p, a, ome=True, metadata={'axes': 'ZCYX', 'PhysicalSizeX': UM, 'PhysicalSizeY': UM}, **kw)


def pages(compression):
    """Plain pages with no ImageJ or OME description: Pillow compresses them without imagecodecs."""
    def write(p, a):
        from PIL import Image
        ims = [Image.fromarray(page) for page in a[:, 0]]
        ims[0].save(p, save_all=True, append_images=ims[1:], compression=compression, resolution=1e4 / UM, resolution_unit='cm')
    return write


def main():
    a16, a8 = drawn(np.uint16), drawn(np.uint8)
    check('ImageJ 16-bit, uncompressed', a16, imagej(), 'ImageJ')
    check('ImageJ 16-bit, binned 2x', a16, imagej(), 'ImageJ', bin_=2)
    check('ImageJ 8-bit with slice spacing', a8, imagej(metadata={'spacing': 2.5}), 'ImageJ', spacing=2.5)
    check('ImageJ big-endian', a16.astype('>u2'), imagej(byteorder='>'), 'ImageJ')
    check('plain pages, LZW', a8[:, :1], pages('tiff_lzw'), 'pages')
    check('OME, Deflate with prediction', a16, ome(compression='zlib', predictor=True), 'OME')
    check('plain pages, PackBits', a8[:, :1], pages('packbits'), 'pages')


if __name__ == '__main__':
    main()
