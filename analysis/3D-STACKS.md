# Working in 3D — the owner's confocal stacks

> Where the 3D work on the raw stacks stands. The stacks themselves: [`data/README.md`](../data/README.md).
> Working rules: [WORKING-GUIDE.md](WORKING-GUIDE.md). Overall state: [STATUS.md](STATUS.md).

## The problem

Each stack is **30 optical slices × 2 channels** (DAPI, CD31) of one 1200 × 1200 field at
0.55 µm/px: a block of tissue about 660 µm wide and a few tens of µm deep. The figure-panel
pipeline flattens a field into one picture. Flattening is one view of the block, and it loses
three things the metrics need:

- **Length.** A vessel tilted out of the image plane by θ projects to L·cos θ, so flattened length
  is a lower bound.
- **Junctions and count.** Two vessels crossing at different depths meet in the flattened picture
  and read as a junction, splitting both into extra segments.
- **Width.** Two parallel vessels stacked in depth merge into one wide one, and out-of-focus haze
  from other slices widens a thresholded vessel. A vessel is narrow in x-y but smeared along z by
  the microscope's axial blur, so its true diameter is read across it in the slice where it is
  sharpest, never along z.

Before anything is measured in 3D the owner needs to judge, by eye, whether the stacked slices
form a believable vessel network, which crossings are real, and what "one vessel" looks like
through depth. That is the feedback loop this page serves.

## What others do

