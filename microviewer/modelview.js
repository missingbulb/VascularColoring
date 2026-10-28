// The vessel model beside or over the stack, in the stack's own camera, and the owner's corrections to
// it: drag a point to move it, right-click a segment or a point to delete it or split a junction,
// right-drag from one piece to another to connect them, click a dashed low-confidence vessel to
// approve or decline it. The corrected model downloads as JSON.
//
// The review narrows the stack to what the model accounts for: Detected keeps only the signal around
// the model's vessels, to check and measure them; Missed keeps only the signal away from them, to find
// vessels the extractor did not draw, which can then be drawn in a click at a time.
import * as V from './viewer.js';
import * as Mo from './model.js';
import { coverage } from './coverage.js';

const $ = (id) => document.getElementById(id);
const MODELS = 'models/index.json';
const SAVED = 'mv-model:';
const PICK_POINT_PX = 9, PICK_SEGMENT_PX = 6, DRAG_PX = 5;
// The overlay draws the model in magenta: neither the depth colours nor the hot scale of the stack
// carry it, so a line never vanishes into the signal it is laid over.
const OVERLAY = '#ff4fd8';

let model = null, loaded = null, history = [], future = [], edits = 0, savedKey = null;
let mode = 'side', hover = null, rubber = null, drafts = [], stackName = null, showCandidates = true;
let review = 'all', reach = 2, maskKey = null, maskTimer = null, drawing = null;
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
  const at = (p) => { const v = V.M.xf(vp, toWorld(p)); return v[3] > 0 ? [(v[0] / v[3] + 1) / 2 * W, (1 - v[1] / v[3]) / 2 * H, v[3], v[2] / v[3]] : null; };
  for (const n of model.nodes.values()) { const q = at(n); if (q) pts.set(n.id, q); }
  // each segment's stretch of its edge's curve, on screen
  const curves = new Map();
  model.segments.forEach((s, i) => {
    if (!pts.has(s.a) || !pts.has(s.b)) return;
    const c = samples(i).map(at);
    if (c.every(Boolean)) curves.set(i, c);
  });
  return { vp, W, H, pts, curves };
}
const SAMPLES = 8, sampled = new WeakMap();
function samples(i) {
  let c = sampled.get(model);
  if (!c) sampled.set(model, (c = []));
  return (c[i] ??= Mo.sampleSegment(model, i, SAMPLES));
}
const inSlab = (n) => n.z >= V.S.z0 - .5 && n.z <= V.S.z1 + .5 && V.inClip(toWorld(n));
// declined candidates are never drawn; the rest are, unless the owner has hidden the low-confidence ones
const visible = (s) => Mo.live(s) && (showCandidates || s.state !== 'candidate');
const shown = (s) => visible(s) && (inSlab(model.nodes.get(s.a)) || inSlab(model.nodes.get(s.b)));
const isCandidate = (h) => h?.segment != null && model.segments[h.segment]?.state === 'candidate';

