# Reference note — Wang et al. 2022, CD31/phalloidin/α-SMA vascular labeling of rat brain

> Self-contained digest of the source paper for the VascularColoring project. Everything the
> project needs is captured here + in `figures/`; **no need to reopen the PDF**.

- **Full title:** *The immunolocalization of cluster of differentiation 31, phalloidin and alpha
  smooth muscle actin on vascular network of normal and ischemic rat brain*
- **Authors:** Jia Wang, Yating Guo, Dongsheng Xu, Jingjing Cui, Yuqing Wang, Yuxin Su, Yihan Liu,
  Yi Shen, Xianghong Jing, Wanzhu Bai (Institute of Acupuncture and Moxibustion, China Academy of
  Chinese Medical Sciences, Beijing).
- **Venue / id:** *Scientific Reports* (2022) 12:22288. DOI: 10.1038/s41598-022-26831-6. Open access.

---

## Why this paper matters to *our* task

Our task (from the professor): **detect the fluorescently-labeled cerebral blood vessels and quantify
them — number, length, etc.** This paper is the *example dataset / imaging protocol* those vessel
images come from. The professor pointed us at specific panels — **all of them are the isolated
single vessel channel** (goat-polyclonal anti-CD31, shown in **red**), i.e. the clean inputs a
segmentation/quantification pipeline should run on:

| Professor's pointer | What the panel actually is | Region |
|---|---|---|
| **Fig 1 – C1** | isolated gP-CD31 (red) vessel channel, healthy cortex | normal |
| **Fig 3 – B2** | isolated gP-CD31 (red) vessel channel | ischemic area |
| **Fig 3 – C2** | isolated gP-CD31 (red) vessel channel | ischemic penumbra |
| **Fig 3 – D2** | isolated gP-CD31 (red) vessel channel | contralateral |
| **Fig 4 – A2** | isolated gP-CD31 (red) vessel channel | normal |
| **Fig 4 – B2** | isolated gP-CD31 (red) vessel channel | ischemic area |
| **Fig 4 – C2** | isolated gP-CD31 (red) vessel channel | ischemic penumbra |
| **Fig 4 – D2** | isolated gP-CD31 (red) vessel channel | contralateral |

**Takeaway for the pipeline:** the target image is a **2D confocal maximum-projection / slice of the
red gP-CD31 channel** showing a capillary network as bright curvilinear structures on a dark
background (see `figures/fig1_gP-CD31_Nissl_healthy.png` panel C1 for the cleanest example). The
`...2` panels are the vessels alone; the `...1` panels overlay vessels + neurons (Nissl green, or
DAPI blue nuclei); the `...3` panels are the *other* marker; the `...4`/`...5` panels are 3-D
reconstructions. **For detecting/counting/measuring vessels, use the red channel only.**

---

## The biological markers (what "colors" the vessels)

The study compares four vascular labels. Only the first is the general-purpose vessel marker we care
about; the rest characterize vessel *walls* (arteries), not the capillary network.

- **gP-CD31 (goat polyclonal anti-CD31)** — the winner. Labels endothelial cells → marks the **whole
  cerebral capillary network** (the branching mesh) in both healthy and ischemic tissue. Shown in
  **red** (secondary: donkey anti-goat AF594). **This is the channel to segment.**
- **mM-CD31 (mouse monoclonal anti-CD31)** — labels capillaries **only in the ischemic region**;
  sparse/absent elsewhere. Less useful as a general vessel marker. Shown in **green** (AF488).
- **Phalloidin** — binds filamentous actin; labels the **wall of the larger cortical *penetrating
  arteries*** (smooth muscle / endothelium), barely labels capillaries. Green (Pha488) or far-red
  (Pha647).
- **α-SMA (alpha smooth muscle actin)** — labels smooth muscle on **penetrating-artery walls** as a
  disconnected outer layer; sparse on capillaries. Green (AF488).
- **Counterstains:** **Nissl** (green, neuron bodies), **DAPI** (blue, cell nuclei). Useful as
  context / for excluding non-vessel structures, not vessels themselves.

Spatial arrangement (3-D result): gP-CD31 (endothelium) sits on the **lumen** side, wrapped by
phalloidin then α-SMA on artery walls; in capillaries gP-CD31 dominates and the other two fade out.

---

## Imaging parameters (the numbers a pipeline needs)

- **Tissue:** rat brain, **80 µm-thick** coronal sections, multiple immunofluorescence staining.
- **Two microscopes:**
  - *Panoramic slice scanner* (Olympus VS120) — whole-section overview (the big coronal montages,
    panel A of Figs 1–3).
  - *Laser confocal* (Olympus FV1200) — the detailed vessel fields:
    - **10× field = 1260 µm × 1260 µm**, scanned at **1024 × 1024 px** (pinhole 152 µm)
      → ~**1.23 µm/px**.
    - **40× field = 310 µm × 310 µm**, **640 × 640 px** (pinhole 105 µm) → ~**0.48 µm/px**;
      **Z-stack ≈ 40 images at 2 µm/step** (this is the input to the 3-D reconstructions).
