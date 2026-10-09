// Reads a multi-page TIFF z-stack into its pages and the facts it records about itself: how the pages
// split into channels and slices (ImageJ hyperstack or OME-XML description; otherwise every page is a
// slice), the pixel size and the slice spacing. Strips only, uncompressed, LZW, Deflate or PackBits,
// 8/16/32-bit samples; anything else is refused with a message naming what the file uses.

const TAG = {
  256: 'width', 257: 'height', 258: 'bits', 259: 'compression', 262: 'photometric', 270: 'description',
  273: 'stripOffsets', 277: 'spp', 278: 'rowsPerStrip', 279: 'stripByteCounts', 282: 'xRes', 284: 'planar',
  296: 'resUnit', 317: 'predictor', 322: 'tileWidth', 339: 'sampleFormat',
};
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
const COMPRESSION = { 1: 'none', 5: 'lzw', 8: 'deflate', 32946: 'deflate', 32773: 'packbits' };

export class TiffError extends Error {}

function readIfds(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < 8) throw new TiffError('the file is too short to be a TIFF');
  const order = dv.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) throw new TiffError('this is not a TIFF file');
  const le = order === 0x4949, u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le);
  const magic = u16(2);
  if (magic === 43) throw new TiffError('BigTIFF files (over 4 GB) are not supported yet');
  if (magic !== 42) throw new TiffError('this is not a TIFF file');
  const ifds = [], seen = new Set();
  for (let off = u32(4); off && !seen.has(off); ) {
    if (off + 2 > buf.byteLength) throw new TiffError('the file is cut short: a page header lies past its end');
    seen.add(off);
    const n = u16(off), t = {};
    for (let e = 0; e < n; e++) {
      const at = off + 2 + 12 * e, name = TAG[u16(at)];
      if (!name) continue;
      const type = u16(at + 2), count = u32(at + 4), size = (TYPE_SIZE[type] || 1) * count;
      const where = size <= 4 ? at + 8 : u32(at + 8);
      if (where + size > buf.byteLength) throw new TiffError('the file is cut short: a page header points past its end');
      if (type === 2) { t[name] = new TextDecoder('latin1').decode(new Uint8Array(buf, where, Math.max(count - 1, 0))); continue; }
      const read = (k) => type === 3 ? u16(where + 2 * k) : type === 4 ? u32(where + 4 * k)
        : type === 5 ? u32(where + 8 * k) / (u32(where + 8 * k + 4) || 1) : dv.getUint8(where + k);
      t[name] = Array.from({ length: count }, (_, k) => read(k));
    }
    ifds.push(t);
    off = u32(off + 2 + 12 * n);
  }
  return { le, ifds };
}

// ImageJ writes "key=value" lines; OME writes XML. Both say how pages map to channels and slices.
function layoutFrom(desc, pages, spp) {
  const out = { channels: spp, slices: pages, frames: 1, order: 'czt', zStep: null, umPerPx: null, names: null, source: 'pages' };
  if (/^ImageJ=/.test(desc)) {
    const kv = Object.fromEntries(desc.split('\n').map((l) => l.split('=')).filter((p) => p.length === 2));
    const c = +kv.channels || 1, z = +kv.slices || 1, t = +kv.frames || 1;
    if (c * z * t === pages) Object.assign(out, { channels: c * spp, slices: z, frames: t, source: 'ImageJ' });
    else if (c === 1 && t === 1) out.source = 'ImageJ';
    if (+kv.spacing > 0) out.zStep = +kv.spacing;
    out.unit = kv.unit;
    return out;
  }
  const px = /<(?:\w+:)?Pixels\b([^>]*)>/.exec(desc);
  if (px) {
    const at = (k) => { const m = new RegExp(`\\b${k}="([^"]*)"`).exec(px[1]); return m ? m[1] : null; };
    const c = +at('SizeC') || 1, z = +at('SizeZ') || 1, t = +at('SizeT') || 1;
    const order = (at('DimensionOrder') || 'XYCZT').slice(2).toLowerCase();
    if (c * z * t === pages * spp || c * z * t === pages) {
      Object.assign(out, { channels: c, slices: z, frames: t, order, source: 'OME' });
    }
    const um = (v, u) => v == null ? null : +v * ({ nm: 1e-3, 'µm': 1, um: 1, mm: 1e3 }[u || 'µm'] ?? NaN);
    const x = um(at('PhysicalSizeX'), at('PhysicalSizeXUnit')), zz = um(at('PhysicalSizeZ'), at('PhysicalSizeZUnit'));
    if (x > 0) out.umPerPx = x;
    if (zz > 0) out.zStep = zz;
    const names = [...desc.matchAll(/<(?:\w+:)?Channel\b[^>]*\bName="([^"]*)"/g)].map((m) => m[1]);
    if (names.length === out.channels) out.names = names;
  }
  return out;
}

