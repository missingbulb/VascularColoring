// A paper's PDF arrives with whatever name the publisher's download handed out
// ("1-s2.0-S000689932100412X-main.pdf", "41598_2022_26670_MOESM1.pdf") and is
// renamed to <slug>.pdf on the way in: the file keeps its content but not its
// unwieldy download name, so the folder, the digest link and the file all read
// as the same paper.
//
// Scoped to PDFs sitting DIRECTLY in a paper folder — supplementary material
// keeps its published filename under <slug>/supplementary/, which is the whole
// point of that subfolder, so this rule never looks inside it.
const PDF = /^references\/([^/]+)\/([^/]+\.pdf)$/i;

const rule = {
  id: 'paper-pdf-named-for-slug',
  severity: 'blocking',
  description: "A paper folder's own PDF is named <slug>.pdf",
  doc: '.claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md',
  why: 'a download-named PDF beside a slug-named digest reads as a second, unrelated file — and a folder holding two differently-named PDFs leaves the next reader guessing which one the digest was written from',

  run(ctx) {
    const findings = [];
    for (const f of [...ctx.tracked].sort()) {
      const hit = PDF.exec(f);
      if (!hit) continue;
      const [, slug, name] = hit;
      if (name === `${slug}.pdf`) continue;
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        file: f,
        line: null,
        what: `${name} sits in references/${slug}/ under its download name, not ${slug}.pdf`,
        why: rule.why,
        fix: `git mv references/${slug}/${name} references/${slug}/${slug}.pdf (git mv so the file keeps its history); if this is supplementary material rather than the article itself, move it under references/${slug}/supplementary/ instead, where published filenames are kept`,
        doc: rule.doc,
      });
    }
    return findings;
  },
};

export default rule;
