// The analysis, mounted into the shell: a file the shell brings in is read as a TIFF stack, turned into
// volumes and shown in the 3D viewer, with its vessel model beside it and its items on cards; a dropped
// model file goes to the model.
import { openTiff, TiffError } from './tiff.js';
import { buildVolumes, binFor } from './stack.js';
import * as shell from './shell.js';
import { show, maxTextureSide } from './viewer.js';
import * as model from './modelview.js';
import * as items from './items.js';

async function open(name, bytes) {
  try {
    const side = maxTextureSide();
    shell.busy(`Reading ${name}…`, 0);
    const stack = openTiff(bytes);
    if (stack.slices < 2) throw new TiffError('it holds a single plane, not a stack of slices');
    if (stack.slices > side) throw new TiffError(`it has ${stack.slices} slices; this browser draws at most ${side}`);
    const bin = binFor(stack.width, stack.height, Math.min(640, side));
    const { meta, vols } = await buildVolumes(stack, { bin, onProgress: (done, total) =>
      shell.busy(`Reading ${name}: ${done} of ${total} planes`, done / total) });
    shell.opened();
    document.title = `${name} · 3D MicroViewer`;
    const [Z, Y, X] = meta.shape;
    shell.statusBar(name, `<b>${X} × ${Y}</b> px · <b>${Z}</b> slices`);
    show(name, meta, vols);
    model.stackOpened(name);
    shell.done();
  } catch (err) {
    if (!(err instanceof TiffError)) console.error(err);
    shell.failed(err instanceof TiffError ? `Could not read this file: ${err.message}.` : `Could not open the stack: ${err.message || err}`);
  }
}

shell.mount({
  open,
  dropped(f) { if (!/\.json$/i.test(f.name)) return false; model.openFile(f); return true; },
  shown(view) { items.visibleNow(view === 'items'); },
});
model.init();
items.init(() => shell.showView('3d'));
try { maxTextureSide(); } catch (err) { shell.unavailable(err.message); }
