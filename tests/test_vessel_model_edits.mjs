// The vessel-model edits the 3D MicroViewer offers, on small drawn models.
// Run: node tests/test_vessel_model_edits.mjs
import assert from 'node:assert/strict';
import * as Mo from '../microviewer/model.js';

const base = (nodes, segments) => ({ format: Mo.FORMAT, source: 'acme.tif', slices: 4, size_px: [100, 100], um_per_px: 1,
  nodes: nodes.map(([id, x, y, z]) => ({ id, x, y, z })),
  segments: segments.map(([a, b, state, confidence]) => ({ a, b, ...(state && { state }), ...(confidence != null && { confidence }) })) });
// a confirmed vessel 1-2-3 along y = 0, and a two-segment candidate 2-4-5 branching off its middle
const branching = () => Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 0], [3, 20, 0, 0], [4, 10, 10, 0], [5, 10, 20, 0]],
  [[1, 2, 'vessel', .9], [2, 3, 'vessel', .9], [2, 4, 'candidate', .4], [4, 5, 'candidate', .4]]));
const states = (m) => m.segments.map((s) => `${Math.min(s.a, s.b)}-${Math.max(s.a, s.b)}:${s.state}`).sort();
const pairs = (m) => m.segments.map(({ a, b }) => [Math.min(a, b), Math.max(a, b)].join('-')).sort();

