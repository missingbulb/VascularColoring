// Every panel in the working dataset is named VESSEL_<prefix>_... and lives under
// references/<paper-slug>/figures/panels/. The px -> um scale is measured from the scale bar
// the figure prints and tabulated as SCALEBAR_PX in the extraction script, keyed by panel-name
// prefix (longest match wins) so one figure can calibrate rows that differ in zoom.
//
// A panel may instead carry its scale DIRECTLY, in UMPP_DIRECT, when the source image's own
// metadata states um/px and no bar is involved — stronger evidence than a measured bar.
//
// A panel whose scale genuinely cannot be measured — the figure draws no bar — is not a
// violation, but it must SAY so: an entry in UNCALIBRATED, carrying the reason. The point of
// this rule is that no panel is uncalibrated by accident.
const PANEL = /^references\/[^/]+\/figures\/panels\/VESSEL_(.+)\.png$/i;
const MEASURE = 'analysis/measure_vessels.py';
const TABLE = /SCALEBAR_PX\s*=\s*\{([\s\S]*?)\}/;
const DIRECT = /UMPP_DIRECT\s*=\s*\{([\s\S]*?)\n\}/;
const DECLARED = /UNCALIBRATED\s*=\s*\{([\s\S]*?)\n\}/;

// The wang-2022 panels carry a channel suffix the calibration keys never include.
const stripSuffix = (s) => s.replace(/_gP-CD31_red$/, '');

const keysOf = (block) => (block ? [...block.matchAll(/['"]([^'"]+)['"]\s*:/g)].map((m) => m[1]) : []);

const rule = {
  id: 'panel-scale-calibration',
  severity: 'blocking',
  description: 'Every working panel is either scale-calibrated or declared uncalibrated',
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
        fix: 'keep the per-prefix scale-bar widths in a SCALEBAR_PX = { ... } table in this file — it is the single calibration source annotate_overlays.py imports',
        doc: rule.doc,
      }];
    }
    const calibrated = keysOf(m[1]);
    const direct = keysOf(DIRECT.exec(text)?.[1]);
    const declared = keysOf(DECLARED.exec(text)?.[1]);
    const covers = (name) => [...calibrated, ...direct, ...declared].some((k) => name.startsWith(k));

    const panels = new Set();
    for (const f of ctx.tracked) {
      const hit = PANEL.exec(f);
      if (hit) panels.add(stripSuffix(hit[1]));
    }
    return [...panels].sort()
      .filter((name) => !covers(name))
      .map((name) => ({
        rule: rule.id,
        severity: rule.severity,
        file: MEASURE,
        line: lineOf('SCALEBAR_PX'),
        what: `VESSEL_${name} matches no SCALEBAR_PX, UMPP_DIRECT or UNCALIBRATED prefix`,
        why: rule.why,
        fix: `measure the scale bar printed on that panel's row and add a '<prefix>': <bar width in px> entry to SCALEBAR_PX (plus SCALEBAR_UM if the bar is not 50 um); or, if the source image states its own um/px, put it in UMPP_DIRECT with its provenance; or, if the figure draws no bar at all, add the prefix to UNCALIBRATED with the reason`,
        doc: rule.doc,
      }));
  },
};

export default rule;
