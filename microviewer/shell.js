// The page's shell: everything that is not analysis. It loads a file (Load, a drop anywhere, Google
// Drive), shows progress on the busy screen and the status bar, gives notices, and keeps the frame
// around the analysis: the theme, the resizable side bars, the foldable boxes, the view's tabs and the
// version. It knows nothing about stacks or vessels; the analysis mounts with
//
//   mount({ open(name, bytes), dropped(file) -> handled?, shown(view) })
//
// open is handed each file Load or Drive brings in; dropped sees a dropped file first and may take it
// (a model file, say); shown hears which tab the view switched to.
import * as drive from './drive.js';

const $ = (id) => document.getElementById(id);
// the browser keys the shell saves under
const SOURCE = 'mv-load-source', DRIVE_LINK = 'mv-drive-link'; // "local" | "drive"; the last Drive link pasted
const THEME = 'mv-theme'; // "dark" | "light"; absent = follow the system
const BARS = 'mv-bars-v1'; // {left, right}: side bar widths in pixels
export const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* no storage: remembered for this visit only */ } },
};
const readJSON = (k) => { try { return JSON.parse(store.get(k, '{}')) || {}; } catch { return {}; } };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mb = (n) => (n / 1048576).toFixed(1);

let hooks = {};
export let working = false;

// ---------- status, busy screen, notices ----------
export function status(text, err) {
  $('status').textContent = text; $('status').classList.toggle('err', !!err);
}
// the busy screen over the view; frac, when known, fills its bar
export function busy(text, frac) {
  working = true;
  $('busy').hidden = false; $('spin').classList.add('on');
  $('progress-text').textContent = text; status(text);
  $('progress-bar').firstElementChild.style.width = frac == null ? '0' : `${Math.round(frac * 100)}%`;
}
export function done(text = 'Ready') {
  working = false;
  $('busy').hidden = true; $('spin').classList.remove('on'); status(text);
}
export function failed(text) {
  working = false;
  $('busy').hidden = true; $('spin').classList.remove('on'); status(text, true);
  $('empty-msg').textContent = text;
  if ($('empty').hidden) notice(text);
}
export function notice(text) {
  const n = $('notice');
  $('notice-text').textContent = text; n.hidden = false;
  const r = $('view').getBoundingClientRect();
  Object.assign(n.style, { left: `${r.left + (r.width - n.offsetWidth) / 2}px`, top: `${r.top + 60}px` });
  $('notice-ok').focus();
}
$('notice-ok').onclick = () => { $('notice').hidden = true; };
// the footer's file and counts; counts is HTML the caller built with esc
export function statusBar(file, counts) {
  $('sb-file').textContent = file || 'No stack';
  $('sb-counts').innerHTML = counts || '';
}
// the opened file's view replaces the empty one, and the boxes that need it unfold
export function opened() {
  $('empty').hidden = true; $('viewer').hidden = false; $('load').classList.add('done');
  fold(true);
}

// ---------- the view's tabs: each shows its own pane and its own tools ----------
export function showView(v) {
  $('view').dataset.view = v;
  for (const b of document.querySelectorAll('.tabs [data-view]')) {
    const on = b.dataset.view === v;
    b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on));
  }
  for (const p of document.querySelectorAll('.pane')) p.hidden = p.dataset.pane !== v;
  hooks.shown?.(v);
}
for (const b of document.querySelectorAll('.tabs [data-view]')) b.onclick = () => showView(b.dataset.view);

// ---------- boxes that fold: folded until there is a stack ----------
function fold(open) { document.querySelectorAll('.box.foldable').forEach((b) => b.classList.toggle('folded', !open)); }
document.querySelectorAll('.box.foldable > .sec-head h2').forEach((h) => {
  h.tabIndex = 0; h.setAttribute('role', 'button');
  const flip = () => h.closest('.box').classList.toggle('folded');
  h.onclick = flip; h.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
});
fold(false);

// ---------- side bars and theme ----------
// the side bars take the width they are dragged to; a double click puts one back
{
  const lay = $('layout'), saved = readJSON(BARS);
  const set = (side, w) => {
    const prop = side === 'left' ? '--lw' : '--rw';
    if (w == null) lay.style.removeProperty(prop);
    else lay.style.setProperty(prop, `${Math.round(Math.max(200, Math.min(w, innerWidth * 0.4)))}px`);
  };
  set('left', saved.left); set('right', saved.right);
  for (const side of ['left', 'right']) {
    const g = $(`gutter-${side}`);
    g.addEventListener('pointerdown', (e) => {
      g.setPointerCapture(e.pointerId); document.body.classList.add('resizing');
      const move = (ev) => {
        const r = lay.getBoundingClientRect();
        saved[side] = side === 'left' ? ev.clientX - r.left : r.right - ev.clientX; set(side, saved[side]);
      };
      const up = () => {
        g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up);
        document.body.classList.remove('resizing'); store.set(BARS, JSON.stringify(saved));
      };
      g.addEventListener('pointermove', move); g.addEventListener('pointerup', up);
    });
    g.addEventListener('dblclick', () => { delete saved[side]; set(side, null); store.set(BARS, JSON.stringify(saved)); });
  }
}
const theme = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
$('theme').onclick = () => {
  const t = theme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; store.set(THEME, t);
};
// a dropdown closes when the user clicks anywhere else
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.menu[open]').forEach((m) => { if (!m.contains(e.target)) m.open = false; });
});

