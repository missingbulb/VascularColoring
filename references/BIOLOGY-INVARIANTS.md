# Biology invariants — what a real cerebral vessel graph must look like

> **Status: draft for expert sign-off (2026-10-29).** Nothing here waits on that sign-off: the
> algorithms may use these invariants now, and a rejected one gets removed from scoring.
> Each invariant names its sources, a confidence, the number to test, and how to use it in scoring.
> The reviewer column at the end of each item is for the expert.

**What this is for.** An extracted vessel graph can be judged by how much it looks like a real
vascular network, independently of any one image. These invariants are biology, not algorithm:
they hold across every extraction method and feed one scoring function. Algorithm ideas live with
the algorithms; this file holds only claims about the tissue.

**Our samples.** CD31 (PECAM-1) immunostained z-stacks of fixed **mouse** brain, 20×, 0.55 µm/px,
one 1200 × 1200 field (≈ 660 × 660 µm) per stack, 12–24 slices with an unknown z-step. Two
regions: **frontal cortex** and **hippocampal CA1**. Almost every vessel in such a field is a
capillary. Every number below is from mouse cortex unless it says otherwise; CA1 has its own
correction where one is known.

**Confidence scale.**
- **High**: several independent quantitative sources in mouse brain agree.
- **Medium**: one solid quantitative mouse source, or several sources from another species or tissue.
- **Low**: theory (an optimality argument), indirect evidence, or our own inference from the sources.

---

## Summary

| # | Invariant | Number to test | Confidence | Use |
|---|---|---|---|---|
| B1 | The undirected graph **has loops**; the flow graph has **no directed cycles** | loops allowed; no flow orientation may cycle | High | Do not penalize loops as such |
| B2 | Real loops are **long**: about 9–11 segments, ~370–490 µm around | a loop of < 4–5 segments or < ~150 µm is suspect | High (mouse cortex) | Penalize short loops |
| B3 | Junctions are **three-way** | degree 3 in ~97–99% of junctions; > 3 in ≤ ~7% | High | A degree-4 rate above ~7% means crossings were merged |
| B4 | Capillary junction **angles are wide** | per junction, smallest angle ≈ 84°, median ≈ 118°, largest ≈ 145° (means) | Medium | Penalize narrow forks (< ~40°) |
| B5 | Capillary **segment length** | median ≈ 45 µm; mean 45 ± SD 28 µm; > 200 µm rare | High | Score the length distribution |
| B6 | Capillary **tortuosity** | ≈ 1.2–1.3 (path / chord) | Medium | Score bendiness; > ~2 is suspect |
| B7 | **Capillary width** is nearly uniform and small | lumen ~2–5 µm (radius median ~2 µm); within-segment SD ≈ 0.4 µm | High | Capillaries carry no usable taper at 0.55 µm/px |
| B8 | **Murray's law** at arteriole and venule junctions | r₀ᵃ = r₁ᵃ + r₂ᵃ, a ≈ 2.5 (IQR ~1.75–3.7); a = 3 in theory | Medium | A wide prior on non-capillary junctions only |
| B9 | **Branch angle follows radius** at arteriole junctions | cos θ₁ = (r₀⁴ + r₁⁴ − r₂⁴) / (2 r₀² r₁²); symmetric split ≈ 75° | Low | Weak prior; thin side branches leave near 90° |
| B10 | **Narrowing gives flow direction only on the arterial side** | arterial: largest branch is upstream; venous: largest branch is downstream | High (direction) / Low (telling sides apart in CD31) | Score orientation consistency, not absolute direction |
| B11 | Width changes **at junctions**, not smoothly along a segment | step at each branch point; near-constant between | Low–Medium | Start/end width is a tree-side cue; expect ~0 slope on capillaries |
| B12 | **Space filling**: no tissue is far from a vessel | mean tissue-to-vessel distance ~10–20 µm; max ~50 µm (cortex) | High | Large empty volumes flag missed vessels |
| B13 | **Length density** by region | cortex ~0.9–1.0 m/mm³; hippocampus ~0.68, Ammon's horn ~0.65 | High (ratio) / Medium (absolute, fixed tissue) | Sanity range per region; CA1 ≈ ⅔ of cortex |
| B14 | **CD31 signal is patchy along a vessel** | gaps along real vessels are expected | Medium | Pixel-support checks must tolerate gaps |
| B15 | A thin slab **cuts most loops open** | loop ~490 µm vs slab ~tens of µm | Low (our inference) | Expect few closed loops; many vessels end at the slab faces |

