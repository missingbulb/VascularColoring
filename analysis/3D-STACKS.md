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

## The vessel model: a correctable answer key

```
python3 analysis/vessel_model.py STACK.tif OUT.json      # a CD31-only trimmed stack or a two-channel original
```

The model is points in 3D joined by straight segments, with the stack's own number of slices: x and
y in µm from the image's top-left corner, z in slices (the z-step is unknown), and `status` draft or
corrected. Its `_about` field defines the rest. It is drawn the owner's chosen way, flat plus depth:
each slice in its own noise units, flattened, hysteresis 5σ / 2.5σ, skeletonised, spurs under 2
parent widths, specks under 4 widths and networks adding up to under 10 widths dropped, each
centerline point placed at the depth where its signal sits (median over 2 widths along the
vessel), then each vessel cut into the fewest straight segments that stay within half its width of
the centerline. A point where two segments meet is a bend; three or more, a junction.

The draft for `cd31_frontal_x20_r_1_slices1-12` ships with the MicroViewer (`microviewer/models/`):
once that stack is open, **Load the draft model for this stack** brings it in. **Side by side** shows
the stack and the model in two views that turn and zoom together; **Overlay** draws the model in
magenta over the stack. On the model: drag a point to move it (in the plane of the screen, so a
tilted view moves it in depth too); right-click a segment to delete it or add a bend, a junction to
split it into vessels that cross (branches paired off straightest-through first, each pair at the
depth between its neighbours, a leftover branch detached as a tip), or any point to delete it;
right-drag from one piece to another to connect them. Edits are kept in the browser until
**Download corrected model**, with undo and redo. `tests/test_vessel_model_edits.mjs` pins the edits.

**First draft (2026-10-03):** 961 points, 920 segments, 136 junctions, 222 tips, 55 KB. Seen before
the owner's corrections: the main network is followed; the bright tissue edge down the left side is
traced as a vessel; faint vessels in the lower right break into short pieces or are missed; a few
junctions sit in small clusters where a vessel runs past a bright blob; crossings are not split
(the crossing test in `trace_vessel_graph.py`, below, is not in this generator), so each X is a
junction for the owner to split.

## The graph tracer: the earlier draft route

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

**The owner's call on flattening (2026-09-29):** a plain flattened trace is not enough. After
rotating the 3D view, two vessels that the flattened picture shows as one crossing are plainly
distinct. Offered full 3D tracing or a flat trace that uses depth only to split crossings, the owner
chose **flat plus depth**: lengths stay in the image plane, and depth decides crossing vs junction. A first measure of how
often this bites: on the flattened draft, 11 of 25 junctions have branches whose brightest slice
differs by 4 or more (indicative: the brightest slice per pixel is noisy on faint vessels).

**Flat plus depth — the crossing test.** `segment_flat` also returns where each pixel's signal sits
in depth (the noise-normalised planes' intensity-weighted mean slice). At every junction of the flat
trace, each branch's depth is read 1–5 of its widths out (clear of the junction's blend), sorted, and
split into groups wherever neighbours differ by more than 3× their pooled point-to-point depth
noise (floored at half a slice). If the groups separate and one of them is a pair running straight
through (over 120° apart), the vessels cross: each group gets its own node, so the pair becomes one
vessel passing through. A lone branch that merely climbs or dives stays a branch. `graph.json`
lists these as `crossings`, and each edge carries `depth_slices` so the 3D view can draw the flat
draft at its depth. Region `400,400,400`: 51 edges, 18 junctions, 7 crossings, 1541 µm (the central
X of the region is crossing 3: slices 0–1 against 4). Seen before marks: 3 and 7 look like real
crossings; 5 and 6 cut a short stub off a vessel that changes depth, which may be wrong.

