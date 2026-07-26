// Every panel in the working dataset is named VESSEL_<fig>_<region>_...; the
// px -> um scale is measured per FIGURE from that figure's printed 50 um bar and
// tabulated as SCALEBAR_PX in the extraction script.
const PANEL = /^references\/figures\/panels\/VESSEL_(fig\d+)_/;
const MEASURE = 'analysis/measure_vessels.py';
const TABLE = /SCALEBAR_PX\s*=\s*\{([^}]*)\}/;

const rule = {
  id: 'panel-scale-calibration',
  severity: 'blocking',
  description: 'Every working panel figure has a scale-bar calibration',
  doc: '.claudinite/local/packs/vascular-coloring/RULES.md',
  why: 'an uncalibrated figure does not fail — it silently reports "um n/a" and drops out of every length and density number, so a panel added without its bar measurement quietly shrinks the result set',

  run(ctx) {
    const text = ctx.read(MEASURE);
    if (text === null) return [];
    const lines = text.split('\n');
    const lineOf = (needle) => lines.findIndex((l) => l.includes(needle)) + 1 || null;
    const m = TABLE.exec(text);
    if (!m) {
      return [{
        rule: rule.id,
        severity: rule.severity,
        file: MEASURE,
        line: null,
        what: 'no SCALEBAR_PX table found',
        why: rule.why,
        fix: 'keep the per-figure scale-bar widths in a SCALEBAR_PX = { ... } table in this file — it is the single calibration source annotate_overlays.py imports',
        doc: rule.doc,
      }];
    }
    const calibrated = new Set([...m[1].matchAll(/['"]([^'"]+)['"]\s*:/g)].map((k) => k[1]));
    const figures = new Set();
    for (const f of ctx.tracked) {
      const hit = PANEL.exec(f);
      if (hit) figures.add(hit[1]);
    }
    return [...figures].sort()
      .filter((fig) => !calibrated.has(fig))
      .map((fig) => ({
        rule: rule.id,
        severity: rule.severity,
        file: MEASURE,
        line: lineOf('SCALEBAR_PX'),
        what: `${fig} has VESSEL_ panels but no SCALEBAR_PX entry`,
        why: rule.why,
        fix: `measure the 50 um bar on ${fig}'s merge/montage panel (same resolution as its VESSEL panel) and add '${fig}': <bar width in px> to SCALEBAR_PX`,
        doc: rule.doc,
      }));
  },
};

export default rule;
