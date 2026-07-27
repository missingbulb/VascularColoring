import overlayColorContrast from './overlay-color-contrast.mjs';
import renderedOverlaysUntracked from './rendered-overlays-untracked.mjs';
import panelScaleCalibration from './panel-scale-calibration.mjs';
import lockedMetricFields from './locked-metric-fields.mjs';

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
// render, and what has to stay calibrated for a number to mean micrometres.
// Those are the three checks; RULES.md keeps only the judgment that no check can
// carry, and the visual-assertion procedure rides the pack's own skill —
// except that the locked metric definitions do leave one static signature: the
// extraction script must keep reporting all three asks' fields, so that is a
// check too (`locked-metric-fields`).
//
// Check modules here stay dependency-free (plain finding objects, no engine
// import) so the pack loads without the gitignored shared mount.
export default {
  id: 'vascular-coloring',
  detect: null,
  marker: null,
  prose: 'RULES.md',
  rules: [overlayColorContrast, renderedOverlaysUntracked, panelScaleCalibration, lockedMetricFields],
};