**Per-slice detection, then merge (owner asked, 2026-10-02).** Each slice is segmented on its own
(same noise units and hysteresis as the flat trace), then at each junction of the flat trace two
branches are joined only if some slice shows both of them, each within one slice of where its own
signal is at least half its peak, in one connected piece around the junction. Branches that never
share such a slice are separate vessels; a branch no single slice shows (too faint alone) gives no
evidence. **The owner chose slices first, depth as fallback (2026-10-02), and the tracer now
does that:** the slices decide wherever they show at least two of a junction's branches; a branch no
single slice shows joins the group nearest its depth; with fewer than two shown, the depth test
decides. Each crossing records `decided_by`. Region `400,400,400`: 51 edges, 17 junctions,
8 crossings, all decided by the slices, 1554 µm. Against the depth test's 7 crossings: both agree on 4, including the central X, which the slices show plainly (one vessel in slices
1–2, the other in 3–7). Seen before marks: the slice method is right where a vessel dives with a
stub on it (the depth test's 3 extra calls look like that), and it pairs the through-vessels by
itself; it is weakest where a branch is faint in every single slice, which it can only leave
undecided.

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
| A small straight-line model of the whole stack, corrected by the owner in the viewer | owner, 2026-10-03 | Built: draft for frontal r1 slices 1–12 ships with the site, waiting on the owner's corrections. Pairs of short paths between the same two junctions (a vessel split round a hole) collapse to one; without that and the 10-width network floor the draft had 1392 segments, mostly noise specks. Depth where no slice clears the growth level falls back to the brightest slice; before that, 453 of 1504 points piled up at slice 0. |
| Full 3D pipeline: 3D threshold → 3D skeleton → graph → distance-map diameter | STAR Protocols 2020, VesselVio | Built as the draft tracer (above) to produce an answer key for the owner to correct, not as the measurement; scored only once marks exist. |
| Normalise noise per plane for hysteresis | this session | Kept: the signal fades with depth. Alone it blew camera noise in the empty lower planes into junk edges (120 edges, traced to slice 30); skipping planes whose top 0.1% is within 1.5× of pure-noise level fixed it. |
| Seed on the whole stack's noise, grow per plane | this session | Dropped: the stack-wide noise is set by the quiet lower planes, so seeds fired everywhere in the bright upper ones (506 edges). |
| Prune every short spur in one pass | this session | Dropped: a bump and the real vessel's last stretch off the same junction both went, eating the vessel; now only the shortest spur per junction goes per pass. |
| Flatten the raw brightest value, then threshold | this session | Dropped for the flattened draft: deep vessels are faint in raw units and fell below one global threshold; flattening each plane's noise-normalised value keeps them. |
| Spur limit: Murray floor (1.29 parent widths) vs the owner's 2× | owner + Murray 1926, PLOS One 2023 | 2× is the default: Murray gives 1.29 as the floor below which nothing is a real branch, and every stub between 1.29 and 2 on the first region was a bump (2× drops 16 of 76 flattened edges). Owner may overrule by eye. |
| Full 3D tracing, crossings resolved in the volume | owner offered, 2026-09-29 | Not chosen by the owner in favour of flat plus depth. A first 3D run of the same region gave 168 edges and 71 junctions (vs 51 / 18 flat): the volume fragments more. |
| Crossing when branch depths differ, on the whole-edge depth scatter | this session | Dropped: long vessels dive slowly, so the scatter along a whole edge hid the central X; the point-to-point depth noise found it. |
| Crossing on depth alone, no straight-through test | this session | Dropped: a Y whose third arm climbs through depth split into a false crossing. |
| Per-slice detection merged across slices, to split fake junctions | owner, 2026-10-02 | Kept as the primary crossing test, depth as fallback (owner, 2026-10-02): 8 crossings, 4 shared with the depth test. Its one-slice tolerance stops a branch whose peak sits in one slice splitting from its neighbour peaking in the next. Without the half-peak filter, axial blur joins crossing vessels in the slice where both blur. The drawn-tube test needed an axial blur added: flat-topped tubes made every slice equally strong. |
| Estimate the z-step from the depth extent of round DAPI nuclei | this session | Not tried. Axial blur lengthens every nucleus along z, so it would overstate the spacing; only a cross-check for the lab's number, never a substitute. |
