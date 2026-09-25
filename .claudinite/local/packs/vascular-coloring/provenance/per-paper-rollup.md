## 2026-07-27 · born · Claudinite growth: discover local pack vascular-coloring (#23)
- **Source:** the weekly growth-discover-packs run (#14), distilled from `analysis/WORKING-GUIDE.md`.
- **Reason:** each figure is at a different zoom with its own 50 µm bar, so cross-region or
  cross-figure comparison uses length density or area %, never raw µm; written as "Raw length is
  not comparable across figures".
- **Actor:** @missingbulb (owner).
- **Mechanism:** a RULES.md section, backed by `panel-scale-calibration`.
- **Landed:** #23.

## 2026-07-28 · converted · Combine both prose-to-checks sweeps into one pack change (#35)
- **Source:** the prose-to-checks sweep's conversion #33.
- **Reason:** the quoted per-figure µm/px values left the prose; the bar widths now live only in
  `SCALEBAR_PX`, and every µm/px number quoted in the docs is held to it; deletion test: the prose
  stays for the comparison judgment.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** the blocking world check `scale-numbers-match-calibration`.
- **Landed:** #35.

## 2026-07-29 · converted · Prose to checks: calibration-single-source, render-outputs-gitignored (#44)
- **Reason:** "the measured bar widths live in exactly one place" was stated but not held: a second
  calibration defined in Python was invisible to the markdown-only check, and whichever copy a
  script reads wins silently; deletion test: the prose was trimmed to that rationale and kept.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Mechanism:** the blocking world check `calibration-single-source`.
- **Landed:** #44.

## 2026-07-31 · strengthened · Literature intake: six papers digested, references restructured, repeatable intake protocol (#58)
- **Source:** digesting six source papers, whose panels span 0.24-1.35 µm/px.
- **Reason:** with a multi-paper corpus, scale differs by more than 5x across papers and species,
  injury model, marker and magnification change with it, so no mean may span two papers and the
  rollup is grouped per paper; the section also gained that a bar is measured off the panel and a
  figure with no bar goes in `UNCALIBRATED` with its reason.
- **Actor:** @missingbulb (owner).
- **Landed:** #58.

## 2026-08-16 · reworded · Claudinite growth: dedup local packs (#128)
- **Source:** growth dedup (#18), after research-project gained new sections.
- **Reason:** the never-borrowed bar, second-copy-wins-silently and known-gap clauses are
  research-project's "A raw measurement is comparable only inside one calibration"; kept the
  cross-paper variance, the length-density / area % choice, the per-paper grouping and where
  `SCALEBAR_PX` lives.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Landed:** #128.

## 2026-08-24 · reworded · Claudinite growth: dedup local packs (#263)
- **Source:** growth dedup (#256).
- **Reason:** normalize-never-average-raw, group-by-source, single-sourced calibration and
  uncalibrated-with-reason are research-project's "A raw measurement is comparable only inside one
  calibration"; kept the paper-specific magnitude and the grouping key, retitled "Cross-paper
  comparisons are never averaged".
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Landed:** #263.

## 2026-09-25 · reworded · heading section rewritten as a marked rule block (#512)
- **Reason:** the `##` heading sections carried no marker, so the provenance tool tracked none of
  them; each became one bold-triggered block keyed to the act, ending in its marker, its strength
  and act-time detail kept.
- **Actor:** @missingbulb (owner).
- **Landed:** #512.
