# Vessel-image quantification — the judgment core

This project measures fluorescently-labelled cerebral vessels in the **gP-CD31 (red) confocal
panels**: categorize / count / measure. What follows is only the judgment a check cannot carry.
The enforced rules live in this pack's checks; the full working detail (overlay style knobs,
file map, calibration numbers) stays in [`analysis/WORKING-GUIDE.md`](../../../../analysis/WORKING-GUIDE.md),
and current state in [`analysis/STATUS.md`](../../../../analysis/STATUS.md).

- **Judging the extraction pipeline's output** — judge it against the expectations drawn from
  **looking at the images**, recorded in
  [`expected-results.md`](../../../../references/wang-2022-cd31-vascular-network/figures/panels/expected-results.md);
  running the pipeline and presenting its own output as the expected result is circular and does
  not count as evidence. (never-self-validate)

- **Discussing an extraction change** — show progress as a visual assertion, **overlaying the
  result on the image** rather than tabling it, checked against what it actually misses here:
  faint vessels, fragmentation, thick-vessel handling. The procedure is in
  [vessel-overlay-review](skills/vessel-overlay-review/SKILL.md). (progress-visual-assertion)

- **Defining, computing or reporting a metric** — the definitions are locked: COUNT = branch
  **segments** (junction-to-junction / junction-to-tip — *not* connected components, which are
  reported alongside), CATEGORIZE = **caliber**, MEASURE = **total centerline length**; that the
  script keeps reporting all three is enforced (`locked-metric-fields`).
  (locked-metric-definitions)

- **Comparing or rolling up numbers across papers** — group the rollup per paper and never merge
  it into one mean: scale differs by more than 5× across papers, and species, injury model, marker
  and magnification all change between them too. (per-paper-rollup)

- **Adding a paper to `references/`, or judging its intake done** — a paper is finished when the
  PDF is redundant; the procedure is in [paper-intake](skills/paper-intake/SKILL.md).
  (paper-finished-pdf-redundant)

- **Quoting a number from this pipeline** — say which numbers are trustworthy: area %, length
  density and the µm calibration are usable; per-segment **count** is still inflated by
  fragmentation, absolute length comes from figure-resolution crops, and the capillary/artery split
  is one diameter threshold (`ARTERY_DIAM_PX`). (trustworthy-numbers)
