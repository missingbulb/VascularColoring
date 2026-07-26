// Rendered output lives under analysis/ (measure_vessels.py --overlays writes
// analysis/overlays/, annotate_overlays.py writes analysis/annotated/); both are
// gitignored and regenerated. The real source images live under references/.
const RENDER_ROOT = 'analysis/';
const IMAGE = /\.(png|jpe?g|tiff?|gif|bmp|webp)$/i;

const rule = {
  id: 'rendered-overlays-untracked',
  severity: 'blocking',
  description: 'No rendered overlay image is committed under analysis/',
  doc: '.claudinite/local/packs/vascular-coloring/RULES.md',
  why: 'an overlay PNG is a regenerable render, not data — committing one freezes a snapshot that silently stops matching the scripts, and the owner\'s rule is that only real data or an agreed ground-truth image gets committed',

  run(ctx) {
    return ctx.tracked
      .filter((f) => f.startsWith(RENDER_ROOT) && IMAGE.test(f))
      .map((f) => ({
        rule: rule.id,
        severity: rule.severity,
        file: f,
        line: null,
        what: `${f} is a tracked image under ${RENDER_ROOT}`,
        why: rule.why,
        fix: 'untrack it (git rm --cached) and regenerate with python3 analysis/measure_vessels.py --overlays or python3 analysis/annotate_overlays.py — commit the script and the numeric results instead; if the image really is data or agreed ground truth, put it under references/',
        doc: rule.doc,
      }));
  },
};

export default rule;
