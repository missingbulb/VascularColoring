# References — source papers

One folder per paper. Each folder is **self-contained**: the original PDF, a digest written so the
PDF never has to be reopened, and every figure extracted and described.

```
references/
  README.md                  <- you are here: the paper index
  METHODS-SYNTHESIS.md       <- cross-paper: what the literature does vs what we adopted
  _tools/extract_pdf_assets.py
  <paper-slug>/
    <paper-slug>.pdf         the original article
    digest.md                self-contained digest (no need to reopen the PDF)
    figures/
      README.md              every figure, described, with the images inline
      crop_panels.py         reproducible sub-panel crop
      figN_<name>.png        full figures at native resolution
      panels/
        README.md            sub-panel inventory + caveats
        VESSEL_*.png         isolated vessel channel = working-dataset inputs
        <other>.png          companion channels / context
```

**Slug format:** `<first-author>-<year>-<short-topic>`, lowercase, hyphenated.

**Adding a paper?** Follow the `paper-intake` skill
([`.claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md`](../.claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md)).
It is the repeatable protocol these folders were built with.

---

## Papers

| Paper | What it gives us | Panels in the working dataset |
|---|---|---|
| [**wang-2022-cd31-vascular-network**](wang-2022-cd31-vascular-network/digest.md) — Wang et al., *Sci Rep* 12:22288. gP-CD31 / phalloidin / α-SMA in normal and ischemic **rat** brain. | **The source of the primary images** and of the biology: which marker labels what, the four cortical regions, why gP-CD31 beats mM-CD31. Published only intensity + area %. | **16** (the primary set) |
| [**rust-2020-fiji-vascular-analysis**](rust-2020-fiji-vascular-analysis/digest.md) — Rust et al., *Front Neurosci* 14:244. Automated **Fiji** analysis of vascular growth, maturation and injury. | **The methods reference.** Defines area fraction / length / branching / nearest-neighbour distance + pericyte coverage, with real reference magnitudes for mouse development, mouse stroke and human AD. | **20** |
| [**freitas-andrade-2022-pyvane-endothelial-networks**](freitas-andrade-2022-pyvane-endothelial-networks/digest.md) — Freitas-Andrade et al., *Neurophotonics* 9(3):031916. | *(pending intake)* | — |
| [**hill-2020-aging-mra-cerebrovascular-loss**](hill-2020-aging-mra-cerebrovascular-loss/digest.md) — Hill et al., *Front Aging Neurosci* 12:585218. | *(pending intake)* | — |
| [**bizou-2026-nvu-angiogenic-programs**](bizou-2026-nvu-angiogenic-programs/digest.md) — Bizou et al., *Nat Commun*. | *(pending intake)* | — |
| [**stefanitsch-2015-tpa-cerebrovascular-tree**](stefanitsch-2015-tpa-cerebrovascular-tree/digest.md) — Stefanitsch et al., *Front Cell Neurosci* 9:456. | *(pending intake)* | — |

---

## What goes in the working dataset

A panel earns the `VESSEL_` prefix — and so gets picked up by
[`analysis/measure_vessels.py`](../analysis/measure_vessels.py) — when it is an **isolated
single-channel vessel image**: vessels bright on a dark background, no second marker mixed in.
Merged overlays, co-stain channels, 3-D renders and schematics keep a plain name and stay as
context.

Two hard requirements come with the prefix:

1. **A calibration entry.** Either a measured `SCALEBAR_PX` prefix, or an explicit `UNCALIBRATED`
   declaration with the reason. The `panel-scale-calibration` check enforces this.
2. **A unique prefix.** The Wang panels are the incumbents and keep bare `figN` keys; **every paper
   added since carries a paper tag** (`rust20fig1_…`) so calibration prefixes cannot collide.

**Different papers are never averaged together.** `measure_vessels.py` groups its region rollup by
paper, because species, injury model, marker and magnification all differ across the corpus.
