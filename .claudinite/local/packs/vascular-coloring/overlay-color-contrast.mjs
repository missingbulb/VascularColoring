// The presentation overlay script — the one whose output the owner looks at.
// The 3-panel debug view in measure_vessels.py is deliberately NOT in scope: it
// dims the original and uses red for arteries, which is fine for a QA render and
// wrong for the presentation figure.
const PRESENTATION = 'analysis/annotate_overlays.py';

// An (r, g, b) or (r, g, b, a) literal — the only way a drawn colour is spelled
// in this script (PIL fill=/np.array colours).
const TUPLE = /\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*\d{1,3}\s*)?\)/g;

// Red-dominant = bright red channel that clearly beats BOTH others. Magenta
// (255, 0, 255) and the yellow label colour (255, 235, 60) stay legal: they read
// against the red signal because blue resp. green carries them.
const MARGIN = 60;
const isRedDominant = (r, g, b) => r >= 128 && r - g >= MARGIN && r - b >= MARGIN;

const rule = {
  id: 'overlay-color-contrast',
  severity: 'blocking',
  description: 'Presentation overlay marks must not be red-dominant',
  doc: '.claudinite/local/packs/vascular-coloring/RULES.md',
  why: 'the gP-CD31 signal being measured IS red — a red outline, arrow or ring vanishes on the very vessels it is supposed to mark',

  run(ctx) {
    const text = ctx.read(PRESENTATION);
    if (text === null) return [];
    const out = [];
    text.split('\n').forEach((line, i) => {
      // A comment or a docstring line describes a colour, it doesn't draw one.
      if (line.trim().startsWith('#')) return;
      for (const m of line.matchAll(TUPLE)) {
        const [r, g, b] = [m[1], m[2], m[3]].map(Number);
        if (!isRedDominant(r, g, b)) continue;
        out.push({
          rule: rule.id,
          severity: rule.severity,
          file: PRESENTATION,
          line: i + 1,
          what: `overlay colour (${r}, ${g}, ${b}) is red-dominant`,
          why: rule.why,
          fix: 'pick a colour that contrasts with the red channel — cyan for capillaries, green for arteries, magenta for junctions, yellow for labels (see the pack RULES.md)',
          doc: rule.doc,
        });
      }
    });
    return out;
  },
};

export default rule;
