# Methods synthesis — what the literature does, and what we do

> **Accumulating doc.** Every paper that lands in [`references/`](README.md) folds its method here.
> This is the bridge from reading to pipeline work: the per-paper digests hold the detail, this
> holds the *decisions*. Current pipeline: [`analysis/measure_vessels.py`](../analysis/measure_vessels.py).

**Papers folded in so far:** wang-2022, rust-2020.
**Still to fold in:** freitas-andrade-2022, hill-2020, bizou-2026, stefanitsch-2015.

---

## 1. The metric set

Our three locked asks against what the literature reports:

| Our ask | Our field | Rust 2020 | Wang 2022 | Status |
|---|---|---|---|---|
| **MEASURE** — total centerline length | `length_um`, `length_density` (mm/mm²) | **vessel segment length**, reported as mean + max per branch, and as mm/mm² | — (not measured) | **Adopted.** mm/mm² is the shared unit; we report total rather than mean/max. |
| **COUNT** — branch segments | `segments`, `count_density` (per mm²) | **number of branches per mm²** | — | **Adopted**, same unit. |
| **CATEGORIZE** — capillary vs artery by caliber | `capillary`, `artery` | **explicitly declined** ("we did not intent to distinguish between different types of blood vessels") | phalloidin / α-SMA mark artery walls, but no caliber classification | **Ours alone.** No external method to copy; Wang's phalloidin/α-SMA panels are the only available check. |
| *(density)* | `area` (%) | **vascular area fraction** — % non-zero pixels in the binary | **percentage / area fraction** of gP-CD31 | **Adopted.** The one metric all three of us share — the best cross-paper anchor. |
| *(not implemented)* | — | **nearest-neighbour distance** between closest non-zero pixels, in µm | — | **Candidate — recommended.** See §4. |
| *(not applicable)* | — | **pericyte coverage** = pericyte area fraction ÷ vascular area fraction | — | **Rejected for now:** needs a second channel; our panels are single-channel. |

## 2. The processing chain

| Step | Rust 2020 (Fiji) | Ours (Python/scikit-image) | Verdict |
|---|---|---|---|
| Input | TIFF, select ROI | figure-resolution PNG crops | ours is a downgrade forced by the data we have |
| Denoise | **median filter** (radius unstated) | Gaussian σ=1.0 | **worth testing:** median preserves vessel edges better than Gaussian at this scale |
| Binarize | unstated method | red-dominance + Otsu (with a floor) OR'd with **Frangi vesselness** | ours is more aggressive; justified for dim figure crops |
| Gap handling | not mentioned | binary closing (disk 2) + fill holes | ours; fragmentation is our known weak point |
| Skeleton | Fiji *Skeletonize* → *Analyze Skeleton* | `skimage.skeletonize` + spur pruning | equivalent |
| Batch | built into the script | glob over `references/*/figures/panels/VESSEL_*.png` | equivalent |
| Visualization | **grid heatmap of per-square area fraction** | outline-over-original overlays | **complementary, not competing** — see §4 |

**Key structural agreement:** both pipelines are *binarize → skeletonize → count branches → sum
length*. That our independent implementation matches an established published one is the main
reassurance available, given we have no manually-traced ground truth.

## 3. Reference magnitudes — sanity checks, not targets

From Rust 2020 (raw confocal, mouse/human) vs ours (figure-resolution crops, rat/mouse/human):

| Quantity | Rust: adult mouse cortex | Rust: mouse peri-infarct | Rust: human cortex GM | Ours (range across panels) |
|---|---|---|---|---|
| Area fraction | 0.106 (≈10.6%) | 0.060 (≈6.0%) | 0.028 (≈2.8%) | 1.9 – 23.2% |
| Length density (mm/mm²) | 25.5 | 31.9 (intact 57.7) | — | 3.2 – 38.6 |
| Branches per mm² | 311 | 127 (intact 396) | — | 236 – 2870 |
| Nearest distance (µm) | 23.7 | 36.9 (intact 30.3) | — | not computed |

**Read this honestly:**
- **Area fraction and length density land in the right ballpark.** Our human-tissue panels
  (1.9–2.8%) sit almost exactly on Rust's human GM figure of 2.8% — the single best external
  validation we have.
- **Our branch counts are 5–10× too high.** This is the known fragmentation problem restated in
  someone else's units: stain dropouts split one vessel into many segments. Rust's ~300/mm² on
  adult mouse cortex against our ~2000/mm² on comparable panels is the clearest quantitative
  statement of that defect we have, and it is a much sharper signal than "the overlays look
  fragmented". **Treat ~300–400 branches/mm² as the order of magnitude a fixed pipeline should
  reach on healthy adult cortex.**

## 4. Open recommendations

1. **Add nearest-neighbour distance.** Cheap (a distance transform on the existing mask), gives a
   fourth metric directly comparable to published numbers, and Rust's argument for it is good:
   mean density hides *local* avascular gaps, which is exactly what ischemic and developmental
   tissue has. It would also be a **fragmentation-immune** metric — unlike branch count, it does
   not care whether a vessel is split into pieces. That makes it valuable as an independent
   cross-check while count remains untrustworthy.
2. **Try a median filter in place of the Gaussian.** One-line change, matches the published
   pre-processing, and median is the better choice for preserving thin-structure edges.
3. **Use the branch-density gap as the fragmentation acceptance test.** The next segmentation
   iteration should be judged partly on whether count density moves toward a few hundred per mm²
   on healthy adult cortex, not just on whether the overlays look better.
4. **Consider the grid heatmap as a second visualization.** It is not a replacement for the
   outline overlays (which are the agreed style for QA), but a per-square area-fraction heatmap
   answers a different question — *where* is the tissue under-vascularized — which is precisely
   the ischemic-core/penumbra question the project is about.

## 5. Cross-paper cautions

- **Time point flips the sign of the ischemia effect.** Wang (rat, 24 h post-MCAO) finds *more*
  gP-CD31 signal in the ischemic area; Rust (mouse, 3 weeks post-photothrombosis) finds *less*
  vasculature in the border zone. Acute endothelial upregulation and chronic rarefaction are both
  real. **Never generalize our Wang-derived ranking into "ischemia ⇒ more vessels".**
- **Branch count is not monotonic with maturity.** Rust's developmental series peaks at p10 and
  then declines as anastomoses are pruned. More branches ≠ more developed.
- **Marker choice moves the number.** Rust attributes a 40–60% vs ~80% pericyte-coverage
  discrepancy to antibody/epitope differences alone; Wang's whole paper is a demonstration that
  polyclonal vs monoclonal anti-CD31 label visibly different amounts of the same vasculature.
  Any absolute number we report is a number *for that marker*.
- **Section thickness decides whether connectivity means anything.** Rust's human panels are 5 µm
  paraffin sections: vessels appear as isolated cross-sections, so branch and junction counts are
  near-meaningless and only area fraction is reported. Wang's are 80 µm; ours inherit that.
