// Red-first fixtures for this pack's checks: each rule is shown FIRING on a
// violating input and QUIET on a clean one. Dependency-free — run it with
//   node .claudinite/local/packs/vascular-coloring/pack.test.mjs
import assert from 'node:assert/strict';

import overlayColorContrast from './overlay-color-contrast.mjs';
import renderedOverlaysUntracked from './rendered-overlays-untracked.mjs';
import panelScaleCalibration from './panel-scale-calibration.mjs';
import lockedMetricFields from './locked-metric-fields.mjs';

// The slice of the check context these rules use: file reads and the tracked list.
const ctx = ({ files = {}, tracked = [] }) => ({
  tracked,
  read: (p) => (p in files ? files[p] : null),
});

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// --- overlay-color-contrast -------------------------------------------------

const OVERLAY = 'analysis/annotate_overlays.py';

test('overlay-color-contrast fires on a red overlay colour', () => {
  const findings = overlayColorContrast.run(ctx({
    files: { [OVERLAY]: 'CAP_COL, ART_COL = (0, 200, 255), (255, 60, 30)\n' },
  }));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 1);
  assert.match(findings[0].what, /red-dominant/);
});

test('overlay-color-contrast is quiet on the agreed palette', () => {
  const findings = overlayColorContrast.run(ctx({
    files: {
      [OVERLAY]: [
        '# an example artery gets a red arrow  <- prose, not a drawn colour',
        'CAP_COL, ART_COL, JUN_COL = (0, 200, 255), (40, 235, 90), (255, 0, 255)',
        'label = (255, 235, 60)',
        'white = (255, 255, 255)',
      ].join('\n'),
    },
  }));
  assert.deepEqual(findings, []);
});

// --- rendered-overlays-untracked --------------------------------------------

test('rendered-overlays-untracked fires on a committed overlay PNG', () => {
  const findings = renderedOverlaysUntracked.run(ctx({
    tracked: ['analysis/annotated/VESSEL_fig3_ischemic_gP-CD31_red.png', 'analysis/measure_vessels.py'],
  }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].file, /^analysis\/annotated\//);
});

test('rendered-overlays-untracked is quiet on scripts plus source images', () => {
  const findings = renderedOverlaysUntracked.run(ctx({
    tracked: [
      'analysis/measure_vessels.py',
      'analysis/results-first-pass.md',
      'references/figures/panels/VESSEL_fig3_ischemic_gP-CD31_red.png',
    ],
  }));
  assert.deepEqual(findings, []);
});

// --- panel-scale-calibration -------------------------------------------------

const MEASURE = 'analysis/measure_vessels.py';
const withTable = (keys) =>
  `UM_PER_BAR = 50.0\nSCALEBAR_PX = {${keys.map((k) => `'${k}': 61`).join(', ')}}\n`;

test('panel-scale-calibration fires on a panel figure with no bar measurement', () => {
  const findings = panelScaleCalibration.run(ctx({
    files: { [MEASURE]: withTable(['fig1']) },
    tracked: [
      'references/figures/panels/VESSEL_fig1_C1_healthy_gP-CD31_red.png',
      'references/figures/panels/VESSEL_fig9_ischemic_gP-CD31_red.png',
    ],
  }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].what, /fig9/);
  assert.equal(findings[0].line, 2);
});

test('panel-scale-calibration is quiet when every panel figure is calibrated', () => {
  const findings = panelScaleCalibration.run(ctx({
    files: { [MEASURE]: withTable(['fig1', 'fig3']) },
    tracked: [
      'references/figures/panels/VESSEL_fig1_C1_healthy_gP-CD31_red.png',
      'references/figures/panels/VESSEL_fig3_ischemic_gP-CD31_red.png',
      // fig7 has panels but no VESSEL_ panel — not in the working dataset.
      'references/figures/panels/fig7_capillaries_gP-CD31.png',
    ],
  }));
  assert.deepEqual(findings, []);
});

// --- locked-metric-fields ----------------------------------------------------

// A metrics dict shaped like the real one, minus whichever fields a case drops.
// Interleaved comments included deliberately: the real dict carries them, and a
// comment between two fields must not hide the field that follows it.
const metricsScript = (fields) => [
  '"""Delivers the professor\'s three asks per image:',
  '  - COUNT : number of branch segments (junction-to-junction pieces)',
  '"""',
  'ARTERY_DIAM_PX = 9.0',
  '',
  'def analyze(rgb, umpp):',
  '    m = dict(area=100 * mask.mean(),',
  '             # scale-invariant, comparable across figures:',
  `             ${fields.map((f) => `${f}=v_${f}`).join(', ')},`,
  '             wp90=round(float(np.percentile(widths, 90)), 1))',
  '    return m, dict(mask=mask, skel=skel)',
].join('\n');

const ALL_LOCKED = ['segments', 'capillary', 'artery', 'length_um', 'length_density'];

test('locked-metric-fields fires when the count unit stops being reported', () => {
  // COUNT re-pointed at connected components: `segments` is gone as a field and
  // survives only in the docstring — a text grep would be satisfied, the check
  // is not, because it reads the metrics dict.
  const findings = lockedMetricFields.run(ctx({
    files: {
      [MEASURE]: metricsScript(['vessels', 'capillary', 'artery', 'length_um', 'length_density']),
    },
  }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].what, /COUNT is locked to branch segments/);
  assert.match(findings[0].what, /no segments field/);
  assert.equal(findings[0].line, 7);
});

test('locked-metric-fields reports each locked ask that lost a field', () => {
  const findings = lockedMetricFields.run(ctx({
    files: { [MEASURE]: metricsScript(['segments', 'capillary', 'length_um']) },
  }));
  assert.deepEqual(findings.map((f) => f.what.split(' is locked')[0]), ['CATEGORIZE', 'MEASURE']);
  assert.match(findings[0].what, /no artery field/);
  assert.match(findings[1].what, /no length_density field/);
});

test('locked-metric-fields is quiet when all three asks are still reported', () => {
  const findings = lockedMetricFields.run(ctx({ files: { [MEASURE]: metricsScript(ALL_LOCKED) } }));
  assert.deepEqual(findings, []);
});

test('locked-metric-fields fires when the metrics dict itself is gone', () => {
  const findings = lockedMetricFields.run(ctx({
    files: { [MEASURE]: 'def analyze(rgb, umpp):\n    return defaultdict(list)\n' },
  }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].what, /no metrics dict found/);
});

let failed = 0;
for (const [name, fn] of cases) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${name}\n     ${e.message}`);
  }
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
