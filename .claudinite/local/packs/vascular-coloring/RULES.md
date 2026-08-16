# Vessel-image quantification — the judgment core

This project measures fluorescently-labelled cerebral vessels in the **gP-CD31 (red) confocal
panels**: categorize / count / measure. What follows is only the judgment a check cannot carry.
The enforced rules live in this pack's checks; the full working detail (overlay style knobs,
file map, calibration numbers) stays in [`analysis/WORKING-GUIDE.md`](../../../../analysis/WORKING-GUIDE.md),
and current state in [`analysis/STATUS.md`](../../../../analysis/STATUS.md).

## Never validate the pipeline against itself

Expectations come from **looking at the images** — they live in
[`expected-results.md`](../../../../references/wang-2022-cd31-vascular-network/figures/panels/expected-results.md) and are what the
automated pipeline is judged *against*. Running the pipeline and presenting its own output as the
expected result is circular and does not count as evidence.

## Progress is a visual assertion, not a table

An extraction change is discussed by **overlaying the result on the image**, checked against what it
actually misses here — faint vessels, fragmentation, thick-vessel handling. The procedure is in
[vessel-overlay-review](skills/vessel-overlay-review/SKILL.md).

## The metric definitions are locked

COUNT = branch **segments** (junction-to-junction / junction-to-tip — *not* connected components,
which are reported alongside), CATEGORIZE = **caliber**, MEASURE = **total centerline length**.
That the script keeps reporting all three is enforced (`locked-metric-fields`).

## Raw length is not comparable across figures

Each figure is at a different zoom and carries its own printed scale bar, so px→µm differs per
figure — and across papers it differs by more than 5×. Any cross-region or cross-figure comparison
uses **length density (mm/mm²) or area %** — never raw µm, and **never a mean that spans two
papers**: species, injury model, marker and magnification all change between them, which is why the
rollup is grouped per paper. This is why every working panel must stay calibrated
(`panel-scale-calibration`).

A bar is **measured off the panel**. A figure that draws no bar goes in `UNCALIBRATED` **with the
reason**, reporting area % and pixels only. The single copy is `SCALEBAR_PX` in
`analysis/measure_vessels.py` (`calibration-single-source` for code, `scale-numbers-match-calibration`
for the numbers quoted in the docs).

## A paper is finished when the PDF is redundant

The procedure is in [paper-intake](skills/paper-intake/SKILL.md).

## Say which numbers are trustworthy

Area %, length density and the µm calibration are usable; per-segment **count** is still inflated by
fragmentation, absolute length comes from figure-resolution crops, and the capillary/artery split
is one diameter threshold (`ARTERY_DIAM_PX`). When a number is not yet trustworthy, say so where it
is quoted.
