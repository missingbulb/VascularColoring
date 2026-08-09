import overlayColorContrast from './overlay-color-contrast.mjs';
import renderedOverlaysUntracked from './rendered-overlays-untracked.mjs';
import panelScaleCalibration from './panel-scale-calibration.mjs';
import scaleNumbersMatchCalibration from './scale-numbers-match-calibration.mjs';
import lockedMetricFields from './locked-metric-fields.mjs';
import calibrationSingleSource from './calibration-single-source.mjs';
import renderOutputsGitignored from './render-outputs-gitignored.mjs';
import paperFolderLayout from './paper-folder-layout.mjs';
import paperIndexedInReferences from './paper-indexed-in-references.mjs';

// The project's own pack: the vessel-image quantification domain this repo works
// in — fluorescence (gP-CD31 red channel) confocal panels measured for
// categorize / count / measure. Declared by hand as `local/vascular-coloring`
// (never fingerprinted or seeded: detect/marker stay null).
//
// The canon covers the surrounding facets already — `research-project` owns the
// class (algorithm over similarly-formatted inputs, scored against ground truth,
// improved in reviewable iterations), `basics`/`tidy-repo`/`grow_with_claudinite`
// the working lifecycle. What none of them home is this project's imaging
// specifics: what the overlay may look like, what may be committed out of a
// render, what has to stay calibrated for a number to mean micrometres, and that
// every µm/px number quoted in the docs still equals that one calibration table.
// Those are the checks; RULES.md keeps only the judgment that no check can
// carry, and the visual-assertion procedure rides the pack's own skill —
// except that the locked metric definitions do leave one static signature: the
// extraction script must keep reporting all three asks' fields, so that is a
// check too (`locked-metric-fields`). The single-source lines are checks for the
// same reason: the calibration must stay defined in exactly one file
// (`calibration-single-source`), and every directory a script renders into must
// stay ignored by git (`render-outputs-gitignored`).
//
// The source literature is the other half of the domain, and the two parts of
// intake that leave a static signature are checks rather than skill prose: a
// paper folder names its article and carries the PDF under that same slug
// (`paper-folder-layout`), and it has a row in the references index that links
// its digest (`paper-indexed-in-references`). What stays in the paper-intake
// skill is the judgment — what to read, what to transcribe, what to admit is
// weak.
//
// Check modules here stay dependency-free (plain finding objects, no engine
// import) so the pack loads without the gitignored shared mount.
export default {
  id: 'vascular-coloring',
  ruleRoutingGuidance: {
    belongs: 'vessel-image quantification — overlay appearance, render outputs, the calibration behind a micrometre, and the source-paper library layout',
    excludes: 'the research-project class and the working lifecycle — those are canon packs',
  },
  detect: null,
  marker: null,
  prose: 'RULES.md',
  worldRules: [
    overlayColorContrast,
    renderedOverlaysUntracked,
    panelScaleCalibration,
    scaleNumbersMatchCalibration,
    lockedMetricFields,
    calibrationSingleSource,
    renderOutputsGitignored,
    paperFolderLayout,
    paperIndexedInReferences,
  ],
  skills: ['vessel-overlay-review', 'paper-intake'],
};
