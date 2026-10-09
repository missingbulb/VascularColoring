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

`OUT_DIR` holds `index.html`, `meta.json` and one gzipped 8-bit volume per channel, binned 2× in
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
(the crossing test on the open graph-tracer branch is not in this generator), so each X is a
junction for the owner to split.

## Open questions for the owner

1. **The z-step** (µm between slices). It is in the `.sld`, not the TIFF exports. Until it is
   known, depth is drawn at a guessed spacing, and no 3D length or z-shape is quantitative.
2. **Ground truth.** Nothing measures width or length until the owner has said, in the viewer,
   what counts as a vessel, which crossings are real junctions, and which vessels are wide.

## Ledger

| Idea | Source | Status |
|---|---|---|
| Flatten all slices into one maximum projection, then run the 2D pipeline | earlier plan | Kept as the baseline and shown beside every 3D view; loses length along z, fuses crossings at different depths, and can merge stacked vessels into one wide one. Revisit as the naive baseline once a 3D answer key exists. |
| Look at the stack in 3D (ray-cast brightest + surface), by depth colour | owner, this page | Built; waiting on the owner's first look. |
| A small straight-line model of the whole stack, corrected by the owner in the viewer | owner, 2026-10-03 | Built: draft for frontal r1 slices 1–12 ships with the site, waiting on the owner's corrections. Pairs of short paths between the same two junctions (a vessel split round a hole) collapse to one; without that and the 10-width network floor the draft had 1392 segments, mostly noise specks. Depth where no slice clears the growth level falls back to the brightest slice; before that, 453 of 1504 points piled up at slice 0. |
| Full 3D pipeline: 3D threshold → 3D skeleton → graph → distance-map diameter | STAR Protocols 2020, VesselVio | Not started: needs the z-step and the owner's ground truth first. |
| Estimate the z-step from the depth extent of round DAPI nuclei | this session | Not tried. Axial blur lengthens every nucleus along z, so it would overstate the spacing; only a cross-check for the lab's number, never a substitute. |
