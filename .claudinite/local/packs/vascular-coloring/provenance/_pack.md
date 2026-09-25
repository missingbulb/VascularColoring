## 2026-07-27 · born · Claudinite growth: discover local pack vascular-coloring (#23)
- **Source:** the weekly growth-discover-packs run (#14), distilled from
  `analysis/WORKING-GUIDE.md`, `analysis/annotate_overlays.py`, `analysis/measure_vessels.py`, the
  `.gitignore` render exclusions and the 16 wang-2022 `VESSEL_*` panels.
- **Reason:** the vessel-image quantification domain was uncovered by canon; `research-project`
  already homed the class (the loop, ground truth, anti-overfitting) and the lifecycle packs the
  working discipline, so only the imaging specifics are carried here.
- **Actor:** @missingbulb (owner).
- **Mechanism:** a local pack declared by hand as `local/vascular-coloring`, `detect` and `marker`
  null - never fingerprinted or seeded, being this one repo's domain; three checks for the static
  signatures, RULES.md for the judgment no check can carry, and the visual-assertion procedure as a
  skill.
- **Rejected:** re-creating the research-project class locally; declaring any further canon pack.
- **Landed:** #23.

## 2026-07-28 · scope-changed · Combine both prose-to-checks sweeps into one pack change (#35)
- **Source:** one prose-to-checks sweep's two conversions, #30 and #33, combined here since both
  edited the same four files.
- **Reason:** the locked metric definitions leave one static signature - the extraction script must
  keep reporting all three asks' fields - and every µm/px number quoted in the docs must still
  equal the one calibration table; both became checks (`locked-metric-fields`,
  `scale-numbers-match-calibration`).
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** two blocking world checks added to the manifest.
- **Landed:** #35.

## 2026-07-29 · scope-changed · Prose to checks: calibration-single-source, render-outputs-gitignored (#44)
- **Reason:** two single-source invariants the prose stated but nothing held: a second calibration
  defined in Python was invisible to the markdown-only check and would win silently, and a new
  render directory stayed ignored only if someone remembered.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** two blocking world checks added to the manifest, `calibration-single-source` and
  `render-outputs-gitignored`.
- **Landed:** #44.

## 2026-07-31 · scope-changed · Claudinite maintenance: converge to canon 6b0669f + local-pack manifest migration (#55)
- **Reason:** the new manifest schema; without it the mount blocks on the manifest checks and the
  pack's own rules stop running.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** `ruleRoutingGuidance` added (belongs: overlay appearance, render outputs and
  calibration; excludes: the research-project class and the lifecycle), `rules` renamed
  `worldRules`, the bundled skill declared.
- **Landed:** #55.

## 2026-08-06 · scope-changed · Clear the three blocking conformance findings on main (#61)
- **Reason:** #58 shipped `skills/paper-intake/` undeclared, and the `config` check blocked on it.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** `paper-intake` added to the manifest's `skills`.
- **Landed:** #61.
