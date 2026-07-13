# Working guide — vessel image analysis (rules & conventions)

> **Read this before doing any image work or showing progress on this project.** It captures how the
> project owner wants images handled and how progress is visualized. These are durable rules, not a
> status report — for current state and next steps see [STATUS.md](STATUS.md).

## Project in one line

Detect and quantify the fluorescently-labeled cerebral blood vessels in the **gP-CD31 (red) confocal
panels** from Wang et al. 2022. The professor's three asks: **categorize, count, measure (length)**.
Biology + imaging numbers: [`references/wang-2022-cd31-vascular-network.md`](../references/wang-2022-cd31-vascular-network.md).
Working dataset: the **16 `references/figures/panels/VESSEL_*.png`** (isolated red gP-CD31 channel).

## How the owner wants to work on images

1. **Expected results come from real visual inspection — "use your LLM might, not hard-coded."**
   When establishing what a good result looks like, actually *look* at the images and reason about
   them. Never invent/fabricate numbers, and never run the analysis pipeline and present its own
   output as if it were ground truth — that is circular. The visual, LLM-derived expectations live in
   [`references/figures/panels/expected-results.md`](../references/figures/panels/expected-results.md)
   and are the reference the automated pipeline is judged against.

2. **We converse on visual assertions.** Progress is discussed by *overlaying the extracted data on
   the images* and reacting to what we see. Whenever you propose or revise the extraction, produce a
   visual overlay and make explicit, checkable claims ("this outline = what I call a vessel; that red
   vessel has no outline = the baseline missed it").

3. **Be honest about failure modes.** The overlays are QA tools first. Show where the method breaks
   (missed faint vessels, fragmentation, thick-vessel handling); do not hide it or over-claim.

4. **Metric definitions (locked):**
   - **COUNT = branch segments** (junction-to-junction / junction-to-tip pieces). Junctions and
     connected-vessel count are also reported, but the *segment* is the primary count unit.
   - **CATEGORIZE = vessel caliber**: capillary vs penetrating artery, by centerline diameter.
   - **MEASURE = total centerline length**; report both raw µm and the scale-invariant density.

5. **Real units & cross-figure comparison.** Every figure prints a **50 µm scale bar**; px→µm is
   calibrated from it (fig1 = 0.820, fig3 = 1.064, fig4/5/6 = 0.658 µm/px — `SCALEBAR_PX` in
   `measure_vessels.py`). The figures are at **different zoom**, so **raw length is NOT comparable
   across figures** — use **length density (mm/mm²)** and **area %** for any cross-region/cross-figure
   comparison.

6. **Commit rule for images.** Commit image files **only if** they come from real data, or we agree
   they are valuable as progress or ground truth. In practice:
   - **Rendered overlay PNGs are gitignored** (`analysis/overlays/`, `analysis/annotated/`) —
     regenerate them from the scripts; do not commit them without explicit agreement.
   - **Commit the scripts and the derived numeric results** (the markdown tables) — those are the
     tracked progress.

## Visualization conventions (how we show progress)

The annotated overlay is the standard way we look at progress. **Source of truth:**
[`annotate_overlays.py`](annotate_overlays.py). Regenerate:
`python3 analysis/annotate_overlays.py [name-substring ...]` → writes to `analysis/annotated/` (gitignored).

The owner iterated to this exact style — keep it:

- **Overlay on the ORIGINAL image at full brightness.** Do not dim the original.
- **Highlight = a slim outline that circles the detected thing — never a color fill.** "Don't add a
  layer of pixels over the thing you want to highlight; make it a very slim boundary."
- **Lines are thin and semi-transparent** so the original signal reads through them. Contours are
  drawn at *display* resolution (1 px, so upscaling doesn't fatten them) and alpha-blended (~0.5).
  Arrows and junction rings are drawn on a semi-transparent overlay (~0.4–0.7 alpha), 1 px.
- **Colors, chosen to contrast with the red signal:** capillary outline = **cyan**, artery outline =
  **green**, junction = small **magenta** hollow ring. **Avoid red for overlays** (it disappears on
  the red vessels).
- **Arrows + labels:** point an arrow at representative measured vessels and write the **length in
  µm**; for an example artery, write its **diameter**. Labels stay opaque/readable.
- **Drawn 50 µm scale bar** inside the image, and a **totals banner along the bottom**: segment count
  (capillary/artery split), total length + density, junction count, area %.
- **Tuning knobs** (in `annotate_overlays.py`): `CONTOUR_A` (contour opacity), `ARROW_A` / `RING_A`
  (arrow/ring alpha), `SC` (render scale), `ARTERY_DIAM_PX` (caliber threshold, in `measure_vessels.py`).

## File map

| Path | What |
|---|---|
| `references/wang-2022-cd31-vascular-network.md` | Self-contained paper digest (biology, imaging params, why this dataset). |
| `references/figures/` + `panels/` | Full figures and cropped panels; `VESSEL_*.png` = the 16-image working dataset; `panels/README.md` = inventory. |
| `references/figures/panels/expected-results.md` | Visual (LLM) expected results — the validation reference. |
| `analysis/measure_vessels.py` | Extraction + metrics (categorize/count/measure). `--overlays` writes a 3-panel debug view. |
| `analysis/annotate_overlays.py` | Presentation overlays in the style above. |
| `analysis/results-first-pass.md` | Measured results, calibration, limitations. |
| `analysis/STATUS.md` | Current state and agreed next step. |

Setup: `pip install -r requirements.txt` (numpy, scipy, scikit-image, Pillow).