- **The standard 3D vessel pipeline** (STAR Protocols 2020, "3D quantification of vascular-like
  structures in z stack confocal images",
  [link](https://www.sciencedirect.com/science/article/pii/S2666166720301672)): record the voxel
  size, correct the signal lost with depth, median-filter 3×3×3, deconvolve, threshold the whole
  stack at once, skeletonize in 3D, convert to a graph, and read each segment's length off the
  graph and its mean diameter off a distance map. It states outright that a single maximum
  projection limits accuracy. Its tools are Fiji + Amira (commercial) + WinFiber3D.
- **Open-source analysers of a segmented 3D volume**: VesselVio
  ([link](https://www.sciencedirect.com/science/article/pii/S2667237522000443)) and Vessel Metrics
  ([link](https://www.biorxiv.org/content/10.1101/2022.12.22.521670v1.full)) take a 3D mask and
  report length, radius, branch points and tortuosity. Both need the voxel size, z included.
- **Viewers**: napari ([napari.org](https://napari.org/)) is the standard open-source Python viewer
  for multi-channel z-stacks (maximum-intensity and isosurface 3D rendering); Fiji's 3D Viewer and
  Imaris fill the same role. All of them need a local install, and the owner works without a local
  machine, so this project renders the same way in a web page instead (below).

Every one of these starts from the z-step. The stacks do not record it (see below).

## The 3D stack viewer

`analysis/export_stack_view.py` turns one stack into a web page that ray-casts the volume in the
browser (WebGL2):

```
python3 analysis/export_stack_view.py --inspect STACK.tif        # header only, reads no pixels
python3 analysis/export_stack_view.py STACK.tif OUT_DIR [--z-step UM]
```

`OUT_DIR` holds `index.html`, `meta.json` and one 8-bit volume per channel (a lossless grayscale PNG of the slices stacked vertically), binned 2× in
x-y (600 × 600 × 30, 1.1 µm/px). It is published as an Artifact for the owner; the rendered
volumes are derived data, regenerated, never committed. The page offers:

- **Brightest** (maximum intensity along each ray) and **Surface** (a lit surface where the signal
  crosses a chosen level) renders, rotatable, pannable, zoomable, opening on the microscope's own
  top-down view.
- **Colour by depth**, so crossings at different depths show as different colours.
- A **depth slab** (show slices *a*–*b*) and a **slice-spacing slider**, since the true spacing is
  unknown.
- The **flattened picture beside any single slice**, and a per-slice brightness curve that shows
  how signal fades through depth.

Both channels are scaled by one brightness window over the whole stack, never per slice, so a
fade with depth stays visible. The per-slice shift figure is an upper bound on stage drift, because
vessels running obliquely through depth also move from slice to slice.

## What the first real stack showed (`cd31_frontal_x20 r 1`, 2026-09-28)

- **Only slices 1–12 carry signal.** CD31's brightest 1% falls from 233 to 16 (of 255) by slice 16
  and stays there, and DAPI fades the same way, so the lower half is below the tissue or past what
  the light reaches, not thin vessels. The single-slice panel opens on the highest-contrast slice for that reason.
  The owner (2026-09-29) expects this and is checking it on their side.
- **The slices are aligned:** neighbouring slices shift by at most 0.4 px (0.4 µm at bin 2).
- **The background is high** (half of a bright slice's pixels sit above half scale).

## The approved view (owner, 2026-09-29, on frontal r1)

CD31, colour by depth, black point 0.63, white point 1.0, slice spacing 1 µm (still a guess), and
these are the viewer's defaults. It is the frozen render: change it only when the owner asks. The
brightness points are fractions of each stack's own percentile window, so re-check them with the
owner on the first stack from another region.

## What the owner wants out (2026-09-29)

- **No accepted ground truth exists.** The owner asked for a draft to correct.
- **The output is the whole vessel graph**, usable as ground truth with researchers: per edge (a
  junction-to-junction or junction-to-tip segment, the locked COUNT unit) its 3D length and its
  width with the width's spread; per node its position, degree and kind.
- **Invariances (default, not yet confirmed):** the graph must not change when a stack is rotated
  or flipped, or imaged brighter or dimmer.

## The draft graph to correct

```
python3 analysis/trace_vessel_graph.py STACK.tif OUT_DIR --region Y0,X0,SIZE [--z-step UM | --flat]
```

It writes the region's viewer files and `graph.json` (its `_about` field defines every field). The
viewer then draws the graph over the approved view, and the owner clicks an edge or a junction to
mark it right, wrong or unsure, or marks a vessel the draft missed on the flattened picture. The
published page keeps the marks in its store under the draft's id, which changes whenever the
tracing does, so marks never attach to the wrong edge. Tracing, in scale-free terms: background
removed at ~11 µm, hysteresis at 5σ / 2.5σ of each plane's own noise, planes with no signal above
noise skipped, 3D skeleton, then bumps (spurs shorter than the Murray limit below), specks and
split junctions cleaned out. `--flat` flattens the planes that carry signal (each in its own noise
units, so a deep faint vessel still counts) into one picture and traces that, with no depth. `tests/test_trace_vessel_graph.py` pins the graph bookkeeping on drawn tubes.

**First draft (2026-09-29):** frontal r1, region `400,400,400` (220 µm square, all 30 slices,
z-step 1 µm guessed): 114 edges, 49 junctions, 2011 µm of centerline, traced down to slice 17. Seen
before the owner's marks: the main vessels are followed; faint links between them are missed; a few
edges are specks (short isolated pieces); junctions cluster where a vessel runs along a bright blob.
That draft pruned spurs under 3 vessel widths, before the Murray limit.

**The spur limit — Murray's law (owner asked, 2026-09-29).** The owner proposed not marking a node
whose side branch is no more than about twice the vessel width. Murray's law says a parent of radius
r0 splits into daughters with r0^a = r1^a + r2^a; a = 3 for laminar flow (Murray 1926; Wikipedia,
"Murray's law"), and measured capillary networks sit nearer a = 2–2.2 (PLOS One 2023,
doi:10.1371/journal.pone.0292962, retinal capillaries). An even split's daughter is therefore
2^(-1/a) = 0.71–0.79 of the parent's width, and even a lopsided real branch is a vessel, not a bump,
once it has left the parent's wall. So a real daughter reaches at least half the parent's width
(to the wall) plus its own width beyond it: `SPUR_WIDTHS = 0.5 + 2^(-1/3) ≈ 1.29` parent widths,
the parent width being the median width of the other edges at that junction. That is a floor: a
spur shorter than it cannot be a real branch. On the first flattened region, every stub between the
floor and 2 parent widths was a bump on the wall (skeleton roughness plus bright blobs), so the
tracer uses the owner's 2×, which Murray's law shows cuts no real even-split daughter.

**Flattened draft (2026-09-29):** same region, `--flat`, 2× limit: 60 edges, 25 junctions,
1542 µm of centerline, median width 3.6 µm. At the 1.29 floor: 76 / 31 / 1579 µm; at 3×: 52 / 22 /
1512 µm, so the limit moves node counts much more than length. Seen before marks:
the main vessels and most faint links are followed; a few specks and short stubs off bright blobs
remain.

## Open questions for the owner

1. **The z-step** (µm between slices). It is in the `.sld`, not the TIFF exports. Until it is
   known, depth is drawn at a guessed spacing, and no 3D length or z-shape is quantitative.
2. **Ground truth.** Nothing measures width or length until the owner has marked the draft graph:
   which edges are vessels, which junctions are real, and which vessels the draft missed.

## Ledger

| Idea | Source | Status |
|---|---|---|
| Flatten all slices into one maximum projection, then run the 2D pipeline | earlier plan | Kept as the baseline and shown beside every 3D view; loses length along z, fuses crossings at different depths, and can merge stacked vessels into one wide one. Revisit as the naive baseline once a 3D answer key exists. |
| Look at the stack in 3D (ray-cast brightest + surface), by depth colour | owner, this page | First real stack published 2026-09-28 (`cd31_frontal_x20 r 1`, bin 2, spacing guessed); owner approved the view 2026-09-29 (settings above). |
| Full 3D pipeline: 3D threshold → 3D skeleton → graph → distance-map diameter | STAR Protocols 2020, VesselVio | Built as the draft tracer (above) to produce an answer key for the owner to correct, not as the measurement; scored only once marks exist. |
| Normalise noise per plane for hysteresis | this session | Kept: the signal fades with depth. Alone it blew camera noise in the empty lower planes into junk edges (120 edges, traced to slice 30); skipping planes whose top 0.1% is within 1.5× of pure-noise level fixed it. |
| Seed on the whole stack's noise, grow per plane | this session | Dropped: the stack-wide noise is set by the quiet lower planes, so seeds fired everywhere in the bright upper ones (506 edges). |
| Prune every short spur in one pass | this session | Dropped: a bump and the real vessel's last stretch off the same junction both went, eating the vessel; now only the shortest spur per junction goes per pass. |
| Flatten the raw brightest value, then threshold | this session | Dropped for the flattened draft: deep vessels are faint in raw units and fell below one global threshold; flattening each plane's noise-normalised value keeps them. |
| Spur limit: Murray floor (1.29 parent widths) vs the owner's 2× | owner + Murray 1926, PLOS One 2023 | 2× is the default: Murray gives 1.29 as the floor below which nothing is a real branch, and every stub between 1.29 and 2 on the first region was a bump (2× drops 16 of 76 flattened edges). Owner may overrule by eye. |
| Estimate the z-step from the depth extent of round DAPI nuclei | this session | Not tried. Axial blur lengthens every nucleus along z, so it would overstate the spacing; only a cross-check for the lab's number, never a substitute. |
