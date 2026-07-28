// Red-first fixtures for this pack's checks: each rule is shown FIRING on a
// violating input and QUIET on a clean one. Dependency-free — run it with
//   node .claudinite/local/packs/vascular-coloring/pack.test.mjs
import assert from 'node:assert/strict';

import overlayColorContrast from './overlay-color-contrast.mjs';
import renderedOverlaysUntracked from './rendered-overlays-untracked.mjs';
import panelScaleCalibration from './panel-scale-calibration.mjs';
import scaleNumbersMatchCalibration from './scale-numbers-match-calibration.mjs';

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

// --- scale-numbers-match-calibration ----------------------------------------

// The one calibration source: 50 um / bar width in px -> fig1 0.820, fig3 1.064.
const CALIB = "UM_PER_BAR = 50.0\nSCALEBAR_PX = {'fig1': 61, 'fig3': 47}\n";
const DOC = 'analysis/WORKING-GUIDE.md';
const RESULTS = 'analysis/results-first-pass.md';
const barTable = (barPx, umpp) => [
  '| figure(s) | 50 µm bar | **µm/px** | panel field of view |',
  '|---|---:|---:|---|',
  `| fig1 | ${barPx} px | **${umpp}** | ~301 µm |`,
  // A panel-level row in the same table: not a figure-level scale claim, so its
  // crop width and printed resolution are none of this rule's business.
  '| fig1 crop A2 | 380 px | **0.15** | as printed |',
].join('\n');

test('scale-numbers-match-calibration fires on a stale µm/px quoted in prose', () => {
  const findings = scaleNumbersMatchCalibration.run(ctx({
    files: {
      [MEASURE]: CALIB,
      [DOC]: 'px→µm is calibrated from it (fig1 = 0.820, fig3 = 1.070 µm/px).\n',
    },
    tracked: [MEASURE, DOC],
  }));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, DOC);
  assert.equal(findings[0].line, 1);
  assert.match(findings[0].what, /fig3.*1\.070.*1\.064/);
});

test('scale-numbers-match-calibration fires on a stale bar width in a table column', () => {
  const findings = scaleNumbersMatchCalibration.run(ctx({
    files: { [MEASURE]: CALIB, [RESULTS]: `${barTable(59, '0.820')}\n` },
    tracked: [MEASURE, RESULTS],
  }));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 3);
  assert.match(findings[0].what, /scale bar is quoted as 59 px but SCALEBAR_PX says 61/);
});

test('scale-numbers-match-calibration is quiet when every quoted number agrees', () => {
  const findings = scaleNumbersMatchCalibration.run(ctx({
    files: {
      [MEASURE]: CALIB,
      // Coarser precision is still the same number (0.82 == 50/61 to 2 dp);
      // the second paragraph assigns numbers to figures with no scale unit in
      // sight — a per-figure score is not a scale claim.
      [DOC]: 'calibrated from it (fig1 = 0.82, fig3 = 1.064 µm/px — SCALEBAR_PX).\n'
        + '\nRecall on the tuning sweep: fig1 = 0.35, fig3 = 0.41.\n',
      [RESULTS]: [
        barTable(61, '0.820'),
        '',
        // Per-panel metrics: decimals next to figure-prefixed panel names, in a
        // block that DOES say µm/px — a grep would cry wolf here, the
        // column-scoped parse must not (no µm/px or bar column in this table).
        'Lengths below are converted with each figure’s µm/px.',
        '| panel | len_um | len_dens | area% |',
        '|---|---:|---:|---:|',
        '| fig1_C1_healthy | 2145 | 23.6 | 14.2 |',
        '| fig3_ischemic | 2287 | 23.9 | 18.1 |',
      ].join('\n'),
    },
    tracked: [MEASURE, DOC, RESULTS],
  }));
  assert.deepEqual(findings, []);
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
