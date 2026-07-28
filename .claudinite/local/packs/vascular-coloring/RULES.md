# Vessel-image quantification — the judgment core

This project measures fluorescently-labelled cerebral vessels in the **gP-CD31 (red) confocal
panels**: categorize / count / measure. What follows is only the judgment a check cannot carry.
The enforced rules live in this pack's checks; the full working detail (overlay style knobs,
file map, calibration numbers) stays in [`analysis/WORKING-GUIDE.md`](../../../../analysis/WORKING-GUIDE.md),
and current state in [`analysis/STATUS.md`](../../../../analysis/STATUS.md).

## Never validate the pipeline against itself

Expectations come from **looking at the images** — they live in
[`expected-results.md`](../../../../references/figures/panels/expected-results.md) and are what the
automated pipeline is judged *against*. Running the pipeline and presenting its own output as the
expected result is circular and does not count as evidence. Numbers are never invented.

## Progress is a visual assertion, not a table

An extraction change is discussed by **overlaying the result on the image** and making explicit,
checkable claims about it ("this outline is what I call a vessel; that red vessel has no outline —
the baseline missed it"). The overlay is a QA tool first: **show where the method breaks** — missed
faint vessels, fragmentation, thick-vessel handling — rather than the fields where it looks good.
The procedure is in [vessel-overlay-review](skills/vessel-overlay-review/SKILL.md).

## The metric definitions are locked

COUNT = branch **segments** (junction-to-junction / junction-to-tip — *not* connected components,
which are reported alongside), CATEGORIZE = **caliber**, MEASURE = **total centerline length**.
That the script keeps reporting all three is enforced (`locked-metric-fields`); the judgment is that
re-defining one is an owner call, because it changes every recorded number silently — the column
keeps its name while the quantity under it moves, so the old numbers must be re-measured, never
re-labelled.

## Raw length is not comparable across figures

Each figure is at a different zoom and carries its own printed 50 µm bar, so px→µm differs per
figure. Any cross-region or cross-figure comparison uses **length density (mm/mm²) or area %** —
never raw µm. This is why every working figure must stay calibrated (`panel-scale-calibration`).
The measured bar widths live in exactly one place, `SCALEBAR_PX` in `analysis/measure_vessels.py`
(`scale-numbers-match-calibration` holds every µm/px number quoted in the docs to it).

## Say which numbers are trustworthy

Report the current trust boundary with the numbers, not separately from them: area %, length
density and the µm calibration are usable; per-segment **count** is still inflated by
fragmentation, absolute length comes from figure-resolution crops, and the capillary/artery split
is one diameter threshold (`ARTERY_DIAM_PX`). When a number is not yet trustworthy, say so where it
is quoted.
