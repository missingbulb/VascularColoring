// The vessel model beside or over the stack, in the stack's own camera, and the owner's corrections to
// it: drag a point to move it, right-click a segment or a point to delete it or split a junction,
// right-drag from one piece to another to connect them. The corrected model downloads as JSON.
import * as V from './viewer.js';
import * as Mo from './model.js';

const $ = (id) => document.getElementById(id);
const MODELS = 'models/index.json';
const SAVED = 'mv-model:';
const PICK_POINT_PX = 9, PICK_SEGMENT_PX = 6, DRAG_PX = 5;
// The overlay draws the model in magenta: neither the depth colours nor the hot scale of the stack
// carry it, so a line never vanishes into the signal it is laid over.
const OVERLAY = '#ff4fd8';

let model = null, loaded = null, history = [], future = [], edits = 0, savedKey = null;
let mode = 'side', hover = null, rubber = null, drafts = [], stackName = null;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* no storage: edits live until the page closes */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* no storage */ } },
};

// ---------- the model's place in the stack's camera ----------
const slices = () => V.meta.shape[0];
function toWorld(n) {
  const [W, H] = model.size_px, um = model.um_per_px, [hx, hy, hz] = V.half;
  return [hx * (2 * n.x / (W * um) - 1), hy * (1 - 2 * n.y / (H * um)), hz * (1 - 2 * (n.z + .5) / slices())];
}
function fromWorld(p) {
  const [W, H] = model.size_px, um = model.um_per_px, [hx, hy, hz] = V.half, Z = slices();
  const cl = (v, a, b) => Math.min(Math.max(v, a), b);
  return { x: cl((p[0] / hx + 1) / 2 * W * um, 0, W * um), y: cl((1 - p[1] / hy) / 2 * H * um, 0, H * um),
           z: cl((1 - p[2] / hz) / 2 * Z - .5, -.5, Z - .5) };
}

let cv = null, view = null;   // the canvas the model is drawn on, and its last projection
function project() {
  const W = cv.clientWidth, H = cv.clientHeight, vp = V.camera(W / H), pts = new Map();
  for (const n of model.nodes.values()) {
    const v = V.M.xf(vp, toWorld(n));
    if (v[3] > 0) pts.set(n.id, [(v[0] / v[3] + 1) / 2 * W, (1 - v[1] / v[3]) / 2 * H, v[3], v[2] / v[3]]);
  }
  return { vp, W, H, pts };
}
const inSlab = (n) => n.z >= V.S.z0 - .5 && n.z <= V.S.z1 + .5;

