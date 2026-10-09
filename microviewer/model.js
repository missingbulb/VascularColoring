// A vessel model: points in 3D joined by straight segments, the format analysis/vessel_model.py
// writes. x and y are µm from the image's top-left corner, z is in slices. Everything here is plain
// data in, data out, so the edits can be tested without a browser.

export const FORMAT = 'vessel-model/1';

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
    const k = key(s.a, s.b);
    if (s.a !== s.b && !seen.has(k)) { seen.add(k); m.segments.push({ a: s.a, b: s.b }); }
  }
  prune(m);
  return m;
}

const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

export function toJSON(m, extra = {}) {
  const { nodes, segments, ...rest } = m;
  return { ...rest, ...extra, nodes: [...nodes.values()], segments: segments.map(({ a, b }) => ({ a, b })) };
}

export const clone = (m) => ({ ...m, nodes: new Map([...m.nodes].map(([k, n]) => [k, { ...n }])), segments: m.segments.map((s) => ({ ...s })) });

export function degrees(m) {
  const d = new Map();
  for (const { a, b } of m.segments) { d.set(a, (d.get(a) || 0) + 1); d.set(b, (d.get(b) || 0) + 1); }
  return d;
}
export const neighbours = (m, id) => m.segments.filter((s) => s.a === id || s.b === id).map((s) => (s.a === id ? s.b : s.a));

function prune(m) {
  const d = degrees(m);
  for (const id of [...m.nodes.keys()]) if (!d.get(id)) m.nodes.delete(id);
}
function newId(m) { let k = 0; for (const id of m.nodes.keys()) if (id > k) k = id; return k + 1; }
function addNode(m, p) { const id = newId(m); m.nodes.set(id, { id, x: p.x, y: p.y, z: p.z }); return id; }
function link(m, a, b) {
  if (a === b || m.segments.some((s) => key(s.a, s.b) === key(a, b))) return false;
  m.segments.push({ a, b }); return true;
}

// Each edit returns a new model and leaves the one it was given unchanged, so undo is a list of models.

export function moveNode(m, id, p) {
  const o = clone(m); Object.assign(o.nodes.get(id), { x: p.x, y: p.y, z: p.z }); return o;
}

export function deleteSegment(m, i) {
  const o = clone(m); o.segments.splice(i, 1); prune(o); return o;
}

export function deleteNode(m, id) {
  const o = clone(m); o.segments = o.segments.filter((s) => s.a !== id && s.b !== id); prune(o); return o;
}

// A bend point taken out: its two neighbours are joined by one straight segment.
export function removeBend(m, id) {
  const nb = neighbours(m, id);
  if (nb.length !== 2) return m;
  const o = deleteNode(m, id);
  for (const n of nb) if (!o.nodes.has(n)) o.nodes.set(n, { ...m.nodes.get(n) });
  link(o, nb[0], nb[1]);
  return o;
}

// A point placed on segment i at fraction t from its first end; returns [model, new point id].
export function splitSegment(m, i, t) {
  const o = clone(m), s = o.segments[i], A = o.nodes.get(s.a), B = o.nodes.get(s.b);
  const id = addNode(o, { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: A.z + (B.z - A.z) * t });
  o.segments.splice(i, 1, { a: s.a, b: id }, { a: id, b: s.b });
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
  const o = clone(m);
  o.segments = o.segments.filter((s) => s.a !== id && s.b !== id);
  o.nodes.delete(id);
  for (const g of groups) {
    const ps = g.map((i) => m.nodes.get(nb[i]));
    const p = g.length === 2
      ? { x: N.x, y: N.y, z: (ps[0].z + ps[1].z) / 2 }
      : { x: N.x + (ps[0].x - N.x) * .25, y: N.y + (ps[0].y - N.y) * .25, z: N.z + (ps[0].z - N.z) * .25 };
    const nid = addNode(o, p);
    for (const i of g) { if (!o.nodes.has(nb[i])) o.nodes.set(nb[i], { ...m.nodes.get(nb[i]) }); link(o, nid, nb[i]); }
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

export function stats(m) {
  const d = degrees(m);
  let junctions = 0, tips = 0;
  for (const v of d.values()) { if (v >= 3) junctions++; else if (v === 1) tips++; }
  return { points: m.nodes.size, segments: m.segments.length, junctions, tips };
}
