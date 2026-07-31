## Project: vessel image analysis — start here

This repo detects and quantifies cerebral blood vessels in the gP-CD31 (red) confocal panels
(categorize / count / measure). **Before doing any image work, quantification, or progress
visualization, read [`analysis/WORKING-GUIDE.md`](analysis/WORKING-GUIDE.md)** — it holds the owner's
durable rules for how images are handled and how progress is shown (visual-assertion workflow,
outline-over-original overlay style, the image commit rule, locked metric definitions, scale
calibration). Then read [`analysis/STATUS.md`](analysis/STATUS.md) for current state and the agreed
next step. These are the authoritative working rules for this project — honor them.

The source literature lives in [`references/`](references/README.md), one self-contained folder per
paper: **read the paper's `digest.md`, not the PDF** — the digests exist so the PDFs never have to be
reopened. [`references/METHODS-SYNTHESIS.md`](references/METHODS-SYNTHESIS.md) carries the
cross-paper method decisions. **Adding an article? Follow the `paper-intake` skill.**
