// Loading: a stack from this computer (the Load button or a drop anywhere on the page) or from Google
// Drive, read in the browser, turned into volumes and handed to the viewer.
import { openTiff, TiffError } from './tiff.js';
import { buildVolumes, binFor } from './stack.js';
import * as drive from './drive.js';
import { show, maxTextureSide } from './viewer.js';
import * as model from './modelview.js';

const $ = (id) => document.getElementById(id);
const SOURCE = 'mv-load-source', DRIVE_LINK = 'mv-drive-link';
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* no storage: remembered for this visit only */ } },
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mb = (n) => (n / 1048576).toFixed(1);

let busy = false;
function progress(text, frac) {
  $('viewer').hidden = true; $('empty').hidden = false; $('empty-msg').textContent = '';
  $('progress').hidden = false; $('progress-text').textContent = text;
  $('progress-bar').firstElementChild.style.width = frac == null ? '0' : `${Math.round(frac * 100)}%`;
}
function failed(err) {
  busy = false;
  $('progress').hidden = true; $('viewer').hidden = true; $('empty').hidden = false;
  $('empty-msg').textContent = err instanceof TiffError ? `Could not read this file: ${err.message}.` : `Could not open the stack: ${err.message || err}`;
  if (!(err instanceof TiffError)) console.error(err);
}

async function openBytes(name, bytes) {
  busy = true;
  try {
    const side = maxTextureSide();
    progress(`Reading ${name}…`, 0);
    const stack = openTiff(bytes);
    if (stack.slices < 2) throw new TiffError('it holds a single plane, not a stack of slices');
    if (stack.slices > side) throw new TiffError(`it has ${stack.slices} slices; this browser draws at most ${side}`);
    const bin = binFor(stack.width, stack.height, Math.min(640, side));
    const { meta, vols } = await buildVolumes(stack, { bin, onProgress: (done, total) =>
      progress(`Reading ${name}: ${done} of ${total} planes`, done / total) });
    $('progress').hidden = true; $('empty').hidden = true; $('viewer').hidden = false;
    document.title = `${name} · 3D MicroViewer`;
    show(name, meta, vols);
    model.stackOpened(name);
    busy = false;
  } catch (err) { failed(err); }
}

async function openFile(f) {
  if (busy || !f) return;
  progress(`Reading ${f.name} (${mb(f.size)} MB)…`, 0);
  try { await openBytes(f.name, await f.arrayBuffer()); } catch (err) { failed(err); }
}

$('file').onchange = (e) => { openFile(e.target.files[0]); e.target.value = ''; };
for (const ev of ['dragenter', 'dragover']) document.addEventListener(ev, (e) => { e.preventDefault(); document.body.classList.add('over'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('over'); });
document.addEventListener('drop', (e) => {
  e.preventDefault(); document.body.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f && /\.json$/i.test(f.name)) model.openFile(f); else openFile(f);
});

function load(src) {
  store.set(SOURCE, src); $('load-menu').open = false;
  if (src === 'local' || !drive.ready) return $('file').click();
  $('drive-link').value = store.get(DRIVE_LINK, '') || drive.defaultLink;
  $('drive-dlg').showModal(); $('drive-link').select();
  if (drive.parse($('drive-link').value)?.kind === 'folder') $('drive-go').click();
}
$('load-main').onclick = () => load(store.get(SOURCE, 'local'));
document.querySelectorAll('#load-menu .item').forEach((b) => (b.onclick = () => load(b.dataset.src)));
document.addEventListener('click', (e) => { if (!$('load-menu').contains(e.target)) $('load-menu').open = false; });

// the Drive dialog: a pasted file link loads at once; a folder link lists its stacks and subfolders
{
  const msg = (t, err) => { const m = $('drive-msg'); m.textContent = m.title = t; m.classList.toggle('err', !!err); };
  const sizeText = (n) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${mb(n)} MB`);
  let trail = [];
  const take = async (id, name) => {
    if (busy) return;
    msg('Downloading ' + (name || 'the stack') + '…');
    let what;
    try {
      const f = await drive.file(id, name, (n) => {
        what = n; busy = true; $('drive-dlg').close(); msg(''); progress(`Downloading ${n}…`, null);
      }, (got, total) => progress(`Downloading ${what} · ${mb(got)}${total ? ' of ' + mb(total) : ''} MB`, total ? got / total : null));
      if (f.folder) { trail = [f]; return show_(); }
      busy = false;
      openBytes(f.name, f.bytes);
    } catch (err) {
      busy = false; $('progress').hidden = true;
      if (!$('drive-dlg').open) $('drive-dlg').showModal();
      msg(err.message || String(err), true);
    }
  };
  const show_ = async () => {
    const at = trail[trail.length - 1];
    $('drive-path').innerHTML = trail.map((t, k) => `<button type="button" data-k="${k}">${esc(t.name)}</button>`).join(' / ');
    $('drive-path').querySelectorAll('button').forEach((b) => (b.onclick = () => { trail = trail.slice(0, +b.dataset.k + 1); show_(); }));
    $('drive-list').replaceChildren(); msg('Reading the folder…');
    try {
      const items = await drive.list(at.id);
      msg(items.length ? '' : 'No TIFF stacks here.');
      for (const f of items) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'item' + (f.folder ? ' folder' : '');
        const meta = [f.size == null ? '' : sizeText(f.size),
          f.created ? f.created.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ');
        b.innerHTML = `<span class="name">${esc(f.name)}</span><span class="meta">${esc(meta)}</span>`;
        b.onclick = () => (f.folder ? (trail.push(f), show_()) : take(f.id, f.name));
        $('drive-list').append(b);
      }
    } catch (err) { msg(err.message || String(err), true); }
  };
  if (!drive.ready) {
    const d = document.querySelector('#load-menu .item[data-src="drive"]');
    d.disabled = true; d.title = 'Needs this site’s Google API key, which has not been set up yet';
    d.textContent = 'From Google Drive (not set up yet)';
  }
  const open = () => {
    const link = $('drive-link').value, ref = drive.parse(link);
    $('drive-list').replaceChildren(); $('drive-path').replaceChildren();
    if (!ref) return msg('That does not look like a Google Drive link.', true);
    store.set(DRIVE_LINK, link);
    if (ref.kind === 'file') return take(ref.id);
    trail = [{ id: ref.id, name: 'Folder' }]; show_();
  };
  $('drive-go').onclick = open;
  $('drive-link').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); open(); } });
}

model.init();
try { maxTextureSide(); } catch (err) {
  $('load-main').disabled = true; $('empty-msg').textContent = err.message;
}