The scale estimates for one of our fields are in [§ Expected amounts in one field](#expected-amounts-in-one-field).

---

## B1. Loops exist; directed flow cycles do not

**Claim.** The brain's vessel graph is **not** a tree and not an undirected acyclic graph. Its
capillary bed is a highly interconnected mesh, and the pial arteries on the surface are joined in
loops too. What is true is narrower: blood flows from high to low pressure, so in steady flow
every vessel can be oriented from its high-pressure end to its low-pressure end, and that
**flow-oriented graph has no directed cycle** (a cycle would need pressure to fall all the way
round and come back to where it started).

**What holds at which scale.**
- *Pial surface arteries:* loops that span the whole middle-cerebral-artery territory (Blinder 2010).
- *Penetrating arterioles and venules:* essentially unbranched trunks diving into the cortex; each
  is a flow bottleneck (Nishimura 2007). Tree-like.
- *Capillary bed:* an "interconnected mesh" of loops whose topology ignores cortical columns
  (Blinder 2013); "mesh-like, in contrast to arterioles and venules, which form quasi-fractal
  hierarchies" (Smith 2019).

**A caution for scoring.** Any undirected graph can be given an acyclic orientation, so "no
directed cycle" constrains nothing on its own. It bites only together with B8–B10, which fix the
orientation of each edge from its widths.

**Sources.** Blinder et al. 2013, *Nat Neurosci* 16:889 (abstract only, [doi:10.1038/nn.3426](https://doi.org/10.1038/nn.3426)); Blinder et al. 2010, *PNAS* 107:12670 ([PMC2906564](https://pmc.ncbi.nlm.nih.gov/articles/PMC2906564)); Smith et al. 2019, *Front Physiol* 10:233 ([PMC6444172](https://pmc.ncbi.nlm.nih.gov/articles/PMC6444172/)); Nishimura et al. 2007, *PNAS* 104:365 (secondary summary only).

**Confidence.** High.

**Use in scoring.** Never penalize a loop for being a loop. Penalize (a) short loops, per B2, and
(b) any orientation, derived from widths, that closes a directed cycle.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B2. Real loops are long

**Claim.** The shortest loop through a capillary branch is about nine branches long, and a typical
loop is 10–11 segments and several hundred micrometres around. Two-branch loops are about 1% of loops.

**Numbers.**
- Ji 2021, whole mouse brain: shortest loop 8.97 ± 0.53 branches (mean ± SE); two-branch loops ≈ 0.011 of loops (median); independent loops ≈ N/2 for N nodes.
- Smith 2019, mouse cortex (7 regions): 11.2 ± 1.2 edges per loop; mean loop length 486 ± 60 µm.
- Hudetz 1988, rat (cited by Smith 2019): 4–7 capillaries per loop.

**Sources.** Ji et al. 2021, *Neuron* 109:1168 ([PMC8525211](https://pmc.ncbi.nlm.nih.gov/articles/PMC8525211)); Smith et al. 2019 ([PMC6444172](https://pmc.ncbi.nlm.nih.gov/articles/PMC6444172/)).

**Confidence.** High for mouse cortex. The rat count is shorter, so the floor is soft.

**Use in scoring.** A loop of 2–3 segments is almost certainly a crossing read as two junctions,
or a duplicate trace of one vessel. Penalize loops under ~4–5 segments or ~150 µm around,
increasingly as they get shorter. The image that started this research shows several small loops
of three or four segments in a small area: that is what this invariant rejects.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B3. Junctions are three-way

**Claim.** Vessel junctions are almost always bifurcations: one vessel splits into two, or two merge into one.

**Numbers.** Ji 2021: degree-3 nodes are 0.968–0.987 of nodes (interquartile range across
regions); mean degree 3.02 ± 0.02; branches per node 1.529, close to the 3/2 of a pure degree-3
graph. Smith 2019: 7.2 ± 0.9% of interior vertices in mouse cortex have more than three
connections (a looser image-processing definition, so treat 7% as the ceiling).

**Sources.** Ji 2021; Smith 2019 (which also cites Duvernoy and Blinder for "mainly three connections").

**Confidence.** High.

**Use in scoring.** A degree-4 node is most often two vessels crossing at different depths. A
degree-4 rate well above ~7% says crossings are being merged. A degree ≥ 5 node is almost
certainly an artifact (a knot).

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B4. Capillary junction angles are wide

**Claim.** At a capillary junction the three branches spread out; two branches rarely leave side by side.

**Numbers.** Ji 2021, angles between the three branch tangent vectors at each node (tangent = the
principal direction of the first 10 skeleton voxels): smallest 84 ± 4°, median 118 ± 2°, largest
145 ± 3° (means across regions). The full distribution, and so a hard floor, is not given.

**Sources.** Ji 2021 ([PMC8525211](https://pmc.ncbi.nlm.nih.gov/articles/PMC8525211)).

**Confidence.** Medium: one source, means only.

**Use in scoring.** Penalize a junction whose smallest angle is far below ~84°. A fork under
~30–40° is more likely one vessel traced twice, or a crossing at a shallow angle. Measure angles
from tangents over ~5 µm of each branch, as Ji did, not from the end-to-end chord.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B5. Capillary segment length

**Claim.** A capillary runs about 45 µm between junctions; long unbranched runs are rare.

**Numbers.** Ji 2021: median capillary branch length 46 ± 1 µm (somatosensory cortex), 45 ± 1 µm
(inferior colliculus), 67 ± 3 µm (corpus callosum, a white-matter region); branches under 40 µm
dominate, over 200 µm are rare. Smith 2019, mouse cortex: mean 44.8 ± 2.4 µm, SD 28.1 µm (straight
length; tortuous length ~20% longer). Human capillaries are ~34% longer than mouse (Smith 2019).

**Sources.** Ji 2021; Smith 2019.

**Confidence.** High.

**Use in scoring.** Compare the segment-length distribution to a ~45 µm median. Many segments
under ~10 µm mean fragmentation or spurious junctions; a segment over ~200 µm with no branch
probably hides missed side branches. Segments cut by the slab faces or the image border are
truncated, so score only interior segments.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B6. Capillary tortuosity

**Claim.** Capillaries are mildly curved between junctions.

**Numbers.** Ji 2021: tortuosity 1.27 ± 0.05. Smith 2019: tortuous lengths ~20% longer than straight.

**Confidence.** Medium.

**Use in scoring.** A traced segment much more tortuous than ~1.3 (say > 2) is likely wandering
between vessels; a perfectly straight chord between distant junctions is likely a shortcut.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B7. Capillary width is small and nearly uniform

**Claim.** Capillaries have a lumen of ~2–5 µm. A capillary's width varies along its length, but
that variation is local (endothelial structure), about as large as the difference between
capillaries, and not a steady taper in the flow direction.

**Numbers.**
- Ji 2021: mean vessel radius 2.39 µm, median 2.05 µm (whole brain); in-vivo minimum radius
  1.9 ± 0.3 µm; capillaries ≈ 96% of vessel length; capillary cut-off radius 3.5 µm (where the
  radius distribution leaves its power law). Vessels under ~5 µm shrink after perfusion-fixation;
  Ji corrects lengths by ×1.05.
- Shih lab 2023, EM of mouse visual cortex: lumen ~2–5 µm; standard deviation *within* one
  capillary 0.39 µm vs 0.45 µm *between* capillaries; the transitional segments next to arterioles
  and venules (first ~1–4 branch orders) are wider than mid-capillaries, and the arterial and venous
  transitions do not differ from each other.
- Smith 2019 separates arterioles/venules from capillaries at 7.2 µm diameter (mouse).

**Sources.** Ji 2021; "Endothelial structure contributes to heterogeneity in brain capillary
diameter", *Vascular Biology* 2023 ([PMC10503221](https://pmc.ncbi.nlm.nih.gov/articles/PMC10503221/)); Smith 2019.

**Confidence.** High.

**Use in scoring.** At 0.55 µm/px a 0.4 µm variation is under one pixel, and CD31 marks the
endothelium (outer edge), not the lumen. So: expect capillary start and end widths to be equal
within noise, and do **not** infer flow direction from a capillary's own taper. A capillary-sized
trace wider than ~7 µm is either a larger vessel or two vessels side by side.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B8. Murray's law at arteriole and venule junctions

**Claim.** At a junction of non-capillary vessels, the trunk radius r₀ and branch radii r₁, r₂
satisfy roughly r₀ᵃ = r₁ᵃ + r₂ᵃ. Murray's minimum-work argument gives a = 3; measured cerebral
values are lower and widely spread.

**Numbers.**
- Murray 1926: a = 3 (theory; equal split → each daughter 0.79 × parent radius).
- Ji 2021: the vessel radius distribution above r = 3.5 µm follows a power law with exponent
  −2.81 ± 0.03, which the authors compare to Murray's −3.
- El-Bouri & Payne, statistical model of human penetrating arterioles and venules: median exponent
  2.5, interquartile range 1.75–3.7 (secondary summary; human).
- Arterial bifurcations in brain and other organs: a ≈ 2.5–2.6 (secondary summary).
- The repo already uses a = 3 (laminar) to ~2.2 (capillary networks) in its spur limit;
  see `analysis/3D-STACKS.md`, "The spur limit — Murray's law".

**Sources.** Murray CD 1926, *PNAS* 12:207; Ji 2021; El-Bouri & Payne ([Liverpool repository](https://livrepository.liverpool.ac.uk/id/eprint/3134475)); Cassot et al. 2010, *Brain Res* (228 human arteriolar and venular trees; abstract only, exponent not yet read).

**Confidence.** Medium for "a between ~2 and 3 on average"; low for any single junction.

**Use in scoring.** Only at junctions where at least one branch is above capillary size (r > ~3.5 µm).
Score the fitted exponent with a broad prior centred near 2.5. The corollary is stronger than the
exponent: with any a > 1, **the trunk is the widest of the three branches**, so a junction whose
two widest branches are both much wider than the third is a trunk with a side branch, and a junction
where a thin vessel "feeds" two wide ones is wrong on the arterial side (see B10 for the venous side).

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B9. Branch angle follows the radius ratio at arteriole junctions

**Claim.** In the same minimum-work model, a branch's angle from the trunk direction θ₁ depends on
the radii: cos θ₁ = (r₀⁴ + r₁⁴ − r₂⁴) / (2 r₀² r₁²). An equal split under a = 3 gives ~37.5° per
branch, ~75° between them; a very thin side branch leaves at nearly 90°, while the trunk barely bends.

**Sources.** Murray CD 1926, *J Gen Physiol* 9:835 (the angle paper); Zamir 1976 and 1978 (other
optimality principles give similar angles). Formula from background knowledge, not re-read this session.

**Confidence.** Low: measured angles scatter widely around the optimum, and capillary junctions
(B4, median ~118°) clearly do not follow it.

**Use in scoring.** A weak prior at non-capillary junctions: the widest continuation should be
nearly straight, and a thin side branch should leave steeply. This is also the rule for which
branch "continues the vessel" through a junction.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B10. Narrowing gives flow direction only on the arterial side

**Claim.** Blood runs artery → arterioles → capillaries → venules → veins. On the **arterial** side
each junction **divides** flow, so vessels narrow downstream. On the **venous** side each junction
**merges** flow, so vessels **widen** downstream. "Narrowing is the flow direction" is therefore
true for arterioles and backwards for venules.

**Sources.** The arterial-tree / venous-tree hierarchy in Smith 2019 and Blinder 2013; Cassot 2010
(arteriolar and venular trees analysed separately); standard physiology.

**Confidence.** High that the two sides run opposite ways. **Low** that our CD31-only stacks can
tell an arteriole from a venule: CD31 labels both. Wang 2022 used α-SMA to mark arteries; we have no
such channel. Width, wall smoothness and straightness are weak cues and are for the expert to confirm.

**Use in scoring.** Score **consistency**, not absolute direction: along a connected run of
non-capillary vessels, every junction should agree with one orientation (all diverging or all
converging, as seen from the trunk). Mixed signals along one tree mean a misread width or a wrong
junction. Leave the "artery or vein" label open unless another channel or the owner supplies it.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B11. Width changes at junctions, not smoothly along a segment

**Claim.** In the morphometric models of cortical trees, each segment between junctions has a
roughly constant diameter, and diameter drops at each branch point. A long arteriole that sheds many
small side branches therefore looks tapered when the side branches are too small to see.

**Sources.** Our inference from the constant-diameter segment models used for cortical networks
(Smith 2019 simulates uniform diameters; Cassot 2006/2010 measure diameters per vertex) and from B7.
No source read this session measures within-segment taper of cortical arterioles directly.

**Confidence.** Low–Medium. This is the first invariant to put to the expert.

**Use in scoring.** A start width and an end width per segment are worth keeping, but expect their
difference to be ~0 on capillaries and small on arterioles. A clear taper along a segment with no
visible side branch is a hint that side branches were missed. The informative signal for direction
is the step across each junction (B8, B10).

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B12. Space filling: no tissue is far from a vessel

**Claim.** Capillaries fill tissue so evenly that every point lies within a few tens of
micrometres of a vessel, and the distance scales with the inverse square root of length density.

**Numbers.** Ji 2021: mean tissue-to-vessel distance 10.0 µm (densest region) to 20.2 µm (corpus
callosum); d̄ = 0.494 · ρ_L^(−1/2) − 3.08. Smith 2019, mouse cortex: mean 18.4 µm, mean of local
maxima 29.4 µm, maximum 50.1 ± 3.7 µm. Deleting one capillary raises the local maximum distance by
only ~2 µm (Ji), so the mesh is redundant.

**Sources.** Ji 2021; Smith 2019.

**Confidence.** High for cortex. For CA1, scale by density: ~1.2× larger distances (B13).

**Use in scoring.** Compute, in 3D, the distance from every tissue voxel in the slab interior to the
nearest extracted vessel. Voids with a maximum well over ~50 µm (cortex) or ~60 µm (CA1) most likely
hold a missed vessel. Near the slab faces the nearest vessel may lie outside the stack, so leave a
margin.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B13. Length density by region

**Numbers.** Ji 2021, metres of vessel per mm³ (shrinkage-corrected): somatosensory cortex
1.01 (capillaries 0.98), piriform cortex 0.72, hippocampus 0.71 (capillaries 0.68), Ammon's horn
0.65, corpus callosum 0.49, inferior colliculus 1.41; vibrissa cortex 0.88 ± 0.17 (Tsai et al.,
as cited). Shaw et al. 2021: lower capillary density in CA1 than in visual cortex, with lower flow
and oxygenation; an older study put perfused capillary density in CA1 at < 30% of cortex.

**Sources.** Ji 2021; Shaw et al. 2021, *Nat Commun* 12:3190 ([doi:10.1038/s41467-021-23508-y](https://doi.org/10.1038/s41467-021-23508-y)).

**Confidence.** High that CA1 is sparser than frontal cortex, roughly two-thirds. Medium for the
absolute value in our sections: fixed slices shrink differently from Ji's cleared brains, and frontal
cortex is not one of Ji's quoted regions.

**Use in scoring.** A sanity range per region, not a target: a CA1 extraction denser than its
frontal-cortex counterpart deserves a look. Compare normalized densities only; the z-step is unknown,
so per-volume numbers wait on it.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B14. CD31 signal is patchy along a vessel

**Claim.** CD31 (PECAM-1) concentrates at the junctions between endothelial cells, and capillaries
are one or two endothelial cells around. Along a real vessel the stain therefore brightens and dims
with the cell borders, and short gaps are normal.

**Sources.** PECAM-1 junctional localization (e.g. Privratsky & Newman 2014, *Cell Tissue Res*
355:607; background knowledge, not re-read this session); the one-to-two-cell capillary wall from
the 2023 EM study (B7). The repo's own observation of stain dropouts is in `analysis/STATUS.md`.

**Confidence.** Medium.

**Use in scoring.** When validating a segment by the bright pixels along its path, score coverage
over a window (e.g. the fraction of ~5 µm windows that carry signal), not a mean, so that a few gaps
do not condemn a real vessel. A long stretch with no signal is still evidence against the segment.

Expert: ☐ agree ☐ disagree ☐ comment: ______

## B15. A thin slab cuts most loops open

**Claim (our inference).** A real capillary loop is ~490 µm around and spans tens of micrometres in
every direction, since capillaries are only weakly anisotropic (Ji 2021). Our stacks are a few tens
of micrometres deep, so most loops leave the stack and come back outside it. What survives in the
stack is mostly a forest of pieces with ends on the top and bottom faces, plus a few large loops
that happen to lie flat.

**Confidence.** Low until the z-step is known.

**Use in scoring.** Expect few closed loops, and expect many segment ends at the slab faces; do not
penalize those ends as "dangling". A field full of small closed loops is the opposite of what the
biology predicts here.

Expert: ☐ agree ☐ disagree ☐ comment: ______

---

## Expected amounts in one field

Indicative only. From Ji 2021's density (cortex ~0.98, Ammon's horn ~0.65 m/mm³) and its ratio of
~10.8 junctions per mm of vessel (4.13 million nodes / 384 m), for our 660 × 660 µm field and **per
10 µm of stack depth**:

| Region | Vessel length | Junctions | Median segment |
|---|---|---|---|
| Frontal cortex | ~4.3 mm | ~45 | ~45 µm |
| CA1 | ~2.8 mm | ~30 | ~45 µm (not measured separately) |

Multiply by the slab depth in tens of micrometres once the z-step is known. Fixed-tissue shrinkage,
region differences and slab-face truncation each move these numbers by tens of percent.

---

## Questions for the expert

1. Do CD31-stained cortical arterioles taper between branch points, or only step down at them (B11)?
2. In CD31-only mouse stacks, is there any reliable cue to tell an arteriole from a venule (B10)?
3. Does capillary flow direction stay fixed, or do individual capillaries reverse? If they reverse,
   B1's "no directed cycle" holds only at each instant.
4. Are CA1 junction angles, segment lengths and loop sizes known to differ from cortex? Every number
   here except density is from cortex.
5. Is the 7% ceiling for four-way junctions (B3) right for mouse capillaries, or an image-processing artifact in the source?

## Papers to ingest next

Read this session from open full text: Ji 2021, Smith 2019, the 2023 capillary-diameter EM study.
Abstracts or secondary summaries only: Blinder 2013, Blinder 2010, Nishimura 2007, Cassot 2010,
El-Bouri & Payne, Shaw 2021. Full `paper-intake` digests (see [`README.md`](README.md)) should follow for:

- **Ji et al. 2021**, *Neuron* — open; the main quantitative source here.
- **Smith et al. 2019**, *Front Physiol* — open; loop and distance statistics.
- **Blinder et al. 2013**, *Nat Neurosci* — **paywalled; needs the owner to download the PDF.**
- **Cassot et al. 2010**, *Brain Res* — **paywalled; needs the owner to download the PDF.** It holds
  the measured Murray exponent and angles for cortical arteriolar and venular trees.
