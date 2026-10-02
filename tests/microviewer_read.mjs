// Prints what the 3D MicroViewer's reader makes of a TIFF, for tests/test_microviewer_tiff.py:
// the layout it found and, per channel, every plane's samples and the 8-bit volume; or why it refused.
import { readFileSync } from 'node:fs';
import { openTiff, TiffError } from '../microviewer/tiff.js';
import { buildVolumes } from '../microviewer/stack.js';

const b = readFileSync(process.argv[2]);
let s;
try { s = openTiff(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch (err) {
  if (!(err instanceof TiffError)) throw err;
  console.log(JSON.stringify({ refused: err.message }));
  process.exit(0);
}
const planes = [];
for (let c = 0; c < s.channels; c++) for (let z = 0; z < s.slices; z++) planes.push(Array.from(await s.page(c, z)));
const { meta, vols } = await buildVolumes(s, { bin: +(process.argv[3] || 1) });
console.log(JSON.stringify({ width: s.width, height: s.height, channels: s.channels, slices: s.slices, frames: s.frames,
  umPerPx: s.umPerPx, zStep: s.zStep, layout: s.layout, names: s.names, planes, meta, vols: vols.map((v) => Array.from(v)) }));
