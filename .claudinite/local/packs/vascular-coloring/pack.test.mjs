// Red-first fixtures for this pack's checks: each rule is shown FIRING on a
// violating input and QUIET on a clean one. Dependency-free — run it with
//   node .claudinite/local/packs/vascular-coloring/pack.test.mjs
import assert from 'node:assert/strict';

import overlayColorContrast from './overlay-color-contrast.mjs';
import renderedOverlaysUntracked from './rendered-overlays-untracked.mjs';
import panelScaleCalibration from './panel-scale-calibration.mjs';
import scaleNumbersMatchCalibration from './scale-numbers-match-calibration.mjs';
import lockedMetricFields from './locked-metric-fields.mjs';
import calibrationSingleSource from './calibration-single-source.mjs';
import renderOutputsGitignored from './render-outputs-gitignored.mjs';

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

// --- calibration-single-source ----------------------------------------------

const ANNOTATE = 'analysis/annotate_overlays.py';
const CALIB_SRC = [
  '"""Vessel quantification.',
  '',
  "Calibration lives here: SCALEBAR_PX = {'fig1': 61} — a docstring quoting the",
  'table documents it, it does not define it.',
  '"""',
  'import os',
  'UM_PER_BAR = 50.0',
  "SCALEBAR_PX = {'fig1': 61, 'fig3': 47}",
].join('\n');

test('calibration-single-source fires on a second calibration table in another script', () => {
  const findings = calibrationSingleSource.run(ctx({
    files: {
      [MEASURE]: CALIB_SRC,
      // The importing script grows its own copy — the drift the rule is about.
      [ANNOTATE]: [
        'from measure_vessels import (segment, prune, umpp_for,',
        '                             ARTERY_DIAM_PX, SRC)',
        '',
        "SCALEBAR_PX = {'fig1': 61, 'fig3': 47, 'fig4': 76}",
      ].join('\n'),
    },
    tracked: [MEASURE, ANNOTATE],
  }));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, ANNOTATE);
  assert.equal(findings[0].line, 4);
  assert.match(findings[0].what, /defines its own SCALEBAR_PX/);
});

test('calibration-single-source fires when the source assigns one name twice', () => {
  const findings = calibrationSingleSource.run(ctx({
    files: { [MEASURE]: `${CALIB_SRC}\n\n# re-measured fig3, old table left above\nSCALEBAR_PX = {'fig1': 61, 'fig3': 44}\n` },
    tracked: [MEASURE],
  }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].what, /SCALEBAR_PX is assigned 2 times/);
  assert.equal(findings[0].line, 11);
});

test('calibration-single-source is quiet when the table is defined once and imported', () => {
  const findings = calibrationSingleSource.run(ctx({
    files: {
      [MEASURE]: CALIB_SRC,
      // An import of the name, a continuation line carrying it, and a keyword
      // argument spelled like an assignment — none of them a definition.
      [ANNOTATE]: [
        'from measure_vessels import (segment, prune, umpp_for,',
        '                             ARTERY_DIAM_PX, SCALEBAR_PX, SRC)',
        '',
        'bar = draw_bar(img,',
        '               UM_PER_BAR=50.0)',
        "# SCALEBAR_PX = {'fig1': 61}   <- kept as a comment while debugging",
      ].join('\n'),
    },
    tracked: [MEASURE, ANNOTATE, 'analysis/WORKING-GUIDE.md'],
  }));
  assert.deepEqual(findings, []);
});

// --- render-outputs-gitignored ----------------------------------------------

const script = (dir) => [
  '#!/usr/bin/env python3',
  '"""Writes PNGs to analysis/reports/ (gitignored)."""',
  'import os',
  'HERE = os.path.dirname(os.path.abspath(__file__))',
  `OUT = os.path.join(HERE, '${dir}')`,
  "SRC = os.path.normpath(os.path.join(HERE, '..', 'references'))",
  '',
  'def main():',
  '    os.makedirs(OUT, exist_ok=True)',
  "    canvas.save(os.path.join(OUT, name + '.png'))",
].join('\n');

const GITIGNORE = ['# generated overlays', '/analysis/overlays/', '/analysis/annotated/', '__pycache__/'].join('\n');

test('render-outputs-gitignored fires on a new output directory nobody ignored', () => {
  const findings = renderOutputsGitignored.run(ctx({
    files: { [ANNOTATE]: script('reports'), '.gitignore': GITIGNORE },
    tracked: [ANNOTATE, '.gitignore'],
  }));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, ANNOTATE);
  assert.equal(findings[0].line, 9);
  assert.match(findings[0].what, /analysis\/reports\/, which no .gitignore entry covers/);
});

test('render-outputs-gitignored fires when an entry is un-ignored by a later negation', () => {
  const findings = renderOutputsGitignored.run(ctx({
    files: {
      [ANNOTATE]: script('annotated'),
      '.gitignore': `${GITIGNORE}\n!/analysis/annotated/\n`,
    },
    tracked: [ANNOTATE, '.gitignore'],
  }));
  assert.equal(findings.length, 1);
  assert.match(findings[0].what, /analysis\/annotated\//);
});

test('render-outputs-gitignored is quiet when every render directory is ignored', () => {
  const findings = renderOutputsGitignored.run(ctx({
    files: {
      [ANNOTATE]: script('annotated'),
      [MEASURE]: script('overlays'),
      '.gitignore': GITIGNORE,
      // A source tree the scripts only read from is not an output directory.
      'references/figures/panels/expected-results.md': '# expectations\n',
    },
    tracked: [ANNOTATE, MEASURE, '.gitignore', 'references/figures/panels/expected-results.md'],
  }));
  assert.deepEqual(findings, []);
});

test('render-outputs-gitignored honours a .gitignore beside the scripts', () => {
  const findings = renderOutputsGitignored.run(ctx({
    files: {
      [ANNOTATE]: script('annotated'),
      '.gitignore': '__pycache__/\n',
      'analysis/.gitignore': 'annotated/\n',
    },
    tracked: [ANNOTATE, '.gitignore', 'analysis/.gitignore'],
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
