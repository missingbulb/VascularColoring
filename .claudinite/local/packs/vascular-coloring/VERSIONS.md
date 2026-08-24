# Version history

The growth lifecycle's record for this pack: one row per automated change (a prose-to-checks
conversion, a lesson landed, a rule corrected or deleted). No growth task keeps a standing tracker
issue — this file is the whole record, and a run that changed nothing writes no row.

| Date | Task | What changed |
|---|---|---|
| 2026-08-24 | prose-to-checks-sweep | Converted "A figure that draws no bar goes in `UNCALIBRATED` **with the reason**" (RULES.md, "Raw length is not comparable across figures") to the `uncalibrated-reason-required` check — every `UNCALIBRATED` entry in `analysis/measure_vessels.py` must carry a non-empty reason string. The surrounding paragraph stays: it also covers panel placement (already `panel-scale-calibration`) and what an uncalibrated panel reports, which the new check doesn't state. |