function draw() {
  if (!model || mode === 'off' || !V.meta || !cv.clientWidth) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  if (mode === 'side') { c.fillStyle = '#000'; c.fillRect(0, 0, cv.clientWidth, cv.clientHeight); }
  view = project();
  const { pts } = view, Z = slices(), deg = Mo.degrees(model);
  const span = Math.max(V.S.z1 + 1 - V.S.z0, 1);
  const colour = (z) => {
    if (mode === 'overlay') return OVERLAY;
    if (!V.S.depth) return '#4fd1d9';
    const t = V.turbo(((z + .5) - V.S.z0) / span);
    return `rgb(${t.map((v) => Math.round(v * 255)).join(',')})`;
  };
  // far segments first, so nearer vessels draw over the ones they pass in front of
  const order = model.segments.map((s, i) => i).filter((i) => {
    const s = model.segments[i];
    return pts.has(s.a) && pts.has(s.b) && (inSlab(model.nodes.get(s.a)) || inSlab(model.nodes.get(s.b)));
  });
  order.sort((i, j) => (pts.get(model.segments[j].a)[2] + pts.get(model.segments[j].b)[2]) - (pts.get(model.segments[i].a)[2] + pts.get(model.segments[i].b)[2]));
  c.lineCap = 'round';
  for (const i of order) {
    const s = model.segments[i], a = pts.get(s.a), b = pts.get(s.b);
    const hot = hover?.segment === i;
    c.strokeStyle = hot ? '#fff' : colour((model.nodes.get(s.a).z + model.nodes.get(s.b).z) / 2);
    // over the stack the lines stay thin and let the signal under them show through
    c.globalAlpha = mode === 'overlay' && !hot ? .7 : 1;
    c.lineWidth = hot ? 3 : mode === 'overlay' ? 1.1 : 1.5;
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  c.globalAlpha = 1;
  for (const n of model.nodes.values()) {
    const p = pts.get(n.id); if (!p || !inSlab(n)) continue;
    const d = deg.get(n.id) || 0, hot = hover?.node === n.id;
    c.beginPath();
    if (d >= 3) { c.arc(p[0], p[1], hot ? 6 : 4, 0, 2 * Math.PI); c.strokeStyle = hot ? '#fff' : mode === 'overlay' ? OVERLAY : 'rgba(255,255,255,.85)'; c.lineWidth = hot ? 2 : 1.2; c.stroke(); }
    else { c.arc(p[0], p[1], hot ? 4.5 : (d === 1 ? 2.2 : 1.6) * (mode === 'overlay' ? .7 : 1), 0, 2 * Math.PI); c.fillStyle = hot ? '#fff' : colour(n.z); c.fill(); }
  }
  if (rubber) {
    c.setLineDash([5, 4]); c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(...rubber.from); c.lineTo(...rubber.to); c.stroke(); c.setLineDash([]);
  }
  if (Z !== model.slices) {
    c.font = '12px "IBM Plex Mono", monospace'; c.fillStyle = '#e8b04a';
    c.fillText(`model has ${model.slices} slices, stack has ${Z}`, 10, 26);
  }
}

// what is under the pointer: {node: id} or {segment: i, t} (t along the segment, from its first point)
function pick(e) {
  if (!view) return null;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = PICK_POINT_PX;
  for (const [id, p] of view.pts) {
    if (!inSlab(model.nodes.get(id))) continue;
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < bd) { bd = d; best = { node: id }; }
  }
  if (best) return best;
  bd = PICK_SEGMENT_PX;
  model.segments.forEach((s, i) => {
    const a = view.pts.get(s.a), b = view.pts.get(s.b);
    if (!a || !b || !(inSlab(model.nodes.get(s.a)) || inSlab(model.nodes.get(s.b)))) return;
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
    const t = Math.min(Math.max(((x - a[0]) * dx + (y - a[1]) * dy) / L, 0), 1);
    const d = Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
    if (d < bd) { bd = d; best = { segment: i, t: Math.min(Math.max(t, .02), .98) }; }
  });
  return best;
}
const screenOf = (h) => {
  if (h.node != null) return view.pts.get(h.node).slice(0, 2);
  const s = model.segments[h.segment], a = view.pts.get(s.a), b = view.pts.get(s.b);
  return [a[0] + (b[0] - a[0]) * h.t, a[1] + (b[1] - a[1]) * h.t];
};

// ---------- edits ----------
function apply(next, keepFuture) {
  if (next === model) return;
  history.push(model); if (!keepFuture) future = [];
  model = next; edits++; changed();
}
function changed() {
  if (savedKey) {
    if (edits) store.set(savedKey, { edits, model: Mo.toJSON(model) }); else store.del(savedKey);
  }
  facts(); V.redraw();
}
function undo() { if (!history.length) return; future.push(model); model = history.pop(); edits--; changed(); }
function redo() { if (!future.length) return; history.push(model); model = future.pop(); edits++; changed(); }

