# vascular-coloring — this repo's own pack

The **vessel-image quantification** domain this project works in: gP-CD31 (red) confocal panels
measured for categorize / count / measure. A local pack — declared by hand as
`local/vascular-coloring` in `.claudinite-settings.json`, never fingerprinted.

It carries only the imaging-specific part: the research loop, ground-truth discipline and
anti-overfitting stance are `research-project`'s, so reach for that pack for those.

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

Fixtures: [`pack.test.mjs`](pack.test.mjs) — each check shown firing on a violating input and quiet
on a clean one (`node .claudinite/local/packs/vascular-coloring/pack.test.mjs`).

## Prose (`RULES.md`)

| Rule (marker) | How enforced |
|---|---|
| `never-self-validate` | prose |
| `progress-visual-assertion` | prose (+ the `vessel-overlay-review` skill) |
| `locked-metric-definitions` | prose (+ `locked-metric-fields`) |
| `per-paper-rollup` | prose |
| `paper-finished-pdf-redundant` | prose (+ the `paper-intake` skill) |
| `trustworthy-numbers` | prose |

## Skills

| Skill | Trigger |
|---|---|
| [vessel-overlay-review](skills/vessel-overlay-review/SKILL.md) | proposing, revising or reporting on the extraction pipeline |
| [paper-intake](skills/paper-intake/SKILL.md) | a research paper is added to `references/`, or one needs re-processing |
