## 2026-07-31 · born · Literature intake: six papers digested, references restructured, repeatable intake protocol (#58)
- **Source:** digesting six source papers into self-contained `references/<slug>/` folders.
- **Reason:** so the next article follows the same protocol, and its digest makes the PDF redundant.
  The supplementary-material step: Rust 2020's main text left the binarization method, filter
  radius, particle-size floor and heatmap grid all unstated; its supplementary Data Sheet supplied
  every one, plus the verbatim macro and a µm-calibrated native-resolution image that became the
  project's best input and strongest validation - one download away, without which the digest was
  materially wrong.
- **Actor:** @missingbulb (owner).
- **Mechanism:** the paper-intake skill, body guidelines, reached by its description.
- **Retire when:** reaffirm while a paper's supplementary material keeps surfacing method detail the
  main text omits.
- **Landed:** #58.

## 2026-09-02 · reworded · Migrate vascular-coloring's paper-intake skill onto the references convention (#333)
- **Reason:** the references convention: the three Rust 2020 incident narratives moved to
  `references.md` behind `(n)` markers, each step's act-time instruction kept inline; no meaning
  changed.
- **Actor:** @missingbulb (owner).
- **Model:** Claude, per the commit trailer.
- **Landed:** #333 (Closes #327).

## 2026-09-21 · strengthened · converted from references.md (paper-intake-2), dated by the conversion
- **Reason:** Rust 2020's entire pipeline specification exists only as pixels in Figure 1C —
  papers put their method in figures, not only in prose.
- **Mechanism:** a step of the paper-intake skill, a workflow
- **Retire when:** Reaffirm while a paper is found to state part of its method only in a figure.

## 2026-09-21 · strengthened · converted from references.md (paper-intake-3), dated by the conversion: "Prefer a same-image comparison to a table comparison."
- **Reason:** Comparing this project's figure-crop output to a published summary table produced a
  confident, wrong conclusion about branch counts; running the authors' own macro on their own image
  corrected it — a number from a summary table may not be the raw output of the method it
  describes.
- **Mechanism:** a step of the paper-intake skill, a workflow
- **Retire when:** Reaffirm while re-running a paper's own method on its own image remains available
  and more reliable than a table comparison.
