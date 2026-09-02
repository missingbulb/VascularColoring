# References — rationale behind this pack's rules and checks

Maintenance and review material for the `writing-pack-prose` references convention: each entry
carries the reason a rule or check exists, written so a periodic review can reaffirm — or
retire — it. Entry keys are file-scoped stable identifiers (gaps allowed, never renumbered): an
end-of-line `(n)` marker in `RULES.md` cites `RULES-n`, one in a skill cites
`<skill-name>-n`, and `check:` entries cover checks. No session loads this file for daily work.

- **(paper-intake-1)** Rust 2020's main text left the binarization method, filter radius,
  particle-size floor and heatmap grid all unstated; its supplementary Data Sheet supplied every
  one of them, plus the verbatim macro and a µm-calibrated native-resolution vessel image that
  became the project's best input and the basis of its strongest validation — material one
  download away, without which the digest was materially wrong. Reaffirm while a paper's
  supplementary material keeps surfacing method detail the main text omits.

- **(paper-intake-2)** Rust 2020's entire pipeline specification exists only as pixels in Figure
  1C — papers put their method in figures, not only in prose. Reaffirm while a paper is found to
  state part of its method only in a figure.

- **(paper-intake-3)** Comparing this project's figure-crop output to a published summary table
  produced a confident, wrong conclusion about branch counts; running the authors' own macro on
  their own image corrected it — a number from a summary table may not be the raw output of the
  method it describes. Reaffirm while re-running a paper's own method on its own image remains
  available and more reliable than a table comparison.
