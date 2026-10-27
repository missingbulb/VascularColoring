// A vessel model: points in 3D joined by straight segments, the format analysis/vessel_model.py
// writes. x and y are µm from the image's top-left corner, z is in slices. Everything here is plain
// data in, data out, so the edits can be tested without a browser.
//
// Each segment has a state. "vessel" is drawn by the extractor with confidence, or by the owner;
// "candidate" is a low-confidence vessel the extractor kept for the owner to review, which becomes
// "accepted" or "rejected". A rejected segment stays in the file as a recorded "no", but is no part
// of the network: junctions, tips and every edit see only the others. Junctions and tips are counted
// over confirmed vessels only, so a candidate turns a point into a junction once it is accepted.

export const FORMAT = 'vessel-model/1';

export const STATES = ['vessel', 'candidate', 'accepted', 'rejected'];
const CONFIRMED = new Set(['vessel', 'accepted']);
export const confirmed = (s) => CONFIRMED.has(s.state);
export const live = (s) => s.state !== 'rejected';

export class ModelError extends Error {}

// Checks a parsed JSON file and returns the model with ids made consistent: every segment names two
// existing, different points, no segment is listed twice, and no point is left unconnected.
export function parse(j) {
  if (!j || j.format !== FORMAT) throw new ModelError(`it is not a vessel model (expected format "${FORMAT}")`);
  for (const k of ['slices', 'um_per_px']) if (!(j[k] > 0)) throw new ModelError(`it has no "${k}"`);
  if (!Array.isArray(j.size_px) || j.size_px.length !== 2) throw new ModelError('it has no "size_px"');
  if (!Array.isArray(j.nodes) || !Array.isArray(j.segments)) throw new ModelError('it has no "nodes" or "segments"');
  const m = { ...j, nodes: new Map(), segments: [] };
  for (const n of j.nodes) {
    if (![n.x, n.y, n.z].every(Number.isFinite)) throw new ModelError(`point ${n.id} has no position`);
    m.nodes.set(n.id, { id: n.id, x: n.x, y: n.y, z: n.z });
  }
  const seen = new Set();
  for (const s of j.segments) {
    if (!m.nodes.has(s.a) || !m.nodes.has(s.b)) throw new ModelError(`a segment names a point that does not exist (${s.a}–${s.b})`);
    // a file written before segments had a state holds only the extractor's confident vessels
    const state = s.state ?? 'vessel';
    if (!STATES.includes(state)) throw new ModelError(`a segment has the unknown state "${state}" (${s.a}–${s.b})`);
    const k = key(s.a, s.b);
    if (s.a !== s.b && !seen.has(k)) { seen.add(k); m.segments.push(seg(s.a, s.b, { state, confidence: s.confidence })); }
  }
  prune(m);
  return m;
}

const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
// confidence is the extractor's score; a segment the owner drew has none, and stays without one
const seg = (a, b, { state, confidence }) => (confidence == null ? { a, b, state } : { a, b, state, confidence });

export function toJSON(m, extra = {}) {
  const { nodes, segments, ...rest } = m;
  return { ...rest, ...extra, nodes: [...nodes.values()], segments: segments.map((s) => seg(s.a, s.b, s)) };
}

export const clone = (m) => ({ ...m, nodes: new Map([...m.nodes].map(([k, n]) => [k, { ...n }])), segments: m.segments.map((s) => ({ ...s })) });

// How many segments meet at each point: confirmed vessels by default, or those `which` picks.
export function degrees(m, which = confirmed) {
  const d = new Map();
  for (const s of m.segments) if (which(s)) { d.set(s.a, (d.get(s.a) || 0) + 1); d.set(s.b, (d.get(s.b) || 0) + 1); }
  return d;
}
export const neighbours = (m, id) => m.segments.filter((s) => live(s) && (s.a === id || s.b === id)).map((s) => (s.a === id ? s.b : s.a));
const between = (m, a, b) => m.segments.find((s) => live(s) && key(s.a, s.b) === key(a, b));

function prune(m) {
  const d = degrees(m, () => true);
  for (const id of [...m.nodes.keys()]) if (!d.get(id)) m.nodes.delete(id);
}
function newId(m) { let k = 0; for (const id of m.nodes.keys()) if (id > k) k = id; return k + 1; }
function addNode(m, p) { const id = newId(m); m.nodes.set(id, { id, x: p.x, y: p.y, z: p.z }); return id; }
const DRAWN = { state: 'vessel' };
function link(m, a, b, like = DRAWN) {
  if (a === b) return false;
  const old = m.segments.findIndex((s) => key(s.a, s.b) === key(a, b));
  if (old >= 0 && live(m.segments[old])) return false;
  if (old >= 0) m.segments.splice(old, 1);   // drawn again where a rejected candidate lay: the owner has changed their mind
  m.segments.push(seg(a, b, like)); return true;
}
// the less certain of two segments' states, for a segment that replaces both
const merged = (p, q) => (p.state === 'candidate' ? p : q.state === 'candidate' ? q : confirmed(p) ? p : q);

// Each edit returns a new model and leaves the one it was given unchanged, so undo is a list of models.

export function moveNode(m, id, p) {
  const o = clone(m); Object.assign(o.nodes.get(id), { x: p.x, y: p.y, z: p.z }); return o;
}

export function deleteSegment(m, i) {
  const o = clone(m); o.segments.splice(i, 1); prune(o); return o;
}

export function deleteNode(m, id) {
  const o = clone(m); o.segments = o.segments.filter((s) => !live(s) || (s.a !== id && s.b !== id)); prune(o); return o;
}

