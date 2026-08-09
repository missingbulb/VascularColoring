// references/README.md is the paper index: one row per paper, and the row links the
// paper's digest. An intake that stops before that row exists leaves a folder nobody
// browsing the index ever learns about — the digest is written, described and then
// invisible, and the next session re-reads a PDF that was already taken in.
//
// The row is recognised by its link target, `<slug>/digest.md`, not by the slug
// appearing somewhere in the file: prose elsewhere in the index mentions papers by
// short name ("wang-2022", "Rust's supplementary toolbox"), and a mention is not a row.
const DIGEST = /^references\/([^/]+)\/digest\.md$/;
const INDEX = 'references/README.md';

const rule = {
  id: 'paper-indexed-in-references',
  severity: 'blocking',
  description: 'Every paper folder has a row in the references index that links its digest',
  doc: 'references/README.md',
  why: 'the index is the only place that says what a paper contributes and how many panels it puts in the working dataset — a folder missing from it is invisible to anyone who has not already been told it exists, so its digest gets bypassed and its PDF re-read',

  run(ctx) {
    const text = ctx.read(INDEX);
    if (text === null) return [];
    const lines = text.split('\n');
    const heading = lines.findIndex((l) => /^##\s+Papers\s*$/.test(l)) + 1 || null;

    const papers = new Set();
    for (const f of ctx.tracked) {
      const hit = DIGEST.exec(f);
      if (hit) papers.add(hit[1]);
    }

    return [...papers].sort()
      .filter((slug) => !text.includes(`](${slug}/digest.md)`))
      .map((slug) => ({
        rule: rule.id,
        severity: rule.severity,
        file: INDEX,
        line: heading,
        what: `references/${slug}/ has a digest but no row in the paper index`,
        why: rule.why,
        fix: `add a row to the Papers table linking [**${slug}**](${slug}/digest.md), with what the paper gives us and how many panels it contributes to the working dataset (write "none" and why, if it contributes none)`,
        doc: rule.doc,
      }));
  },
};

export default rule;