function grab(e) {
  if (!model || mode === 'off') return null;
  closeMenu();
  const h = pick(e);
  if (e.button === 0 && !e.shiftKey && h?.node != null) {
    const base = model, id = h.node, ndcZ = view.pts.get(id)[3];
    let moved = false;
    return {
      move(ev) {
        const r = cv.getBoundingClientRect();
        const nx = (ev.clientX - r.left) / view.W * 2 - 1, ny = 1 - (ev.clientY - r.top) / view.H * 2;
        const w = V.M.xf(V.M.inv(view.vp), [nx, ny, ndcZ]);
        const next = Mo.moveNode(base, id, fromWorld([w[0] / w[3], w[1] / w[3], w[2] / w[3]]));
        if (!moved) { moved = true; history.push(base); future = []; edits++; }
        model = next; V.redraw();
      },
      up() { if (moved) changed(); },
      cancel() { if (moved) changed(); },
    };
  }
  if (e.button === 2) {
    const x0 = e.clientX, y0 = e.clientY;
    return {
      move(ev) {
        if (!h) return;
        if (!rubber && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_PX) return;
        const r = cv.getBoundingClientRect(), target = pick(ev);
        hover = target;
        rubber = { from: screenOf(h), to: target ? screenOf(target) : [ev.clientX - r.left, ev.clientY - r.top] };
        cv.classList.add('connecting'); V.redraw();
      },
      up(ev) {
        cv.classList.remove('connecting');
        if (rubber) {
          rubber = null;
          const to = pick(ev);
          if (to && !(to.segment != null && to.segment === h.segment)) apply(Mo.connect(model, h, to));
          V.redraw();
        } else if (h) openMenu(h, ev.clientX, ev.clientY);
      },
      cancel() { rubber = null; cv.classList.remove('connecting'); V.redraw(); },
    };
  }
  return null;
}

function openMenu(h, x, y) {
  const items = [];
  const zScale = V.S.zs;   // µm per slice, as the view draws it
  if (h.segment != null) {
    items.push(['Delete this segment', () => Mo.deleteSegment(model, h.segment)]);
    items.push(['Add a bend point here', () => Mo.splitSegment(model, h.segment, h.t)[0]]);
  } else {
    const d = Mo.degrees(model).get(h.node) || 0;
    if (d >= 3) items.push(['Wrong junction: these vessels cross, split them', () => Mo.splitJunction(model, h.node, zScale)]);
    if (d === 2) items.push(['Remove this bend (straight line through)', () => Mo.removeBend(model, h.node)]);
    items.push([d === 1 ? 'Delete this tip and its segment' : 'Delete this point and its segments', () => Mo.deleteNode(model, h.node)]);
  }
  const m = $('ctx');
  m.replaceChildren(...items.map(([label, fn]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'item'; b.textContent = label;
    b.onclick = () => { closeMenu(); apply(fn()); };
    return b;
  }));
  m.hidden = false;
  m.style.left = `${Math.min(x, innerWidth - m.offsetWidth - 8)}px`; m.style.top = `${Math.min(y, innerHeight - m.offsetHeight - 8)}px`;
  hover = h; V.redraw();
}
function closeMenu() { if (!$('ctx').hidden) { $('ctx').hidden = true; hover = null; V.redraw(); } }

// ---------- loading, modes, saving ----------
function setMode(m) {
  mode = m;
  for (const b of $('model-mode').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === m));
  const side = m === 'side' && model;
  $('stages').classList.toggle('side', !!side);
  $('stage-model').hidden = !side;
  $('tag-stack').hidden = !side;
  if (m === 'overlay') $('stage').append(cv); else $('stage-model').prepend(cv);
  cv.hidden = m === 'off' || !model;
  $('stage-hint').textContent = m === 'overlay' && model
    ? 'drag a point: move it · right-click: delete or split · right-drag between pieces: connect · drag elsewhere: rotate'
    : 'drag: rotate · shift-drag or two fingers: pan · wheel or pinch: zoom';
  V.redraw();
}

function facts() {
  if (!model) return;
  const s = Mo.stats(model);
  $('model-facts').textContent = `${model.status === 'corrected' ? 'Corrected' : 'Draft'} model of ${model.source}: ` +
    `${s.segments} straight segments, ${s.junctions} junctions, ${s.tips} tips, ${model.slices} slices. ` +
    (edits ? `${edits} edit${edits === 1 ? '' : 's'} so far, kept in this browser until you download.` : 'No edits yet.');
  $('m-undo').disabled = !history.length; $('m-redo').disabled = !future.length; $('m-reset').disabled = !edits;
}
const msg = (t, err) => { $('model-msg').textContent = t; $('model-msg').classList.toggle('err', !!err); };

// a short fingerprint of the file as loaded, so saved edits never attach to a different model
function fingerprint(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0).toString(36); }

