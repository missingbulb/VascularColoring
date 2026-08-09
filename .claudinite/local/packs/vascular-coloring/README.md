# vascular-coloring — this repo's own pack

The **vessel-image quantification** domain this project works in: gP-CD31 (red) confocal panels
measured for categorize / count / measure. A local pack — declared by hand as
`local/vascular-coloring` in `.claudinite-checks.json`, never fingerprinted.

It carries only what the canon doesn't: `research-project` already owns the class (run an algorithm
over similarly-formatted inputs, score against ground truth, iterate visibly), so the loop, the
ground-truth discipline and the anti-overfitting stance are **not** repeated here. What is here is
imaging-specific and concrete — the palette the red signal forces, the render-vs-data commit line,
the calibration without which a micrometre is not a micrometre, and the locked metric fields that
keep every recorded number meaning the same thing.

## Checks (`rules`)

| Check | Enforces (≤5 words) | Severity |
|---|---|---|
| `overlay-color-contrast` | no red marks on red signal | blocking |
| `rendered-overlays-untracked` | rendered overlays stay uncommitted | blocking |
| `panel-scale-calibration` | every working figure stays calibrated | blocking |
| `scale-numbers-match-calibration` | quoted µm/px matches its source | blocking |
| `locked-metric-fields` | locked metrics stay reported | blocking |
| `calibration-single-source` | one calibration table, imported | blocking |
| `render-outputs-gitignored` | render directories stay ignored | blocking |
| `paper-folder-layout` | paper folder names its article | blocking |
| `paper-indexed-in-references` | every paper has index row | blocking |

Fixtures: [`pack.test.mjs`](pack.test.mjs) — each check shown firing on a violating input and quiet
on a clean one (`node .claudinite/local/packs/vascular-coloring/pack.test.mjs`).

## Prose (`RULES.md`)

| Rule (≤5 words) | How enforced |
|---|---|
| Never validate pipeline against itself | prose |
| Progress is a visual assertion | prose (+ the `vessel-overlay-review` skill) |
| Metric definitions are locked | prose (+ `locked-metric-fields`) |
| Raw length not cross-comparable | prose (+ `panel-scale-calibration`, `scale-numbers-match-calibration`, `calibration-single-source`) |
| A paper is read once, written down | prose (+ the `paper-intake` skill, `paper-folder-layout`, `paper-indexed-in-references`) |
| Say which numbers are trustworthy | prose |

## Skills

| Skill | Trigger |
|---|---|
| [vessel-overlay-review](skills/vessel-overlay-review/SKILL.md) | proposing, revising or reporting on the extraction pipeline |
| [paper-intake](skills/paper-intake/SKILL.md) | a research paper is added to `references/`, or one needs re-processing |

Distilled from this repo's real usage: [`analysis/WORKING-GUIDE.md`](../../../../analysis/WORKING-GUIDE.md),
[`analysis/annotate_overlays.py`](../../../../analysis/annotate_overlays.py),
[`analysis/measure_vessels.py`](../../../../analysis/measure_vessels.py), the `.gitignore` render
exclusions, and the 16 `VESSEL_*` panels under
[`references/wang-2022-cd31-vascular-network/figures/panels`](../../../../references/wang-2022-cd31-vascular-network/figures/panels).