const MICRONS_PER = { micron: 1, um: 1, 'µm': 1, 'µm': 1, nm: 1e-3, mm: 1e3, cm: 1e4 };

// Opens the stack: {width, height, channels, slices, frames, bits, umPerPx, zStep, names, layout, page(c, z)}.
// page(c, z) decodes one plane of the first time point to a typed array of width*height samples.
export function openTiff(buf) {
  const { le, ifds } = readIfds(buf);
  if (!ifds.length) throw new TiffError('the TIFF holds no pages');
  const first = ifds[0];
  const width = first.width?.[0], height = first.height?.[0], spp = first.spp?.[0] ?? 1, bits = first.bits?.[0] ?? 1;
  const fmt = first.sampleFormat?.[0] ?? 1;
  if (first.tileWidth) throw new TiffError('tiled TIFFs are not supported yet; save the stack with strips (ImageJ and Fiji do)');
  if (![8, 16, 32].includes(bits)) throw new TiffError(`${bits}-bit samples are not supported`);
  if (bits === 32 && fmt !== 3 && fmt !== 1) throw new TiffError('32-bit signed samples are not supported');
  if (spp > 1 && (first.planar?.[0] ?? 1) !== 1) throw new TiffError('planar multi-sample TIFFs are not supported');
  const comp = COMPRESSION[first.compression?.[0] ?? 1];
  if (!comp) throw new TiffError(`the TIFF uses compression ${first.compression[0]}, which is not supported (uncompressed, LZW, Deflate and PackBits are)`);
  // ImageJ hyperstacks over 4 GB, and some writers, give only the first page a header: the rest follow it
  let pages = ifds.filter((t) => t.width?.[0] === width && t.height?.[0] === height);
  const L = layoutFrom(first.description || '', pages.length, spp);
  const ijImages = /^ImageJ=/.test(first.description || '') && +((/\bimages=(\d+)/.exec(first.description) || [])[1]);
  if (ijImages > pages.length && comp === 'none' && first.stripOffsets) {
    const plane = width * height * spp * bits / 8, start = first.stripOffsets[0];
    if (start + ijImages * plane <= buf.byteLength) {
      pages = Array.from({ length: ijImages }, (_, i) => ({ ...first, stripOffsets: [start + i * plane], stripByteCounts: [plane], rowsPerStrip: [height] }));
      Object.assign(L, layoutFrom(first.description, pages.length, spp));
    }
  }
  let umPerPx = L.umPerPx;
  if (umPerPx == null && first.xRes?.[0] > 0) {
    const unit = L.unit ?? ({ 3: 'cm' }[first.resUnit?.[0]] ?? null);
    const per = unit && MICRONS_PER[unit.replace(/\\u00B5/i, 'µ')];
    if (per) umPerPx = per / first.xRes[0];
  }
  const C = L.channels, Z = L.slices, perChannel = spp > 1 ? 1 : C;
  // the page holding channel c of slice z at the first time point, in the stack's own dimension order
  const pageIndex = (c, z) => {
    const cc = spp > 1 ? 0 : c;
    return L.order.startsWith('zc') ? cc * Z + z : z * perChannel + cc;
  };
  const decode = (t) => decodePage(buf, le, t, { width, height, spp, bits, fmt, comp });
  let cache = { i: -1, data: null };
  async function page(c, z) {
    const i = pageIndex(c, z);
    if (cache.i !== i) cache = { i, data: await decode(pages[i]) };
    if (spp === 1) return cache.data;
    const n = width * height, out = new cache.data.constructor(n);
    for (let k = 0; k < n; k++) out[k] = cache.data[k * spp + c];
    return out;
  }
  return { width, height, channels: C, slices: Z, frames: L.frames, bits, umPerPx, zStep: L.zStep,
    names: L.names, layout: L.source, compression: comp, page };
}