function open(text, name) {
  let m;
  try { m = Mo.parse(JSON.parse(text)); } catch (err) {
    return msg(`Could not read ${name}: ${err instanceof Mo.ModelError ? err.message : 'it is not valid JSON'}.`, true);
  }
  loaded = m; model = m; history = []; future = []; edits = 0;
  savedKey = SAVED + fingerprint(text);
  const saved = store.get(savedKey);
  msg('');
  if (saved?.edits) {
    try { model = Mo.parse(saved.model); history = [loaded]; edits = saved.edits; msg(`Picked up ${edits} edits you made earlier in this browser. Discard edits starts over from the file.`); }
    catch { store.del(savedKey); }
  }
  if (V.meta && m.slices !== slices()) msg(`This model has ${m.slices} slices and the stack has ${slices()}: they are probably not the same stack.`, true);
  $('model-on').hidden = false;
  setMode(mode === 'off' ? 'side' : mode);
  facts();
}

function download() {
  const out = Mo.toJSON(model, { status: edits || model.status === 'corrected' ? 'corrected' : model.status,
    corrected_at: new Date().toISOString(), corrections: (model.corrections || 0) + edits });
  const stem = String(model.source || 'vessels').replace(/\.tiff?$/i, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: 'application/json' }));
  a.download = `${stem}.vessels.corrected.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function openFile(f) {
  if (!V.meta) return msg('Open the stack first, then its model.', true);
  f.text().then((t) => open(t, f.name), () => msg(`Could not read ${f.name}.`, true));
}

// Called whenever a stack opens: offers the draft model drawn for it, if the site carries one.
export function stackOpened(name) {
  stackName = name;
  model = null; loaded = null; history = []; future = []; edits = 0; savedKey = null;
  $('model-on').hidden = true; msg(''); setMode(mode);
  const d = drafts.find((x) => x.source === name);
  $('model-draft').hidden = !d;
}

// The model as it stands and where each of its points was last drawn, for scripts driving the page.
export const inspect = () => ({ model: model && Mo.toJSON(model), points: view && Object.fromEntries(view.pts), edits });

let ready = false;
export function init() {
  if (ready) return; ready = true;
  cv = $('mcv');
  V.onDraw(draw);
  V.controls(cv, grab);
  cv.addEventListener('pointermove', (e) => {
    if (!model || e.buttons || rubber) return;
    const h = pick(e), same = JSON.stringify(h) === JSON.stringify(hover);
    cv.classList.toggle('over-point', !!h);
    if (!same && $('ctx').hidden) { hover = h; V.redraw(); }
  });
  cv.addEventListener('pointerleave', () => { if (hover && $('ctx').hidden) { hover = null; V.redraw(); } });
  $('model-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v); });
  $('model-load').onclick = () => $('model-file').click();
  $('model-file').onchange = (e) => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; };
  $('model-draft').onclick = async () => {
    const d = drafts.find((x) => x.source === stackName); if (!d) return;
    msg('Loading the draft…');
    try { const r = await fetch(`models/${d.file}`); if (!r.ok) throw new Error(r.status); open(await r.text(), d.file); }
    catch (err) { msg(`Could not load the draft (${err.message}).`, true); }
  };
  $('m-undo').onclick = undo; $('m-redo').onclick = redo;
  $('m-reset').onclick = () => { if (!edits || !confirm(`Discard all ${edits} edits and go back to the model as loaded?`)) return;
    store.del(savedKey); model = loaded; history = []; future = []; edits = 0; msg(''); changed(); };
  $('m-save').onclick = download;
  document.addEventListener('keydown', (e) => {
    if (!model || e.target.closest('input, textarea')) return;
    if (e.key === 'Escape') closeMenu();
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!$('ctx').contains(e.target) && e.target !== cv) closeMenu(); });
  fetch(MODELS).then((r) => (r.ok ? r.json() : [])).then((list) => {
    drafts = Array.isArray(list) ? list : [];
    if (stackName) $('model-draft').hidden = !drafts.some((x) => x.source === stackName);
  }).catch(() => { /* no drafts shipped with this copy of the site */ });
}
