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

## 2026-09-07 · scope-changed · Convert the paper-intake slug/PDF-naming rule to a check (#373)
- **Source:** the weekly prose-to-checks sweep, round 1.
- **Reason:** paper-intake step 1's slug/PDF-naming instruction had a static signature nothing
  enforced.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** one blocking world check added to the manifest, `paper-slug-format`.
- **Landed:** #373.

## 2026-09-13 · scope-changed · Convert the paper-intake figure-inline-embed rule to a check (#373)
- **Source:** the weekly prose-to-checks sweep, round 2.
- **Reason:** paper-intake step 5's inline-embed instruction had a static signature nothing
  enforced. Verified against the real tree first: five of six paper folders already complied;
  wang-2022 had no figures/README.md at all.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** one blocking world check added to the manifest, `figure-readme-inline`, shipped
  with a 14-day advisory grace window for the wang-2022 gap it surfaces on landing.
- **Landed:** #373.

## 2026-09-27 · scope-changed · Claudinite growth: prose to checks, round 4 (#373)
- **Source:** the weekly prose-to-checks sweep, round 4 - re-deriving Round 3's "not universal"
  verdict on paper-intake step 6 against today's tree found the prefix-uniqueness half of that
  bullet still stands, with live evidence: measure_vessels.py's SCALEBAR_PX comment already flags
  wang-2022's bare `fig1`/`fig3`/... keys by hand ("# wang-2022") because nothing else disambiguates
  them, and `umpp_for` matches a calibration key by `name.startswith(key)`, so an untagged key
  silently wins over any future paper's own untagged panel.
- **Reason:** every one of wang-2022's 94 committed panels is untagged while every rust-2020 and
  freitas-andrade panel already carries its paper's tag - a static, per-file form check: strip a
  leading VESSEL_, then the remainder must not start straight on fig<N>.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** one blocking world check added to the manifest, `panel-name-paper-tag`, shipped
  with a 14-day advisory grace window given the wang-2022 backlog it surfaces on landing; renaming
  those 94 files is a data migration outside this sweep's bounded surface, left for a separate
  change.
- **Rejected:** enforcing the exact tag scheme (rust-2020's full-author-name form vs
  freitas-andrade's initials form) - the prose keeps that choice; the check only holds the form
  every existing tag already shares.
- **Landed:** #373.