const tests = {
  'parse refuses a file that is not a model, and one naming a missing point'() {
    assert.throws(() => Mo.parse({ format: 'x' }), Mo.ModelError);
    assert.throws(() => Mo.parse({ ...base([], []), slices: 0 }), Mo.ModelError);
    assert.throws(() => Mo.parse({ ...base([], []), size_px: [1] }), Mo.ModelError);
    assert.throws(() => Mo.parse(base([[1, 0, 0, null]], [])), Mo.ModelError);
    assert.throws(() => Mo.parse(base([[1, 0, 0, 0]], [[1, 9]])), Mo.ModelError);
  },
  'parse drops repeated and self segments and unconnected points'() {
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 1, 0, 0], [3, 5, 5, 0]], [[1, 2], [2, 1], [1, 1]]));
    assert.deepEqual(pairs(m), ['1-2']);
    assert.equal(m.nodes.has(3), false);
  },
  'edits leave the model they were given unchanged'() {
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 0]], [[1, 2]]));
    const o = Mo.moveNode(m, 2, { x: 3, y: 4, z: 1 });
    assert.deepEqual(m.nodes.get(2), { id: 2, x: 10, y: 0, z: 0 });
    assert.deepEqual(o.nodes.get(2), { id: 2, x: 3, y: 4, z: 1 });
  },
  'deleting a segment drops the points it leaves alone'() {
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 0], [3, 20, 0, 0]], [[1, 2], [2, 3]]));
    const o = Mo.deleteSegment(m, 1);
    assert.deepEqual(pairs(o), ['1-2']);
    assert.deepEqual([...o.nodes.keys()].sort(), [1, 2]);
  },
  'deleting a junction point removes all its segments'() {
    const m = Mo.parse(base([[1, 50, 50, 0], [2, 40, 50, 0], [3, 60, 50, 0], [4, 50, 40, 0]], [[1, 2], [1, 3], [1, 4]]));
    const o = Mo.deleteNode(m, 1);
    assert.equal(o.segments.length, 0); assert.equal(o.nodes.size, 0);
  },
  'removing a bend joins its neighbours'() {
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 10, 5, 0], [3, 20, 0, 0]], [[1, 2], [2, 3]]));
    assert.deepEqual(pairs(Mo.removeBend(m, 2)), ['1-3']);
  },
  'a crossing junction splits into two vessels passing through, each at its own depth'() {
    // an X: 2-1-3 runs left to right at depth 0, 4-1-5 top to bottom at depth 3
    const m = Mo.parse(base([[1, 50, 50, 1], [2, 40, 50, 0], [3, 60, 50, 0], [4, 50, 40, 3], [5, 50, 60, 3]],
      [[1, 2], [1, 4], [1, 3], [1, 5]]));
    const o = Mo.splitJunction(m, 1), deg = Mo.degrees(o);
    assert.equal(o.nodes.has(1), false);
    const mids = [...o.nodes.values()].filter((n) => deg.get(n.id) === 2);
    assert.equal(mids.length, 2);
    assert.deepEqual(mids.map((n) => Mo.neighbours(o, n.id).sort((a, b) => a - b).join(',')).sort(), ['2,3', '4,5']);
    assert.deepEqual(mids.map((n) => n.z).sort(), [0, 3]);
  },
  'a split Y keeps the straight pair and detaches the third branch as a tip'() {
    const m = Mo.parse(base([[1, 50, 50, 0], [2, 40, 50, 0], [3, 60, 50, 0], [4, 55, 40, 0]], [[1, 2], [1, 3], [1, 4]]));
    const o = Mo.splitJunction(m, 1), s = Mo.stats(o);
    assert.equal(s.junctions, 0); assert.equal(s.tips, 4); assert.equal(o.segments.length, 3);
    const tip = [...o.nodes.values()].find((n) => Mo.neighbours(o, n.id)[0] === 4 && Mo.degrees(o).get(n.id) === 1);
    assert.ok(tip.y < 50 && tip.y > 40, 'the detached tip sits back from the crossing');
  },
  'connecting two points adds one segment, and never a repeated one'() {
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 0], [3, 30, 0, 0], [4, 40, 0, 0]], [[1, 2], [3, 4]]));
    const o = Mo.connect(m, { node: 2 }, { node: 3 });
    assert.deepEqual(pairs(o), ['1-2', '2-3', '3-4']);
    assert.equal(Mo.connect(o, { node: 2 }, { node: 3 }), o);
  },
  'connecting onto the middle of segments places a point on each'() {
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 2], [3, 0, 20, 0], [4, 10, 20, 0]], [[1, 2], [3, 4]]));
    const o = Mo.connect(m, { segment: 0, t: .5 }, { segment: 1, t: .25 });
    assert.equal(o.segments.length, 5);
    const added = [...o.nodes.values()].filter((n) => n.id > 4).sort((a, b) => a.y - b.y);
    assert.deepEqual(added.map(({ x, y, z }) => [x, y, z]), [[5, 0, 1], [2.5, 20, 0]]);
    assert.equal(Mo.stats(o).junctions, 2);
  },
  'toJSON round-trips through parse'() {
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 1]], [[1, 2]]));
    const back = Mo.parse(Mo.toJSON(m));
    assert.deepEqual(pairs(back), ['1-2']); assert.deepEqual(back.nodes.get(2), m.nodes.get(2));
  },
  'a file without states reads as confirmed vessels, and an unknown state is refused'() {
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 0]], [[1, 2]]));
    assert.equal(m.segments[0].state, 'vessel');
    assert.equal('confidence' in m.segments[0], false, 'a segment nobody scored stays unscored');
    assert.throws(() => Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 0]], [[1, 2, 'maybe']])), Mo.ModelError);
  },
  'junctions and tips count confirmed vessels only; a candidate branch makes a pending junction'() {
    const s = Mo.stats(branching());
    assert.deepEqual([s.junctions, s.tips, s.pendingJunctions, s.segments], [0, 2, 1, 2]);
  },
  'approving a candidate accepts its whole vessel, and its branch point becomes a junction'() {
    const m = branching(), o = Mo.review(m, 3, 'accepted');
    assert.deepEqual(states(o), ['1-2:vessel', '2-3:vessel', '2-4:accepted', '4-5:accepted']);
    assert.deepEqual(states(m), ['1-2:vessel', '2-3:vessel', '2-4:candidate', '4-5:candidate'], 'the model given stays unchanged');
    const s = Mo.stats(o);
    assert.deepEqual([s.junctions, s.tips, s.pendingJunctions], [1, 3, 0]);
  },
  'a review covers one vessel: it stops at a junction and leaves a neighbouring candidate alone'() {
    // two candidates meeting a confirmed vessel at the same point: 2-4 and 2-6
    const m = Mo.parse(base([[1, 0, 0, 0], [2, 10, 0, 0], [3, 20, 0, 0], [4, 10, 10, 0], [6, 10, -10, 0]],
      [[1, 2, 'vessel'], [2, 3, 'vessel'], [2, 4, 'candidate'], [2, 6, 'candidate']]));
    assert.deepEqual(states(Mo.review(m, 2, 'rejected')), ['1-2:vessel', '2-3:vessel', '2-4:rejected', '2-6:candidate']);
    assert.equal(Mo.review(m, 0, 'rejected'), m, 'only a candidate is reviewed');
  },
  'a declined candidate stays in the file but is no part of the network'() {
    const o = Mo.review(branching(), 2, 'rejected');
    assert.deepEqual(states(o), ['1-2:vessel', '2-3:vessel', '2-4:rejected', '4-5:rejected']);
    assert.deepEqual(Mo.neighbours(o, 2).sort(), [1, 3]);
    assert.deepEqual(Mo.pieceCounts(o), { vessel: 1, candidate: 0, accepted: 0, rejected: 1 });
    // with the rejected branch ignored, point 2 is a plain bend and can be straightened
    const straight = Mo.removeBend(o, 2);
    assert.deepEqual(states(straight), ['1-3:vessel', '2-4:rejected', '4-5:rejected']);
    const back = Mo.parse(Mo.toJSON(o));
    assert.deepEqual(states(back), states(o)); assert.equal(back.segments[2].confidence, .4);
  },
  'edits keep a segment\'s state: a bend point splits a candidate into two candidates'() {
    const [o] = Mo.splitSegment(branching(), 3, .5);
    assert.deepEqual(o.segments.filter((s) => s.state === 'candidate').length, 3);
    assert.equal(Mo.piece(o, 2).length, 3, 'the split candidate is still one vessel');
    const c = Mo.connect(branching(), { node: 1 }, { node: 5 });
    assert.equal(c.segments.at(-1).state, 'vessel', 'a segment the owner draws is a vessel');
    assert.equal('confidence' in c.segments.at(-1), false);
  },
};

let n = 0;
for (const [name, fn] of Object.entries(tests)) { fn(); n++; console.log('ok', name); }
assert.equal(n, 17);
