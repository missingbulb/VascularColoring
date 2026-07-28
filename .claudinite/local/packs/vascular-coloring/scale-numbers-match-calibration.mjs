// The px -> um scale of every figure is derived from ONE source: UM_PER_BAR /
// SCALEBAR_PX in the extraction script (the measured 50 um bar widths). The docs
// quote those numbers in three places (the pack RULES, the working guide, the
// results calibration table) — this check keeps the copies honest.
//
// Detection is column/label-scoped, never a bare grep for decimals: a claim is
// read only from an inline `figN = <value>` in a passage that says "um/px", or
// from a markdown table's own um/px and bar-width COLUMNS, and only when the
// figure cell names a figure rather than a panel. That is what keeps the per-panel
// results table (fig1_C1_healthy | 2145 | 23.6 | ...) out of scope.
const MEASURE = 'analysis/measure_vessels.py';
const SKIP = '.claudinite/shared/';                 // read-only mounted canon
const UM_PER_BAR = /UM_PER_BAR\s*=\s*([\d.]+)/;
const TABLE = /SCALEBAR_PX\s*=\s*\{([^}]*)\}/;

const MU = '[µμu]';                       // micro sign / greek mu / plain "u"
const MU_LABEL = 'µm/px';
const UMPP = new RegExp(`${MU}m\\s*/\\s*px`, 'i');  // the unit that marks a scale claim
// "fig1 = 0.820", "fig4/5/6 = 0.658", "fig4 / fig5 = 0.658"
const INLINE = /\bfig(\d+(?:\s*\/\s*(?:fig)?\d+)*)\s*=\s*\*{0,2}[~≈]?\s*(\d+(?:\.\d+)?)/g;
// a table cell that is just a number, optionally in px and/or bold: "61 px", "**0.820**"
const NUM_CELL = /^\*{0,2}[~≈]?\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*\*{0,2}$/;

// The figures a label names — "fig1", "fig4/5/6", "fig4 / fig5". Anything that is
// not a bare figure number is dropped, so a panel-level label ("fig1_C1_healthy",
// "fig1 crop A2") names no figure and carries no claim.
const figsOf = (labels) => labels
  .split(/[/,]/)
  .map((p) => p.trim().replace(/^fig/i, ''))
  .filter((p) => /^\d+$/.test(p))
  .map((p) => `fig${p}`);

// A quoted value agrees if it matches the true value rounded to the precision the
// doc chose to quote it at (0.820, 0.82 and 0.8197 all describe 50/61).
const agrees = (quoted, truth) => {
  const dp = (quoted.split('.')[1] || '').length;
  return Number(quoted) === Number(truth.toFixed(dp));
};

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

// Blank-line-separated blocks, with the 1-based line each block starts on.
const blocks = (text) => {
  const out = [];
  let cur = null;
  text.split('\n').forEach((line, i) => {
    if (line.trim() === '') { cur = null; return; }
    if (!cur) { cur = { start: i + 1, lines: [] }; out.push(cur); }
    cur.lines.push(line);
  });
  return out;
};

const rule = {
  id: 'scale-numbers-match-calibration',
  severity: 'blocking',
  description: 'Scale numbers quoted in the docs match the SCALEBAR_PX calibration',
  doc: '.claudinite/local/packs/vascular-coloring/RULES.md',
  why: 'the um/px per figure is derived from one measured table (UM_PER_BAR / SCALEBAR_PX); a doc that quotes a stale copy does not fail loudly — it silently re-labels every length and density number in that document with the wrong scale',

  run(ctx) {
    const src = ctx.read(MEASURE);
    if (src === null) return [];
    const perBar = UM_PER_BAR.exec(src);
    const table = TABLE.exec(src);
    // No calibration source to compare against: panel-scale-calibration owns that.
    if (!perBar || !table) return [];
    const bar = new Map(
      [...table[1].matchAll(/['"]([^'"]+)['"]\s*:\s*(\d+(?:\.\d+)?)/g)].map((m) => [m[1], Number(m[2])]),
    );
    const um = Number(perBar[1]);
    const truth = (fig, kind) => {
      const px = bar.get(fig);
      if (px === undefined) return null;               // uncalibrated figure -> not this rule
      return kind === 'bar' ? px : um / px;
    };

    const out = [];
    const flag = (file, line, fig, kind, quoted, expected) => out.push({
      rule: rule.id,
      severity: rule.severity,
      file,
      line,
      what: kind === 'bar'
        ? `${fig}'s scale bar is quoted as ${quoted} px but SCALEBAR_PX says ${expected}`
        : `${fig}'s scale is quoted as ${quoted} ${MU_LABEL} but SCALEBAR_PX gives ${expected}`,
      why: rule.why,
      fix: kind === 'bar'
        ? `quote ${fig}'s bar as ${expected} px, or fix SCALEBAR_PX in ${MEASURE} if the measurement changed — the table is the single source`
        : `quote ${expected} ${MU_LABEL} for ${fig} (UM_PER_BAR / SCALEBAR_PX['${fig}']), or fix the table in ${MEASURE} if the measurement changed`,
      doc: rule.doc,
    });

    for (const file of ctx.tracked) {
      if (!file.endsWith('.md') || file.startsWith(SKIP)) continue;
      const text = ctx.read(file);
      if (text === null) continue;

      for (const blk of blocks(text)) {
        const body = blk.lines.join('\n');
        if (!UMPP.test(body)) continue;               // no scale claim in this passage

        // --- inline prose claims: "fig1 = 0.820" ---------------------------
        blk.lines.forEach((line, i) => {
          if (line.trim().startsWith('|')) return;    // table rows handled below
          for (const m of line.matchAll(INLINE)) {
            for (const fig of figsOf(m[1])) {
              const t = truth(fig, 'umpp');
              if (t === null) continue;
              if (!agrees(m[2], t)) flag(file, blk.start + i, fig, 'umpp', m[2], t.toFixed(3));
            }
          }
        });

        // --- table columns: a um/px column and/or a bar-width column -------
        const rows = blk.lines.map((l, i) => ({ line: blk.start + i, raw: l }))
          .filter((r) => r.raw.trim().startsWith('|'));
        if (rows.length < 3) continue;
        const head = cells(rows[0].raw);
        const figCol = head.findIndex((c) => /fig/i.test(c));
        const umppCol = head.findIndex((c) => UMPP.test(c));
        const barCol = head.findIndex((c, i) => i !== umppCol && /bar/i.test(c) && /px|m\b/i.test(c));
        if (figCol < 0 || (umppCol < 0 && barCol < 0)) continue;
        for (const row of rows.slice(2)) {            // skip header + |---| separator
          const cs = cells(row.raw);
          const label = (cs[figCol] || '').replace(/\*/g, '').trim();
          for (const [col, kind] of [[umppCol, 'umpp'], [barCol, 'bar']]) {
            if (col < 0) continue;
            const hit = NUM_CELL.exec(cs[col] || '');
            if (!hit) continue;
            for (const fig of figsOf(label)) {
              const t = truth(fig, kind);
              if (t === null) continue;
              if (!agrees(hit[1], t)) {
                flag(file, row.line, fig, kind, hit[1], kind === 'bar' ? String(t) : t.toFixed(3));
              }
            }
          }
        }
      }
    }
    return out;
  },
};

export default rule;
