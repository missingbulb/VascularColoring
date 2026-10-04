// paper-intake step 6 tags every cropped panel with its paper before the fig-number
// (`rust20fig1_…`, `fa22fig13_…`) so that measure_vessels.py's calibration tables
// (SCALEBAR_PX / SCALEBAR_UM / UMPP_DIRECT / UNCALIBRATED) can match a panel name by
// prefix without two papers' entries colliding. `umpp_for` picks the *longest* key
// that the panel name starts with — a bare `fig1` key silently wins over any other
// paper that ever crops its own untagged `fig1_…`, and there is no error, just the
// wrong scale applied.
//
// Direct children of a paper's panels/ only (a level deeper is a different crop
// convention this rule doesn't reach); a name is untagged when, once a leading
// VESSEL_ is stripped, it starts straight on `fig<digits>` with nothing ahead of it.
const PANEL_PNG = /^references\/([^/]+)\/figures\/panels\/([^/]+)\.png$/i;
const UNTAGGED = /^(?:VESSEL_)?fig\d/i;

const rule = {
  id: 'panel-name-paper-tag',
  on_fail: 'block',
  since: '2026-09-27',
  description: 'Every cropped panel filename carries a paper-specific tag before its fig-number',
  doc: '.claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md',
  why: 'measure_vessels.py matches a calibration key by name.startswith(key) and keeps the longest match — an untagged fig<N> key silently wins over any other paper that later crops its own untagged fig<N>, applying the wrong scale with no error',

  run(ctx) {
    const bySlug = new Map();
    for (const file of ctx.tracked) {
      const m = PANEL_PNG.exec(file);
      if (!m) continue;
      const [, slug, base] = m;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      if (UNTAGGED.test(base)) bySlug.get(slug).push(base);
    }

    const out = [];
    for (const [slug, untagged] of bySlug) {
      if (untagged.length === 0) continue;
      const dir = `references/${slug}/figures/panels/`;
      out.push({
        rule: rule.id, on_fail: rule.on_fail, since: rule.since,
        file: `${dir}${untagged[0]}.png`, line: null,
        what: `${dir} has ${untagged.length} panel(s) with no paper tag before fig<N> (e.g. ${untagged.slice(0, 3).join(', ')}${untagged.length > 3 ? ', …' : ''})`,
        why: rule.why,
        fix: `git mv each so a short paper code sits right before "fig" (after VESSEL_ where present) — the way rust-2020's panels read VESSEL_rust20fig1_… and freitas-andrade's read VESSEL_fa22fig13_… — and update every calibration-table key and digest reference that names the old filename`,
        doc: rule.doc,
      });
    }
    return out;
  },
};

export default rule;