// ---------- the version ----------
// the release stamps the version into the page; every 5 minutes the page compares it with the one now
// published, and a newer one turns the version box into a refresh button
{
  const VERSION = $('site-version').title.replace(/^version /, ''), v = $('sb-version');
  v.textContent = `v${VERSION}`;
  v.onclick = () => { if (v.classList.contains('stale')) location.reload(); };
  setInterval(async () => {
    try {
      const html = await (await fetch(location.pathname, { cache: 'no-store' })).text();
      const live = (html.match(/id="site-version" title="version ([^"]*)"/) || [])[1];
      if (!live || live === VERSION || v.classList.contains('stale')) return;
      v.classList.add('stale'); v.textContent = `Refresh for v${live}`;
      v.title = `This page is v${VERSION}; v${live} is out. Click to refresh.`;
    } catch { /* offline: try again next time */ }
  }, 5 * 60 * 1000);
}

// ---------- loading: this computer, a drop, or Google Drive ----------
async function openFile(f) {
  if (working || !f) return;
  busy(`Reading ${f.name} (${mb(f.size)} MB)…`);
  try { await hooks.open(f.name, await f.arrayBuffer()); } catch (err) { failed(`Could not open ${f.name}: ${err.message || err}`); }
}
$('file').onchange = (e) => { openFile(e.target.files[0]); e.target.value = ''; };
for (const ev of ['dragenter', 'dragover']) document.addEventListener(ev, (e) => { e.preventDefault(); document.body.classList.add('over'); });
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) document.body.classList.remove('over'); });
document.addEventListener('drop', (e) => {
  e.preventDefault(); document.body.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f && !hooks.dropped?.(f)) openFile(f);
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

// the Drive dialog: a pasted file link loads at once; a folder link lists its stacks and subfolders
{
  const msg = (t, err) => { const m = $('drive-msg'); m.textContent = m.title = t; m.classList.toggle('err', !!err); };
  const sizeText = (n) => (n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${mb(n)} MB`);
  let trail = [];
  const take = async (id, name) => {
    if (working) return;
    msg(`Downloading ${name || 'the stack'}…`);
    let what;
    try {
      const f = await drive.file(id, name, (n) => {
        what = n; $('drive-dlg').close(); msg(''); busy(`Downloading ${n}…`);
      }, (got, total) => busy(`Downloading ${what} · ${mb(got)}${total ? ` of ${mb(total)}` : ''} MB`, total ? got / total : null));
      if (f.folder) { done(); trail = [f]; return list(); }
      await hooks.open(f.name, f.bytes);
    } catch (err) {
      done();
      if (!$('drive-dlg').open) $('drive-dlg').showModal();
      msg(err.message || String(err), true);
    }
  };
  const list = async () => {
    const at = trail[trail.length - 1];
    $('drive-path').innerHTML = trail.map((t, k) => `<button type="button" data-k="${k}">${esc(t.name)}</button>`).join(' / ');
    $('drive-path').querySelectorAll('button').forEach((b) => (b.onclick = () => { trail = trail.slice(0, +b.dataset.k + 1); list(); }));
    $('drive-list').replaceChildren(); msg('Reading the folder…');
    try {
      const items = await drive.list(at.id);
      msg(items.length ? '' : 'No TIFF stacks here.');
      for (const f of items) {
        const b = document.createElement('button'); b.type = 'button'; b.className = `item${f.folder ? ' folder' : ''}`;
        const meta = [f.size == null ? '' : sizeText(f.size),
          f.created ? f.created.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ');
        b.innerHTML = `<span class="name">${esc(f.name)}</span><span class="meta">${esc(meta)}</span>`;
        b.onclick = () => (f.folder ? (trail.push(f), list()) : take(f.id, f.name));
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
    trail = [{ id: ref.id, name: 'Folder' }]; list();
  };
  $('drive-go').onclick = open;
  $('drive-link').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); open(); } });
}

// the shell refuses to load when the analysis cannot run here (no WebGL2, say)
export function unavailable(text) { $('load-main').disabled = true; failed(text); }
export function mount(h) { hooks = h; }