- **Scale bars in the figures** (for calibrating cropped panels): 2 mm (panel A), 200 µm (panel B),
  **50 µm** (the `...1/...2/...3` detail panels — our targets), 40 µm / 20 µm (3-D panels).
- **3-D reconstruction:** Imaris 7.7.1 (blend mode; only brightness/contrast adjusted, no data
  removed). Post-processing: Photoshop CS6 / Illustrator CC 2019.

## How the *authors* quantified (baseline for our metrics)

They did **not** publish an explicit vessel-count or vessel-length pipeline — their metrics are
intensity/area-based, measured in **ImageJ (Fiji)**:

- **Mean labeling intensity** of each marker (gP-CD31, mM-CD31, phalloidin, α-SMA) — from three 10×
  images per rat, every 12th section.
- **Percentage (area fraction)** of gP-CD31 / Nissl / phalloidin / α-SMA labeling — i.e. fraction of
  pixels above threshold. This is the closest thing to a "vessel density" measure in the paper.
- **Hemisphere area** (ischemic vs contralateral) via the slice-scanner's own analysis system.
- **Stats:** n = 4 rats/group, 12 fields per region; mean ± SEM; two-tailed t-test / one-way ANOVA +
  Tukey; significance at P < 0.05. GraphPad Prism 8.2.1.

**Gap our project fills:** number-of-vessels and vessel-**length/skeleton** metrics are *not* in the
paper → that is exactly the new quantification we must build (e.g. threshold → binarize → skeletonize
→ count branches & sum skeleton length, on the red gP-CD31 channel). The paper's area-% can serve as
a sanity-check baseline.

### Key quantitative findings (context)
- In the **ischemic area**, gP-CD31 is **more strongly expressed** (higher intensity *and* higher
  area-%) than control/penumbra/contralateral (P < 0.05), in parallel with **neuronal loss** (Nissl %
  drops in ischemic area). So vessel signal *goes up* where neurons die.
- mM-CD31 intensity is high **only** in the ischemic area; flat elsewhere.
- Phalloidin & α-SMA: larger area / stronger intensity in ischemic region, but confined to artery
  walls.

---

## The four cortical regions (appear as B/C/D panels and bar-chart categories)

Every comparison figure is organized by these regions — worth matching when we report per-region
metrics:
1. **Normal** (healthy control brain) — Fig 1, Fig 4A.
2. **Ischemic area / core** — the MCAO-damaged tissue (strongest gP-CD31, most neuron loss).
3. **Ischemic penumbra** — tissue bordering the core.
4. **Matching contralateral region** — the mirror-image healthy side of the same MCAO brain
   (internal control).

Disease model: **MCAO** (middle cerebral artery occlusion) — 1.5 h occlusion via nylon filament,
then reperfusion, 24 h survival = **ischemia/reperfusion (I/R)**. Control rats: no surgery.

---

## Extracted figures (in `figures/`)

All embedded figure images were pulled at native resolution (300 ppi) from the source PDF.

| File | Figure | Content |
|---|---|---|
| `fig1_gP-CD31_Nissl_healthy.png` | Fig 1 | Healthy brain: coronal montage (A) → cortex (B) → detail (C); **C1 = red vessels only**, C2 = Nissl, C3/C4 = 3-D. **Best clean vessel example.** |
| `fig2_ischemia_regional.png` | Fig 2 | I/R regional change: serial montages + hemisphere-area bar chart (edema → ischemic hemisphere larger). |
| `fig3_gP-CD31_Nissl_ischemic.png` | Fig 3 | Ischemic brain, 3 regions (B ischemic / C penumbra / D contralateral). **B2,C2,D2 = red vessels only**; col 1 overlay, col 3 Nissl, col 4/5 3-D; E–G bar charts. |
| `fig4_gP-CD31_vs_mM-CD31.png` | Fig 4 | gP-CD31 (red) vs mM-CD31 (green), 4 regions (A–D). **A2,B2,C2,D2 = red gP-CD31 vessels only**; col 3 = mM-CD31; col 4 = 3-D; E bar chart. |
| `fig5_gP-CD31_vs_phalloidin.png` | Fig 5 | gP-CD31 (red) vs phalloidin (green, artery walls); same layout. |
| `fig6_gP-CD31_vs_aSMA.png` | Fig 6 | gP-CD31 (red) vs α-SMA (green, artery walls); same layout. |
| `fig7_spatial_correlation_3D.png` | Fig 7 | 3-D spatial relationship of gP-CD31 vs phalloidin vs α-SMA along/across a penetrating artery. |

Panel-naming convention across the comparison figures (Figs 3,4,5,6): row letter = **region**
(A/B/C/D), column number = **channel/view** — `1` = merged overlay, `2` = **gP-CD31 red (vessels)**,
`3` = the second marker, `4`(/`5`) = 3-D reconstruction.