function draw() {
  if (!model || mode === 'off' || !V.meta || !cv.clientWidth) return;
  const dpr = window.devicePixelRatio || 1;
  cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr;
  const c = cv.getContext('2d'); c.scale(dpr, dpr);
  if (mode === 'side') { c.fillStyle = '#000'; c.fillRect(0, 0, cv.clientWidth, cv.clientHeight); }
  view = project();
  const { pts } = view, Z = slices(), deg = Mo.degrees(model), seen = Mo.degrees(model, visible);
  const all = Mo.degrees(model, Mo.live), cand = Mo.degrees(model, (s) => s.state === 'candidate');
  const hot = new Set(isCandidate(hover) ? Mo.piece(model, hover.segment) : hover?.segment != null ? [hover.segment] : []);
  const span = Math.max(V.S.z1 + 1 - V.S.z0, 1);
  const colour = (z) => {
    if (mode === 'overlay') return OVERLAY;
    if (!V.S.depth) return '#4fd1d9';
    const t = V.turbo(((z + .5) - V.S.z0) / span);
    return `rgb(${t.map((v) => Math.round(v * 255)).join(',')})`;
  };
  // far segments first, so nearer vessels draw over the ones they pass in front of
  const order = model.segments.map((s, i) => i).filter((i) => view.curves.has(i) && shown(model.segments[i]));
  order.sort((i, j) => (pts.get(model.segments[j].a)[2] + pts.get(model.segments[j].b)[2]) - (pts.get(model.segments[i].a)[2] + pts.get(model.segments[i].b)[2]));
  c.lineCap = 'round';
  for (const i of order) {
    const s = model.segments[i], line = view.curves.get(i), lit = hot.has(i);
    // a low-confidence vessel is dashed in the same colours, so depth still reads along it
    const unsure = s.state === 'candidate';
    c.setLineDash(unsure ? [4, 4] : []);
    c.strokeStyle = lit ? '#fff' : colour((model.nodes.get(s.a).z + model.nodes.get(s.b).z) / 2);
    // over the stack the lines stay thin and let the signal under them show through
    c.globalAlpha = lit ? 1 : (mode === 'overlay' ? .7 : 1) * (unsure ? .8 : 1);
    c.lineWidth = lit ? 3 : mode === 'overlay' ? 1.1 : 1.5;
    c.beginPath(); c.moveTo(line[0][0], line[0][1]); for (const q of line) c.lineTo(q[0], q[1]); c.stroke();
  }
  c.setLineDash([]); c.globalAlpha = 1;
  for (const n of model.nodes.values()) {
    const p = pts.get(n.id), v = seen.get(n.id) || 0; if (!p || !v || !inSlab(n)) continue;
    const d = deg.get(n.id) || 0, hot = hover?.node === n.id;
    c.beginPath();
    // a junction is where three confirmed vessels meet; one that waits on a candidate's review is dashed
    if (v >= 3) {
      c.setLineDash(d >= 3 || hot ? [] : [2, 2]);
      c.arc(p[0], p[1], hot ? 6 : 4, 0, 2 * Math.PI); c.strokeStyle = hot ? '#fff' : mode === 'overlay' ? OVERLAY : 'rgba(255,255,255,.85)'; c.lineWidth = hot ? 2 : 1.2; c.stroke();
      c.setLineDash([]);
    } else if (hot || all.get(n.id) !== cand.get(n.id)) {
      // a candidate's own points are left undrawn, so it reads as a dashed line and not as a row of dots
      c.arc(p[0], p[1], hot ? 4.5 : (v === 1 ? 2.2 : 1.6) * (mode === 'overlay' ? .7 : 1), 0, 2 * Math.PI); c.fillStyle = hot ? '#fff' : colour(n.z); c.fill();
    }
  }
  const w = hover && (hover.node == null || pts.has(hover.node)) && hoverRadius(hover);
  if (w) {
    const [x, y] = screenOf(hover), t = `⌀ ${(2 * w).toFixed(1)} µm`;
    c.font = '11px "IBM Plex Mono", monospace'; c.fillStyle = 'rgba(0,0,0,.6)';
    c.fillRect(x + 8, y - 22, c.measureText(t).width + 8, 16); c.fillStyle = '#fff'; c.fillText(t, x + 12, y - 10);
  }
  if (drawing?.from && drawing.to) {
    c.setLineDash([5, 4]); c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(...screenOf(drawing.from)); c.lineTo(...drawing.to); c.stroke(); c.setLineDash([]);
    if (drawing.from.point) { const [x, y] = screenOf(drawing.from); c.beginPath(); c.arc(x, y, 3, 0, 2 * Math.PI); c.fillStyle = '#fff'; c.fill(); }
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
function pick(e, segmentsOnly = false) {
  if (!view) return null;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = PICK_POINT_PX;
  const on = Mo.degrees(model, visible);
  if (!segmentsOnly) for (const [id, p] of view.pts) {
    if (!on.get(id) || !inSlab(model.nodes.get(id))) continue;
    const d = Math.hypot(p[0] - x, p[1] - y);
    if (d < bd) { bd = d; best = { node: id }; }
  }
  if (best) return best;
  bd = PICK_SEGMENT_PX;
  for (const [i, line] of view.curves) {
    if (!shown(model.segments[i])) continue;
    for (let k = 0; k < line.length - 1; k++) {
      const a = line[k], b = line[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
      const u = Math.min(Math.max(((x - a[0]) * dx + (y - a[1]) * dy) / L, 0), 1);
      const d = Math.hypot(a[0] + u * dx - x, a[1] + u * dy - y);
      if (d < bd) { bd = d; best = { segment: i, t: Math.min(Math.max((k + u) / (line.length - 1), .02), .98) }; }
    }
  }
  return best;
}
// the vessel's radius in µm under a picked point or segment, when the model gives it
const hoverRadius = (h) => (h.node != null ? model.nodes.get(h.node)?.r : model.segments[h.segment] ? Mo.curvePoint(model, h.segment, h.t).r : null);
const screenOf = (h) => {
  if (h.point) { const v = V.M.xf(view.vp, toWorld(h.point)); return [(v[0] / v[3] + 1) / 2 * view.W, (1 - v[1] / v[3]) / 2 * view.H]; }
  if (h.node != null) return view.pts.get(h.node).slice(0, 2);
  const line = view.curves.get(h.segment), f = h.t * (line.length - 1), k = Math.min(Math.floor(f), line.length - 2), u = f - k;
  return [line[k][0] + (line[k + 1][0] - line[k][0]) * u, line[k][1] + (line[k + 1][1] - line[k][1]) * u];
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
  facts(); refreshMask(); V.redraw();
}
function undo() { if (!history.length) return; future.push(model); model = history.pop(); edits--; changed(); }
function redo() { if (!future.length) return; history.push(model); model = future.pop(); edits++; changed(); }

function grab(e) {
  if (!model || mode === 'off') return null;
  closeMenu();
  const h = pick(e);
  if (e.button === 0 && !e.shiftKey && h?.node != null && !drawing) {
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
      up(ev) { if (moved) changed(); else clicked(ev); },
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

// A left click on a dashed vessel asks for its verdict.
function clicked(e) {
  if (!model || mode === 'off') return;
  if (drawing) return drawClick(e);
  const h = pick(e, true);
  if (isCandidate(h)) openMenu(h, e.clientX, e.clientY);
}

function openMenu(h, x, y) {
  const items = [];
  const zScale = V.S.zs;   // µm per slice, as the view draws it
  if (isCandidate(h)) {
    const c = model.segments[h.segment].confidence;
    items.push(['Approve this vessel (A)', () => Mo.review(model, h.segment, 'accepted')]);
    items.push(['Decline this vessel (D)', () => Mo.review(model, h.segment, 'rejected')]);
    if (c != null) items.push([`low confidence: ${c.toFixed(2)}`, null]);
  }
  if (h.segment != null) {
    items.push(['Delete this segment', () => Mo.deleteSegment(model, h.segment)]);
    items.push(['Add a curve point here', () => Mo.splitSegment(model, h.segment, h.t)[0]]);
  } else {
    const d = Mo.degrees(model).get(h.node) || 0;
    if (d >= 3) {
      items.push(['Look at it from the side: crossing or split?', () => { lookAt(h.node); return model; }]);
      items.push(['Wrong junction: these vessels cross, split them', () => Mo.splitJunction(model, h.node, zScale)]);
    }
    if (d === 2) items.push(['Remove this curve point (smoother curve)', () => Mo.removeBend(model, h.node)]);
    items.push([d === 1 ? 'Delete this tip and its segment' : 'Delete this point and its segments', () => Mo.deleteNode(model, h.node)]);
  }
  const m = $('ctx');
  m.replaceChildren(...items.map(([label, fn]) => {
    if (!fn) { const p = document.createElement('div'); p.className = 'note'; p.textContent = label; return p; }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'item'; b.textContent = label;
    b.onclick = () => { closeMenu(); apply(fn()); V.redraw(); };
    return b;
  }));
  m.hidden = false;
  m.style.left = `${Math.min(x, innerWidth - m.offsetWidth - 8)}px`; m.style.top = `${Math.min(y, innerHeight - m.offsetHeight - 8)}px`;
  hover = h; V.redraw();
}
// The junction from the side, cut out of the stack: two vessels that only cross sit apart in depth.
// The view looks across the straightest pair of branches through it, the vessel running on.
const LOOK_RADII = 8, LOOK_MIN_UM = 10;
function lookAt(id) {
  const N = model.nodes.get(id), w = toWorld(N), nb = Mo.neighbours(model, id).map((k) => toWorld(model.nodes.get(k)));
  const dir = nb.map((q) => { const v = [q[0] - w[0], q[1] - w[1]], l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l]; });
  let best = [0, 1, 2];
  for (let i = 0; i < dir.length; i++) for (let j = i + 1; j < dir.length; j++) {
    const c = dir[i][0] * dir[j][0] + dir[i][1] * dir[j][1];
    if (c < best[2]) best = [i, j, c];
  }
  const along = Math.atan2(dir[best[0]][1] - dir[best[1]][1], dir[best[0]][0] - dir[best[1]][0]);
  const um = Math.max(LOOK_RADII * (N.r || 0), LOOK_MIN_UM);
  V.focus(w, um / (model.size_px[0] * model.um_per_px) * 2 * V.half[0], along);
  if (mode === 'side') setMode('overlay');
  msg('Showing this junction from the side. Top, Tilted, Side or Front shows the whole stack again.');
}
function closeMenu() { if (!$('ctx').hidden) { $('ctx').hidden = true; hover = null; V.redraw(); } }

// ---------- the review: detected or missed ----------
function setReview(r) {
  review = r;
  for (const b of $('review-mode').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === r));
  $('review-note').textContent = {
    all: 'The whole stack.',
    detected: 'Only the signal within reach of the model’s vessels: check them and measure their widths (hover a vessel).',
    missed: 'Only the signal away from the model’s vessels: whatever bright line is left is a vessel the model does not have.',
  }[r];
  $('reach-row').hidden = r === 'all';
  refreshMask(true);
}
// The mask follows the model, the vessels shown, the reach and the slice spacing, recomputed a moment
// after the last change so a run of edits paints it once.
function refreshMask(now) {
  clearTimeout(maskTimer);
  if (!V.meta) return;
  if (!model || review === 'all') { maskKey = null; return V.setMask(null); }
  const key = [model, showCandidates, reach, V.S.zs];
  if (maskKey && key.every((v, k) => v === maskKey.key[k])) return V.setMask(maskKey.mask, review);
  maskTimer = setTimeout(() => {
    const mask = coverage(model, V.meta.shape, { zStepUm: V.S.zs, marginUm: reach, which: visible });
    maskKey = { key, mask }; V.setMask(mask, review);
  }, now ? 0 : 150);
}

// Drawing a missed vessel: each click places its next point, on an existing point or vessel when the
// click lands on one, else at the brightest shown voxel under the pointer. Joining the network, Enter,
// Escape or the button again ends it.
function setDrawing(on) {
  drawing = on ? { from: null, to: null } : null;
  $('m-draw').textContent = on ? 'Finish drawing' : 'Draw a missed vessel';
  $('m-draw').setAttribute('aria-pressed', String(!!on));
  cv.classList.toggle('connecting', !!on);
  if (on && mode !== 'overlay') setMode('overlay');
  $('draw-note').textContent = on ? 'Click along the vessel, a point at a time; each point goes to the brightest spot under the pointer. Click an existing vessel, press Enter or Escape to end. Ctrl-Z takes back a point.' : '';
  V.redraw();
}
function drawClick(e) {
  const h = pick(e), r = cv.getBoundingClientRect();
  let to = h;
  if (!to) {
    const w = V.brightestOnRay((e.clientX - r.left) / view.W * 2 - 1, 1 - (e.clientY - r.top) / view.H * 2, view.W / view.H);
    if (!w) return;
    to = { point: fromWorld(w) };
  }
  // an undo can take away the point the line was drawing from
  if (drawing.from?.node != null && !model.nodes.has(drawing.from.node)) drawing.from = null;
  if (!drawing.from) { drawing.from = to; return V.redraw(); }
  const [next, id] = Mo.drawSegment(model, drawing.from, to);
  if (id == null) return;
  apply(next);
  if (h) return setDrawing(false);
  drawing.from = { node: id };
}

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
    ? 'drag a point: move it · click a dashed vessel: approve or decline · right-click: delete or split · right-drag between pieces: connect · drag elsewhere: rotate'
    : 'drag: rotate · shift-drag or two fingers: pan · wheel or pinch: zoom';
  V.redraw();
}

function facts() {
  if (!model) return;
  const s = Mo.stats(model), v = Mo.pieceCounts(model);
  $('model-facts').textContent = `${model.status === 'corrected' ? 'Corrected' : 'Draft'} model of ${model.source}: ` +
    `${v.vessel + v.accepted} vessel edges, ${s.junctions} junctions, ${s.tips} tips, ${model.slices} slices. ` +
    (v.candidate || v.accepted || v.rejected ? `${v.candidate} low-confidence vessel${v.candidate === 1 ? '' : 's'} to review` +
      `${s.pendingJunctions ? ` (they would add up to ${s.pendingJunctions} junctions)` : ''}, ${v.accepted} approved, ${v.rejected} declined. ` : '') +
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
  $('model-on').hidden = false; $('review-box').hidden = false;
  maskKey = null; refreshMask(true);
  $('m-candidates-row').hidden = !model.segments.some((s) => s.state !== 'vessel');
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

// A stack's name as a download or a Drive copy may spell it: case, spaces and punctuation aside.
const same = (a, b) => { const k = (s) => String(s).toLowerCase().replace(/\.tiff?$/, '').replace(/[^a-z0-9]/g, ''); return k(a) === k(b); };
const draftFor = (name) => drafts.find((x) => same(x.source, name));

// Called whenever a stack opens: brings in the draft model drawn for it, if the site carries one.
export function stackOpened(name) {
  stackName = name;
  model = null; loaded = null; history = []; future = []; edits = 0; savedKey = null;
  $('model-on').hidden = true; $('review-box').hidden = true; msg(''); setMode(mode);
  if (drawing) setDrawing(false);
  maskKey = null; refreshMask(true);
  $('model-draft').hidden = !draftFor(name);
  if (draftFor(name)) loadDraft();
}
async function loadDraft() {
  const d = draftFor(stackName); if (!d) return;
  msg('Loading the draft…');
  try { const r = await fetch(`models/${d.file}`); if (!r.ok) throw new Error(r.status); open(await r.text(), d.file); }
  catch (err) { msg(`Could not load the draft (${err.message}).`, true); }
}

// The model as it stands and where each of its points was last drawn, for scripts driving the page.
export const inspect = () => ({ model: model && Mo.toJSON(model), points: view && Object.fromEntries(view.pts), edits });

let ready = false;
export function init() {
  if (ready) return; ready = true;
  cv = $('mcv');
  V.onDraw(draw);
  V.controls(cv, grab, clicked);
  cv.addEventListener('pointermove', (e) => {
    if (!model || e.buttons || rubber) return;
    if (drawing) { const r = cv.getBoundingClientRect(); drawing.to = [e.clientX - r.left, e.clientY - r.top]; }
    const h = pick(e), same = JSON.stringify(h) === JSON.stringify(hover);
    cv.classList.toggle('over-point', !!h);
    if ((!same || drawing) && $('ctx').hidden) { hover = h; V.redraw(); }
  });
  cv.addEventListener('pointerleave', () => { if (hover && $('ctx').hidden) { hover = null; V.redraw(); } });
  $('model-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.v); });
  $('model-load').onclick = () => $('model-file').click();
  $('model-file').onchange = (e) => { if (e.target.files[0]) openFile(e.target.files[0]); e.target.value = ''; };
  $('model-draft').onclick = loadDraft;
  $('m-candidates').onchange = (e) => { showCandidates = e.target.checked; if (!showCandidates && isCandidate(hover)) closeMenu(); hover = null; refreshMask(); V.redraw(); };
  $('review-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setReview(b.dataset.v); });
  const reachOut = () => { $('reach-o').value = `${reach.toFixed(1)} µm`; };
  $('reach').addEventListener('input', (e) => { reach = +e.target.value; reachOut(); refreshMask(); });
  reachOut();
  $('zs').addEventListener('input', () => refreshMask());
  $('m-draw').onclick = () => setDrawing(!drawing);
  $('m-undo').onclick = undo; $('m-redo').onclick = redo;
  $('m-reset').onclick = () => { if (!edits || !confirm(`Discard all ${edits} edits and go back to the model as loaded?`)) return;
    store.del(savedKey); model = loaded; history = []; future = []; edits = 0; msg(''); changed(); };
  $('m-save').onclick = download;
  document.addEventListener('keydown', (e) => {
    if (!model || e.target.closest('input, textarea')) return;
    if (e.key === 'Escape') closeMenu();
    if (drawing && (e.key === 'Escape' || e.key === 'Enter')) { setDrawing(false); return; }
    const k0 = e.key.toLowerCase();
    if (!(e.ctrlKey || e.metaKey || e.altKey) && (k0 === 'a' || k0 === 'd') && isCandidate(hover)) {
      const h = hover; closeMenu(); hover = null; apply(Mo.review(model, h.segment, k0 === 'a' ? 'accepted' : 'rejected')); return;
    }
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
  });
  document.addEventListener('pointerdown', (e) => { if (!$('ctx').contains(e.target) && e.target !== cv) closeMenu(); });
  fetch(MODELS).then((r) => (r.ok ? r.json() : [])).then((list) => {
    drafts = Array.isArray(list) ? list : [];
    if (stackName && !model) { $('model-draft').hidden = !draftFor(stackName); loadDraft(); }
  }).catch(() => { /* no drafts shipped with this copy of the site */ });
}
