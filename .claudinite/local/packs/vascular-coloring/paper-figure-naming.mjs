// A paper's own figures — the ones committed under references/<slug>/figures/
// itself, not the cropped references/<slug>/figures/panels/ subtree, which
// keys its own tagged prefixes — are `git mv`d in as PNGs named `figN_<short-
// name>.png` (paper-intake SKILL.md step 5). Nothing else held that shape: a
// figure re-extracted under a tool's default name (`page3_image1.png`, or the
// wrong-case `Figure1.PNG`) would sit there unremarked, and the eventual
// `![Figure 1](fig1_….png)` reference in figures/README.md would 404 against
// it — a silently broken intake a reader only notices by opening the file.
//
// A paper folder is identified by its digest.md (so references/_tools/, which
// carries no digest, is never one). README.md and crop_panels.py are the only
// other files this convention allows to sit directly in figures/; everything
// else there, one path segment below figures/, is a should-be-a-figure.
const DIGEST = /^references\/([^/]+)\/digest\.md$/;
const DIRECT_CHILD = /^references\/([^/]+)\/figures\/([^/]+)$/;
const ALLOWED_EXTRA = new Set(['README.md', 'crop_panels.py']);
const FIGURE_NAME = /^fig\d+_\S+\.png$/;

const rule = {
  id: 'paper-figure-naming',
  severity: 'blocking',
  description: 'Every committed figure is named figN_<short-name>.png',
  doc: '.claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md',
  why: 'the digest and figures/README.md link figures by this exact pattern (`![Figure 1](fig1_….png)`), so a figure committed under any other name is a dangling link nobody notices until they open the file',

  run(ctx) {
    const papers = new Set();
    for (const f of ctx.tracked) {
      const hit = DIGEST.exec(f);
      if (hit) papers.add(hit[1]);
    }
    const out = [];
    for (const f of ctx.tracked) {
      const hit = DIRECT_CHILD.exec(f);
      if (!hit) continue;
      const [, slug, name] = hit;
      if (!papers.has(slug)) continue;
      if (ALLOWED_EXTRA.has(name) || FIGURE_NAME.test(name)) continue;
      out.push({
        rule: rule.id,
        severity: rule.severity,
        file: f,
        line: null,
        what: `${f} is not named figN_<short-name>.png`,
        why: rule.why,
        fix: `git mv it to references/${slug}/figures/fig<N>_<short-name>.png (convert to PNG first if it isn't one), matching the other figures already committed there`,
        doc: rule.doc,
      });
    }
    return out;
  },
};

export default rule;
