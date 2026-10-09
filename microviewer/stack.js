// Turns an opened TIFF stack into what the viewer draws: one 8-bit volume per channel, binned in x-y
// to fit the GPU, each scaled by one brightness window over the whole stack, never per slice, so
// signal that fades with depth still looks faded. The same scaling as analysis/export_stack_view.py.

const WINDOW_PCT = [0.5, 99.9];
// GPU budget, not a property of the data: the ray-caster samples every voxel a ray crosses, so a
// side much past this turns rotation into a slideshow on a laptop.
const MAX_SIDE = 640;

export const binFor = (width, height, maxSide = MAX_SIDE) => Math.max(1, Math.ceil(Math.max(width, height) / maxSide));

// onProgress(done, total) after each plane read; resolves to {meta, vols} where vols[c] is a
// Uint8Array of Z*Y*X voxels, slice by slice
export async function buildVolumes(stack, { bin = binFor(stack.width, stack.height), onProgress } = {}) {
  const { width: W, height: H, channels: C, slices: Z } = stack;
  const X = Math.floor(W / bin), Y = Math.floor(H / bin), n = X * Y, k = 1 / (bin * bin);
  const meta = {
    shape: [Z, Y, X], bin, channels: [],
    um_per_px: stack.umPerPx ? stack.umPerPx * bin : null,
    z_step_um: stack.zStep, frames: stack.frames, layout: stack.layout, bits: stack.bits,
  };
  const vols = [];
  for (let c = 0; c < C; c++) {
    const f = new Float32Array(Z * n);
    for (let z = 0; z < Z; z++) {
      const src = await stack.page(c, z), dst = z * n;
      for (let y = 0; y < Y * bin; y++) {
        const row = y * W, out = dst + Math.floor(y / bin) * X;
        for (let x = 0; x < X * bin; x++) f[out + Math.floor(x / bin)] += src[row + x];
      }
      if (bin > 1) for (let i = dst; i < dst + n; i++) f[i] *= k;
      if (onProgress) onProgress(c * Z + z + 1, C * Z);
      await new Promise((r) => setTimeout(r, 0));
    }
    const [lo, hi] = percentiles(f, WINDOW_PCT);
    const u8 = new Uint8Array(f.length), s = 255 / Math.max(hi - lo, 1e-9);
    for (let i = 0; i < f.length; i++) u8[i] = Math.min(Math.max((f[i] - lo) * s, 0), 255);
    vols.push(u8);
    const p50 = [], p99 = [];
    for (let z = 0; z < Z; z++) {
      const [a, b] = percentiles(u8.subarray(z * n, (z + 1) * n), [50, 99]);
      p50.push(Math.round(a * 10) / 10); p99.push(Math.round(b * 10) / 10);
    }
    meta.channels.push({ name: stack.names ? stack.names[c] : `Channel ${c + 1}`, window_raw: [lo, hi], slice_p50: p50, slice_p99: p99 });
  }
  return { meta, vols };
}

// linear-interpolated percentiles, as numpy's default, from a fine histogram rather than a sort
export function percentiles(a, pcts) {
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < a.length; i++) { const v = a[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (!(mx > mn)) return pcts.map(() => mn);
  const B = 1 << 16, hist = new Uint32Array(B), s = (B - 1) / (mx - mn);
  for (let i = 0; i < a.length; i++) hist[Math.round((a[i] - mn) * s)]++;
  return pcts.map((p) => {
    const rank = (p / 100) * (a.length - 1), lo = Math.floor(rank), frac = rank - lo;
    let seen = 0, b = 0;
    for (; b < B; b++) { seen += hist[b]; if (seen > lo) break; }
    let v = mn + b / s;
    if (frac > 0 && seen <= lo + 1) { let b2 = b + 1; while (b2 < B && !hist[b2]) b2++; if (b2 < B) v += frac * (b2 - b) / s; }
    return v;
  });
}
