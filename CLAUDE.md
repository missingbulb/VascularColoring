
@.claudinite/CLAUDE.md

> Claudinite self-check: if the `@.claudinite/CLAUDE.md` import above did not resolve (the `.claudinite/` payload is absent — e.g. no `.claudinite/README.md`), the Claudinite harness is **not active** this session. Treat it as not loaded and confirm with the user before substantive work, since a launch-layer hook failure can eat the sync hook's own not-loaded directive.

---

## Project: vessel image analysis — start here

This repo detects and quantifies cerebral blood vessels in the gP-CD31 (red) confocal panels
(categorize / count / measure). **Before doing any image work, quantification, or progress
visualization, read [`analysis/WORKING-GUIDE.md`](analysis/WORKING-GUIDE.md)** — it holds the owner's
durable rules for how images are handled and how progress is shown (visual-assertion workflow,
outline-over-original overlay style, the image commit rule, locked metric definitions, scale
calibration). Then read [`analysis/STATUS.md`](analysis/STATUS.md) for current state and the agreed
next step. These are the authoritative working rules for this project — honor them.
