// A paper is only "in the project" once the index says so. Every folder under
// references/ that carries a digest.md is a taken-in paper, and references/README.md
// is the one place a reader looks to find out what the literature base contains —
// so the index must name every one of them, linked to its digest.
//
// The reverse direction matters just as much: a row pointing at a folder that no
// longer carries a digest is a dead link in the first document anyone reads, and
// it survives a rename silently because nothing else in the repo reads that table.
//
// Both directions are one invariant — the paper folders and the index agree.
const INDEX = 'references/README.md';
const DIGEST = /^references\/([^/]+)\/digest\.md$/;
const LINK = /\]\(\.?\/?([^)/]+)\/digest\.md\)/g;

const rule = {
  id: 'paper-indexed-in-readme',
  severity: 'blocking',
  description: 'Every paper folder with a digest appears in the references index, and every index row points at a real one',
  doc: '.claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md',
  why: 'the index is how the next session discovers what has already been read — a paper missing from it gets re-read from the PDF, and a row pointing at a folder that moved sends the reader to a 404 instead',

  run(ctx) {
    const text = ctx.read(INDEX);
    if (text === null) return [];
    const lines = text.split('\n');
    const headingLine = lines.findIndex((l) => /^##\s+Papers\s*$/i.test(l)) + 1 || null;

    const papers = new Set();
    for (const f of ctx.tracked) {
      const hit = DIGEST.exec(f);
      if (hit) papers.add(hit[1]);
    }

    // Where each linked slug is first mentioned, so a dangling row is reported at its own line.
    const linked = new Map();
    lines.forEach((line, i) => {
      for (const m of line.matchAll(LINK)) if (!linked.has(m[1])) linked.set(m[1], i + 1);
    });

    const findings = [];
    for (const slug of [...papers].sort()) {
      if (linked.has(slug)) continue;
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        file: INDEX,
        line: headingLine,
        what: `references/${slug}/ carries a digest but has no row in the paper index`,
        why: rule.why,
        fix: `add a row to the "## Papers" table linking [**${slug}**](${slug}/digest.md), with what the paper gives us and how many panels it contributes to the working dataset (none is a valid answer — say why)`,
        doc: rule.doc,
      });
    }
    for (const [slug, line] of [...linked].sort()) {
      if (papers.has(slug)) continue;
      findings.push({
        rule: rule.id,
        severity: rule.severity,
        file: INDEX,
        line,
        what: `the paper index links ${slug}/digest.md, which is not a tracked paper folder`,
        why: rule.why,
        fix: `point the row at the folder's current slug, or drop the row if the paper was removed — references/${slug}/digest.md is not in the repo`,
        doc: rule.doc,
      });
    }
    return findings;
  },
};

export default rule;