async function decodePage(buf, le, t, { width, height, spp, bits, fmt, comp }) {
  const bps = bits / 8, rowBytes = width * spp * bps, total = rowBytes * height;
  const offs = t.stripOffsets, counts = t.stripByteCounts || [total];
  if (!offs) throw new TiffError('a page has no image data');
  const rowsPer = Math.min(t.rowsPerStrip?.[0] ?? height, height);
  const raw = new Uint8Array(total);
  for (let s = 0, at = 0; s < offs.length && at < total; s++) {
    if (offs[s] + counts[s] > buf.byteLength) throw new TiffError('the file is cut short: a page lies past its end');
    const src = new Uint8Array(buf, offs[s], counts[s]);
    const want = Math.min(rowsPer * rowBytes, total - at);
    const bytes = comp === 'none' ? src : comp === 'lzw' ? lzw(src, want) : comp === 'packbits' ? packbits(src, want) : await inflate(src);
    raw.set(bytes.subarray(0, Math.min(want, bytes.length)), at);
    at += want;
  }
  const pred = t.predictor?.[0] ?? 1;
  if (pred === 3) throw new TiffError('floating-point prediction is not supported');
  const samples = width * height * spp;
  let out;
  if (bits === 8) out = raw;
  else {
    const dv = new DataView(raw.buffer);
    out = bits === 16 ? new Uint16Array(samples) : fmt === 3 ? new Float32Array(samples) : new Uint32Array(samples);
    const get = bits === 16 ? (k) => dv.getUint16(2 * k, le) : fmt === 3 ? (k) => dv.getFloat32(4 * k, le) : (k) => dv.getUint32(4 * k, le);
    for (let k = 0; k < samples; k++) out[k] = get(k);
  }
  if (pred === 2) {
    const row = width * spp;
    for (let y = 0; y < height; y++) for (let k = y * row + spp; k < (y + 1) * row; k++) out[k] = out[k] + out[k - spp];
  }
  return out;
}

async function inflate(src) {
  const ds = new Blob([src]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(ds).arrayBuffer());
}

function packbits(src, want) {
  const out = new Uint8Array(want);
  let i = 0, o = 0;
  while (i < src.length && o < want) {
    const n = (src[i++] << 24) >> 24;
    if (n >= 0) { out.set(src.subarray(i, i + n + 1).subarray(0, want - o), o); o += n + 1; i += n + 1; }
    else if (n !== -128) { out.fill(src[i++], o, Math.min(o + 1 - n, want)); o += 1 - n; }
  }
  return out;
}

// TIFF's LZW: codes read most-significant bit first, widening one code early
function lzw(src, want) {
  const out = new Uint8Array(want), prefix = new Int32Array(4096), suffix = new Uint8Array(4096), len = new Int32Array(4096);
  for (let k = 0; k < 256; k++) { prefix[k] = -1; suffix[k] = k; len[k] = 1; }
  let o = 0, bitPos = 0, width = 9, next = 258, prev = -1;
  const read = () => {
    let v = 0;
    for (let k = 0; k < width; k++) {
      const byte = bitPos >> 3;
      v = (v << 1) | (byte < src.length ? (src[byte] >> (7 - (bitPos & 7))) & 1 : 0);
      bitPos++;
    }
    return v;
  };
  const emit = (code) => {
    const n = len[code], end = o + n;
    for (let c = code, p = end - 1; c >= 0; c = prefix[c], p--) if (p < want) out[p] = suffix[c];
    o = end;
  };
  const first = (code) => { while (prefix[code] >= 0) code = prefix[code]; return suffix[code]; };
  while (o < want && (bitPos + width) <= src.length * 8) {
    const code = read();
    if (code === 257) break;
    if (code === 256) { width = 9; next = 258; prev = -1; continue; }
    if (prev < 0) { emit(code); prev = code; continue; }
    if (code < next) {
      emit(code);
      if (next < 4096) { prefix[next] = prev; suffix[next] = first(code); len[next] = len[prev] + 1; next++; }
    } else {
      if (next < 4096) { prefix[next] = prev; suffix[next] = first(prev); len[next] = len[prev] + 1; next++; }
      emit(code);
    }
    prev = code;
    if (next + 1 >= 1 << width && width < 12) width++;
  }
  return out;
}
