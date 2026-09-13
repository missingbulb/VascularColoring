// paper-intake step 5 requires every real figure PNG committed directly under
// references/<slug>/figures/ (never a level deeper — figures/panels/ is cropped ROIs with its
// own inventory convention in panels/README.md, not this rule's business) to be embedded inline
// in a sibling figures/README.md. An intake is finished when the PDF is redundant: a figure
// sitting in the tree with no inline embed is a figure the paper printed that nobody described,
// so deleting the source PDF would lose it.
const FIGURE_PNG = /^references\/([^/]+)\/figures\/([^/]+\.png)$/i;
const readmeFor = (slug) => `references/${slug}/figures/README.md`;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inlineRef = (name) => new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegex(name)}\\)`);

const rule = {
  id: 'figure-readme-inline',
  severity: 'blocking',
  since: '2026-09-13',
  description: "Every figure PNG under references/<slug>/figures/ is embedded inline in that folder's README.md",
  doc: '.claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md',
  why: 'a figure sitting in the tree with no inline embed in figures/README.md is a figure the paper printed that nobody described — the intake is not done, and the gap stays invisible until someone reopens the PDF to find out what it showed',

  run(ctx) {
    const bySlug = new Map();
    for (const file of ctx.tracked) {
      const m = FIGURE_PNG.exec(file);
      if (!m) continue;
      const [, slug, name] = m;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push(name);
    }

    const out = [];
    const flag = (file, what, fix) => out.push({
      rule: rule.id, severity: rule.severity, since: rule.since, file, line: null, what, why: rule.why, fix, doc: rule.doc,
    });

    for (const [slug, names] of bySlug) {
      const readmeFile = readmeFor(slug);
      const text = ctx.read(readmeFile);
      if (text === null) {
        flag(readmeFile,
          `references/${slug}/figures/ has ${names.length} figure PNG(s) but no README.md`,
          `write ${readmeFile}, showing every figure inline (![Figure N](figN_….png)) with a description of each sub-panel`);
        continue;
      }
      for (const name of [...names].sort()) {
        if (!inlineRef(name).test(text)) {
          flag(readmeFile,
            `${name} has no inline image embed in ${readmeFile}`,
            `add ![Figure](${name}) to ${readmeFile}, with a description of what it shows`);
        }
      }
    }
    return out;
  },
};

export default rule;