// A bend point taken out: its two neighbours are joined by one straight segment.
export function removeBend(m, id) {
  const nb = neighbours(m, id);
  if (nb.length !== 2) return m;
  const like = merged(between(m, id, nb[0]), between(m, id, nb[1]));
  const o = deleteNode(m, id);
  for (const n of nb) if (!o.nodes.has(n)) o.nodes.set(n, { ...m.nodes.get(n) });
  link(o, nb[0], nb[1], like);
  return o;
}

// A point placed on segment i at fraction t from its first end; returns [model, new point id].
export function splitSegment(m, i, t) {
  const o = clone(m), s = o.segments[i], A = o.nodes.get(s.a), B = o.nodes.get(s.b);
  const id = addNode(o, { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: A.z + (B.z - A.z) * t });
  o.segments.splice(i, 1, seg(s.a, id, s), seg(id, s.b, s));
  return [o, id];
}

// The junction is wrong: its vessels pass each other instead of meeting. The branches are paired off
// most-opposite first (a vessel runs straight through a crossing), each pair keeps its own point at
// the depth between its two neighbours, and a branch left over becomes a tip set a little back from
// the crossing so it reads as detached. zScale converts slices to µm for the angles.
export function splitJunction(m, id, zScale = 1) {
  const nb = neighbours(m, id);
  if (nb.length < 3) return m;
  const N = m.nodes.get(id);
  const dir = nb.map((k) => { const P = m.nodes.get(k), v = [P.x - N.x, P.y - N.y, (P.z - N.z) * zScale], l = Math.hypot(...v) || 1; return v.map((x) => x / l); });
  const left = new Set(nb.map((_, i) => i)), groups = [];
  while (left.size >= 2) {
    let best = null;
    for (const i of left) for (const j of left) if (i < j) {
      const c = dir[i][0] * dir[j][0] + dir[i][1] * dir[j][1] + dir[i][2] * dir[j][2];
      if (!best || c < best[2]) best = [i, j, c];
    }
    groups.push([best[0], best[1]]); left.delete(best[0]); left.delete(best[1]);
  }
  for (const i of left) groups.push([i]);
  const like = nb.map((k) => between(m, id, k));
  const o = clone(m);
  o.segments = o.segments.filter((s) => !live(s) || (s.a !== id && s.b !== id));
  if (!o.segments.some((s) => s.a === id || s.b === id)) o.nodes.delete(id);
  for (const g of groups) {
    const ps = g.map((i) => m.nodes.get(nb[i]));
    const p = g.length === 2
      ? { x: N.x, y: N.y, z: (ps[0].z + ps[1].z) / 2 }
      : { x: N.x + (ps[0].x - N.x) * .25, y: N.y + (ps[0].y - N.y) * .25, z: N.z + (ps[0].z - N.z) * .25 };
    const nid = addNode(o, p);
    for (const i of g) { if (!o.nodes.has(nb[i])) o.nodes.set(nb[i], { ...m.nodes.get(nb[i]) }); link(o, nid, nb[i], like[i]); }
  }
  return o;
}

// Two parts of one vessel joined. Each end is {node: id} or {segment: i, t}, a point on a segment.
export function connect(m, from, to) {
  let o = m, ids = [];
  // split the later-listed segment first so the earlier index stays valid
  const ends = [from, to].map((e, k) => ({ ...e, k })).sort((p, q) => (q.segment ?? -1) - (p.segment ?? -1));
  for (const e of ends) {
    if (e.node != null) { ids[e.k] = e.node; continue; }
    [o, ids[e.k]] = splitSegment(o, e.segment, e.t);
  }
  if (ids[0] === ids[1]) return m;
  if (o === m) o = clone(m);
  return link(o, ids[0], ids[1]) ? o : m;
}

// The segments of the one vessel segment i belongs to, as far as its state runs: it continues
// through points where only it and one other segment meet, and stops at a junction, a tip, or where
// a segment in another state takes over.
export function piece(m, i) {
  const state = m.segments[i].state, d = degrees(m, (t) => live(t) || t.state === state), out = new Set([i]), todo = [i];
  while (todo.length) {
    const s = m.segments[todo.pop()];
    for (const n of [s.a, s.b]) {
      if (d.get(n) !== 2) continue;
      const j = m.segments.findIndex((t, k) => !out.has(k) && t.state === state && (t.a === n || t.b === n));
      if (j >= 0) { out.add(j); todo.push(j); }
    }
  }
  return [...out].sort((a, b) => a - b);
}

// The owner's verdict on a candidate: the whole vessel it belongs to is accepted or rejected.
export function review(m, i, verdict) {
  if (m.segments[i]?.state !== 'candidate' || !['accepted', 'rejected'].includes(verdict)) return m;
  const o = clone(m);
  for (const k of piece(m, i)) o.segments[k].state = verdict;
  return o;
}

// How many vessels (not straight segments) are in each state.
export function pieceCounts(m) {
  const n = Object.fromEntries(STATES.map((s) => [s, 0])), seen = new Set();
  m.segments.forEach((s, i) => { if (seen.has(i)) return; for (const k of piece(m, i)) seen.add(k); n[s.state]++; });
  return n;
}

export function stats(m) {
  const d = degrees(m), all = degrees(m, live);
  let junctions = 0, tips = 0, pending = 0;
  for (const v of d.values()) { if (v >= 3) junctions++; else if (v === 1) tips++; }
  for (const [id, v] of all) if (v >= 3 && !((d.get(id) || 0) >= 3)) pending++;
  return { points: m.nodes.size, segments: m.segments.filter(confirmed).length, junctions, tips, pendingJunctions: pending };
}
