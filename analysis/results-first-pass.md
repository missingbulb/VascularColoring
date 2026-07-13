# First-pass measured results — categorize / count / measure

> Output of [`measure_vessels.py`](measure_vessels.py) on the 16 `VESSEL_*.png` gP-CD31 panels.
> This is the *measured* companion to the visual [`expected-results.md`](../references/figures/panels/expected-results.md):
> the pipeline's numbers, to be judged against those expectations. **First pass — parameters not yet
> tuned; treat the numbers as directional, the rankings as the real result.**

## What each column is (the professor's three asks)

- **CATEGORIZE** → `cap` / `art`: each branch classified capillary vs penetrating artery by centerline
  diameter (threshold **9 px**; `art` = # segments at/above it).
- **COUNT** → `seg`: number of **branch segments** (junction-to-junction / junction-to-tip pieces).
  This is the agreed count unit. (`junc` = branch points; `vessels`/connected networks also available.)
- **MEASURE** → `len_px` / `len_um`: total skeleton (centerline) length. `wp90` = 90th-pct diameter.

`len_um` is **provisional** — it assumes each panel spans the full 310 µm 40× confocal field (digest §5).
Confirm against the 50 µm scale bar / raw `.oib` before quoting absolute microns.

## Per-image

| panel | len_px | len_µm* | seg (count) | capillary | artery | junctions | area% | wp90 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| fig1_C1_healthy | 2617 | 2208 | 177 | 157 | 20 | 59 | 14.2 | 10.0 |
| fig3_ischemic | 2150 | 2294 | 108 | 91 | 17 | 44 | 18.1 | 10.0 |
| fig3_penumbra | 2539 | 2709 | 144 | 133 | 11 | 57 | 18.4 | 8.2 |
| fig3_contralateral | 1748 | 1865 | 102 | 96 | 6 | 28 | 13.0 | 8.0 |
| fig4_ischemic | 2567 | 2290 | 150 | 139 | 11 | 49 | 12.6 | 8.5 |
| fig4_penumbra | 1898 | 1696 | 111 | 101 | 10 | 25 | 10.2 | 8.1 |
| fig4_contralateral | 1284 | 1162 | 90 | 80 | 10 | 17 | 9.1 | 10.2 |
| fig4_normal | 1164 | 1041 | 111 | 102 | 9 | 25 | 6.8 | 10.0 |
| fig5_ischemic | 2039 | 1819 | 91 | 87 | 4 | 20 | 10.2 | 8.2 |
| fig5_penumbra | 2559 | 2280 | 130 | 117 | 13 | 40 | 15.0 | 10.0 |
| fig5_contralateral | 1603 | 1462 | 103 | 91 | 12 | 21 | 11.1 | 12.0 |
| fig5_normal | 1793 | 1593 | 99 | 92 | 7 | 25 | 11.4 | 12.6 |
| fig6_ischemic | 2385 | 2131 | 131 | 108 | 23 | 40 | 16.1 | 10.8 |
| fig6_penumbra | 2104 | 1877 | 119 | 99 | 20 | 34 | 13.8 | 11.7 |
| fig6_contralateral | 1158 | 1050 | 81 | 79 | 2 | 17 | 7.0 | 8.5 |
| fig6_normal | 1173 | 1048 | 79 | 69 | 10 | 16 | 6.7 | 10.8 |

\* provisional µm — see calibration caveat above.

## Region means (the validation target)

| region | len_px | seg (count) | capillary | artery | area% | n |
|---|---:|---:|---:|---:|---:|---:|
| ischemic | 2285 | 120 | 106 | 13.8 | 14.2 | 4 |
| penumbra | 2275 | 126 | 112 | 13.5 | 14.3 | 4 |
| contralateral | 1448 | 94 | 86 | 7.5 | 10.0 | 4 |
| normal | 1377 | 96 | 88 | 8.7 | 8.3 | 3 |
| healthy (fig1) | 2617 | 177 | 157 | 20.0 | 14.2 | 1 |

**Matches the expected ordering** from the paper's biology: length, count and area all rank
**ischemic ≈ penumbra > contralateral ≈ normal**, with fig1 healthy a high-density outlier.
Capillaries dominate every field; arteries are a small minority (as expected for cortical fields).

## Known limitations (first pass)

1. **Provisional µm** — needs scale-bar / raw-data calibration.
2. **Artery/capillary split is one threshold** — borderline vessels flip; not final. Note the "normal"
   fields carry higher `wp90` (fig5/fig6 normal contain penetrating arteries), so per-field caliber
   varies more than region labels suggest.
3. **Residual fragmentation** — short stain dropouts still break some vessels, inflating segment/
   endpoint counts and slightly shortening length. Next: stronger gap-bridging + segment-level
   reconnection.
4. **Thick-vessel centerline** — mostly resolved (single centerline), but very wide arteries can leave
   a small residual loop.

Regenerate overlays: `python3 analysis/measure_vessels.py --overlays` (writes to `analysis/overlays/`, gitignored).
