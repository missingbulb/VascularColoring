# Status — vessel quantification

> Current state and next step. Working rules & visualization conventions: [WORKING-GUIDE.md](WORKING-GUIDE.md).
> Full measured numbers: [results-first-pass.md](results-first-pass.md).

## Where we are — first pass complete

- **Pipeline** (`measure_vessels.py`): red-dominance segmentation → gap-bridge → skeletonize → spur-prune
  → branch graph, producing all three metrics for the 16 `VESSEL_*.png` panels, calibrated to µm from
  the 50 µm scale bars.
- **Overlays** (`annotate_overlays.py`): presentation figures in the agreed outline-over-original style
  (thin, semi-transparent contours; arrows with lengths; artery diameter; scale bar; totals banner).
- **Results** (`results-first-pass.md`): region means for **length density and area %** rank
  **ischemic ≈ penumbra > contralateral ≈ normal** — matching the paper's biology and the visual
  expectations in `expected-results.md`.

## Trustworthy vs. not (be honest about this)

- **Trustworthy:** area %, length density (ranking + rough magnitude), the µm calibration, and the
  capillary/artery split as a first cut.
- **Not yet trustworthy:** per-segment **COUNT** — fragmentation inflates it, and count density does
  *not* yet rank cleanly (dim `normal` fields come out spuriously high). Also: absolute length (these
  are downsampled figure crops, not raw confocal) and the exact artery threshold.

## Known limitations

1. **Under-detection of faint vessels** in dim fields — visible on the overlays as red vessels with no
   outline (clearest in `fig4_normal` / `contralateral`).
2. **Fragmentation** — stain dropouts split one vessel into several segments, inflating segment/endpoint
   counts and slightly shortening length.
3. **Caliber split is a single diameter threshold** (`ARTERY_DIAM_PX = 9 px`); borderline vessels flip.
4. **Figure-resolution crops** — recompute absolute length on raw `.oib` data for publication numbers.

## Literature review done — six papers digested

[`references/`](../references/README.md) now holds a self-contained digest, described figures and
cropped panels for **six** source papers, plus a cross-paper
[`METHODS-SYNTHESIS.md`](../references/METHODS-SYNTHESIS.md). Intake is repeatable via the
`paper-intake` skill. What it changed:

- **The working dataset grew from 16 to 42 panels** (wang-2022 ×16, rust-2020 ×20,
  freitas-andrade-2022 ×6). Three of the six papers contribute no panels — multi-channel merges
  or a different modality — and each digest says so explicitly rather than forcing them in.
- **We now have external ground truth.** Freitas-Andrade Fig 9 prints the authors' own density,
  branching and tortuosity on three images. Our pipeline reproduces their **ranking exactly** and
  agrees on relative counts to **±9%**; the sparse dim panel is our clear worst case. Figures 3,
  8 and 13 add reference masks and skeletons — an answer key that is not our own output.
- **The COUNT problem is now quantified, by three independent papers.** Rust (~311 branches/mm²
  adult mouse cortex), Hill (458 vessel profiles/mm²) and Freitas-Andrade all put our absolute
  counts **~5–8× too high**. Target: a few hundred per mm² on healthy adult cortex.
- **CATEGORIZE now has an external anchor, and it says our threshold is wrong.** Stefanitsch
  measures mean CD31⁺ vessel diameter at 6.03 µm and mean ASMA⁺ artery diameter at 22.9 µm. Our
  `ARTERY_DIAM_PX = 9` works out to **5.9 µm** on the fig4/5/6 panels — at the mean of *all*
  vessels, so ordinary capillaries are being called arteries.

## Next step (recommended, supersedes the earlier plan)

The earlier agreed step — improve segmentation sensitivity and reconnect fragments — still stands
and is still the main event. The review adds a cheaper prerequisite and sharper acceptance tests:

1. **First, put the scale-dependent constants in µm.** `σ=1.0`, `min_len=8`, `<20 px`, `disk(2)`
   and `ARTERY_DIAM_PX=9` are all pixel constants applied across panels spanning 0.24–1.35 µm/px,
   so each means something different per figure. `umpp_for()` already exists. Small change; it is
   what makes every comparison below meaningful.
2. **Then the segmentation work**, judged by three tests instead of one: (a) the un-outlined
   vessels get captured on the overlay view; (b) **count density falls toward a few hundred per
   mm²** on healthy adult cortex; (c) our mask and skeleton on the Freitas-Andrade originals look
   like their published mask and skeleton.
3. **Fix the caliber threshold** using Stefanitsch's published bins (<5 / 5–10 / >10 µm), and
   consider reporting the three-bin distribution rather than a binary split. Still worth the
   external check against Wang's phalloidin / α-SMA panels.

Further candidates, with rationale, in [`METHODS-SYNTHESIS.md`](../references/METHODS-SYNTHESIS.md) §4:
nearest-neighbour distance (fragmentation-immune, so trustworthy while count is not), a grid
heatmap of per-square area fraction (two papers converge on it; answers *where* tissue is
under-vascularized), and the published segmentation choices (adaptive local threshold, median
filter, iterative smallest-first pruning).

## Reproduce

```
python3 analysis/measure_vessels.py              # per-image + region metrics table
python3 analysis/measure_vessels.py --overlays   # 3-panel debug overlays -> analysis/overlays/
python3 analysis/annotate_overlays.py            # presentation overlays -> analysis/annotated/
```

Setup: `pip install -r requirements.txt` (numpy, scipy, scikit-image, Pillow). Rendered PNG dirs are gitignored — regenerate.
