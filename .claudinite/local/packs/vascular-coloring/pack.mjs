import overlayColorContrast from './overlay-color-contrast.mjs';
import renderedOverlaysUntracked from './rendered-overlays-untracked.mjs';
import panelScaleCalibration from './panel-scale-calibration.mjs';
import scaleNumbersMatchCalibration from './scale-numbers-match-calibration.mjs';
import lockedMetricFields from './locked-metric-fields.mjs';
import calibrationSingleSource from './calibration-single-source.mjs';
import renderOutputsGitignored from './render-outputs-gitignored.mjs';

// The project's own pack: the vessel-image quantification domain this repo works
// in - gP-CD31 red-channel confocal panels measured for categorize / count /
// measure. Declared by hand as `local/vascular-coloring`; detect/marker stay null.
//
// Check modules here stay dependency-free (plain finding objects, no engine
// import) so the pack loads without the gitignored shared mount.
export default {
  id: 'vascular-coloring',
  ruleRoutingGuidance: {
    belongs: 'vessel-image quantification — overlay appearance, render outputs, and the calibration that makes a number micrometres',
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
  ],
  skills: ['vessel-overlay-review', 'paper-intake'],
};
