# Raw confocal data — where it lives and how to get it

The owner's own microscope stacks are **not in this repository**. They live in the owner's Google
Drive; [`sources.json`](sources.json) names each one, and a fresh session fetches them:

```
pip install -r requirements.txt
python3 analysis/fetch_data.py
```

They land in `data/raw/` (git-ignored, gone with the container). Every file is checked against the
SHA-256 in `sources.json`, and a mismatch stops the run: a stack silently replaced on Drive would
otherwise change every number downstream with nothing here recording why. A checksum is `null`
until the first fetch; that run uses `--pin` to record it, and the manifest change is committed.
This follows the image commit rule in
[`analysis/WORKING-GUIDE.md`](../analysis/WORKING-GUIDE.md): real data is worth keeping, but a
170 MB stack cannot go through git (below). Test: `python3 tests/test_fetch_data.py`.

**Adding data:** put it in Drive, share it as **"Anyone with the link"**, add an entry to
`sources.json` (`kind: "file"` with `"sha256": null`, or `kind: "folder"` with `"files": null` and
optional `skip` globs), run `--pin`, commit.

## Sources

| name | what | status |
|---|---|---|
| `marianas-cd31-dapi-1.tif` … `-4.tif` | Four ≈170 MB TIFF stacks from the owner's lab (2026-09-25). Per the lab: two channels, **DAPI** (nuclei, all cells) and **CD31** (endothelial membrane, i.e. the vessels) at 488 nm, 60 planes = 30 z-planes × 2 channels. Mouse brain. | **Not yet fetchable** — each Drive link redirected to a Google sign-in on 2026-09-25: the files are not shared "Anyone with the link". Local names are ours; the Drive filenames are unseen. |

## Why Drive, and not git

Checked on 2026-09-25, for an owner with no local machine:

- **Plain git:** GitHub blocks files over 100 MiB, and a file added through the browser is capped at
  25 MiB — the owner cannot put a stack there at all.
- **Git LFS:** the same 25 MiB browser cap (pushing to LFS needs a git client), `git lfs` is not
  installed in the cloud container, and the session's git proxy does not serve LFS objects. Every
  session's download would also bill the owner's LFS bandwidth.
- **GitHub Release assets** (up to 2 GiB each, unmetered bandwidth, downloadable from the
  container — tested) are the fallback if Drive ever blocks downloads.
- **Drive:** the files are already there; `drive.google.com` and `drive.usercontent.google.com`
  are reachable from the container, and `gdown` handles Drive's large-file confirmation page.

Gotcha: a Drive link shared only with named people redirects to `accounts.google.com` (gdown:
`status code 401`) — fix the sharing, not the code.

## The microscope

Tel Aviv University's **Marianas spinning-disk confocal**
([facility page](https://en-med.tau.ac.il/marianas-spinning-disk-confocal-sicf)). What the page states:

- Dual Nipkow-disk spinning-disk confocal; **SoRa** super-resolution mode (1.4× resolution,
  further with deconvolution); light-sheet option; live/fixed multicolour, tile scan, multi-position.
- Lasers **405, 488, 561, 640 nm**. Objectives **20×, 60× oil, 100× oil**.
- Camera described as a "CCD" with **95% quantum efficiency**.

What is **inferred, not verified** — check each against the first real file's metadata:

- **Frame size.** 170 MB ÷ 60 planes ≈ 2.9 MB per plane = exactly 1200×1200 at 16 bit, which fits a
  Photometrics Prime 95B sCMOS (95% QE, 1200×1200, 11 µm pixels): about 0.18 µm/px at 60×, before
  any SoRa magnifier.
- **DAPI excitation is 405 nm**, not the 340–360 nm the lab quoted: that is the classic lamp-based
  DAPI band, and the page lists no UV laser.
- **Software.** "Marianas" is Intelligent Imaging Innovations' (3i) system, whose software
  (SlideBook) writes `.sld`/`.sldy`. The lab offered `.vsi`, which is Olympus cellSens's format, so
  which software exported these is worth confirming.

## Handling these stacks

- **These are not the figure panels.** The pipeline so far runs on RGB figure crops and segments by
  *red dominance*. A raw stack is **grayscale 16-bit, one plane per channel per z**; CD31 here is
  the 488 nm channel, which has no colour of its own. Select the channel by index, never by hue.
- **Plane order is unknown** — 30 z × 2 channels can be interleaved (ch, ch, ch…) or blocked (all
  DAPI, then all CD31). Read it from the metadata (`tifffile`: ImageJ `channels`/`slices`, OME-XML
  `DimensionOrder`); if absent, measure it — DAPI planes are scattered round nuclei, CD31 planes
  are tubes.
- **Scale comes from the file**, per the WORKING-GUIDE's calibration rule: here that means the
  TIFF's own metadata (`XResolution`/`ResolutionUnit`, ImageJ `spacing` for the z-step, OME
  `PhysicalSizeX/Z`), not a printed scale bar. If the export dropped it, mark the stack
  uncalibrated with the reason and ask the lab for an OME-TIFF export.
- **A z-stack changes "length".** Centerline length measured on a max-intensity projection
  under-counts vessels running through z; decide projection vs 3D skeleton deliberately.
- **A `.vsi` is only an index**: the pixels are in a sibling folder of `.ets` files, which must be
  uploaded with it. Reading VSI needs Bio-Formats (Java) — a heavy route, used only if the TIFFs
  lack what we need.
