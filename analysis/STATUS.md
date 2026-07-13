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

## Next step (agreed)

Improve the **segmentation baseline**: raise sensitivity to capture the faint vessels the baseline
currently misses, and **reconnect fragmented vessels**. This lifts categorize / count / measure
together. Validate two ways: (a) watch the un-outlined vessels get captured on the overlay view, and
(b) check that **count density** starts ranking ischemic/penumbra above contralateral/normal like
length density already does.

Other candidate: validate the capillary/artery caliber threshold against the phalloidin / α-SMA panels
(companion channels that actually mark artery walls) as an external check.

## Reproduce

```
python3 analysis/measure_vessels.py              # per-image + region metrics table
python3 analysis/measure_vessels.py --overlays   # 3-panel debug overlays -> analysis/overlays/
python3 analysis/annotate_overlays.py            # presentation overlays -> analysis/annotated/
```

Dependencies: `numpy`, `scipy`, `scikit-image`, `Pillow`. (Rendered PNG dirs are gitignored — regenerate.)
