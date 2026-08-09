// One folder per paper under references/, named for the paper itself:
// `<first-author>-<year>-<short-topic>`, lowercase and hyphenated — and the article
// PDF inside it carries that same slug. The folder is identified by its digest.md,
// which is the one file every paper folder has (references/_tools/ has none, so it
// is never a paper).
//
// The failure this catches is the download name: a PDF arrives as
// `41598_2022_26361_MOESM1_ESM.pdf` or `fnins-14-00244.pdf` and gets committed under
// it, so the folder no longer says which article it holds and every link to "the
// PDF" has to be looked up rather than derived. Supplementary material is out of
// scope — it lives in `<slug>/supplementary/` and keeps the publisher's own names.
const DIGEST = /^references\/([^/]+)\/digest\.md$/;
const TOP_PDF = /^references\/([^/]+)\/([^/]+\.pdf)$/i;

// <first-author>-<year>-<short-topic>: the author part may itself be hyphenated
// (freitas-andrade), the year is four digits, and at least one topic word follows.
const SLUG = /^[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-(?:19|20)\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;

const rule = {
  id: 'paper-folder-layout',
  severity: 'blocking',
  description: 'Every reference folder is named <first-author>-<year>-<short-topic> and holds its PDF under that same slug',
  doc: 'references/README.md',
  why: 'the folder name is how every digest, figure path and calibration prefix identifies its paper — a slug that does not name the article, or a PDF still wearing its publisher download name, makes the folder unreadable without opening it, which is the one thing the intake exists to avoid',

  run(ctx) {
    const papers = new Set();
    for (const f of ctx.tracked) {
      const hit = DIGEST.exec(f);
      if (hit) papers.add(hit[1]);
    }
    if (papers.size === 0) return [];

    const out = [];
    for (const slug of [...papers].sort()) {
      if (!SLUG.test(slug)) {
        out.push({
          rule: rule.id,
          severity: rule.severity,
          file: `references/${slug}/digest.md`,
          line: null,
          what: `reference folder '${slug}' is not a <first-author>-<year>-<short-topic> slug`,
          why: rule.why,
          fix: `rename the folder to <first-author>-<year>-<short-topic>, lowercase and hyphenated (e.g. rust-2020-fiji-vascular-analysis), and git mv the PDF inside it to <slug>.pdf`,
          doc: rule.doc,
        });
      }
      for (const f of ctx.tracked) {
        const hit = TOP_PDF.exec(f);
        if (!hit || hit[1] !== slug) continue;
        // Only the extension is matched case-insensitively — the stem must be the slug itself.
        if (hit[2].replace(/\.pdf$/i, '') === slug) continue;
        out.push({
          rule: rule.id,
          severity: rule.severity,
          file: f,
          line: null,
          what: `${hit[2]} sits in references/${slug}/ under a name that is not ${slug}.pdf`,
          why: rule.why,
          fix: `git mv it to references/${slug}/${slug}.pdf — the article keeps its content but not its download name; if it is supplementary material rather than the article, move it under references/${slug}/supplementary/ instead`,
          doc: rule.doc,
        });
      }
    }
    return out;
  },
};

export default rule;
