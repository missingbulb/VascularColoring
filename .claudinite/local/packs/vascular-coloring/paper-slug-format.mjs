// Every references/ paper folder is identified by carrying a digest.md (paper-intake
// step 8 requires one, unconditionally, for every folder it creates) — that is the
// signal used to tell a paper folder from a utility one like references/_tools/.
//
// Companion to panel-scale-calibration (which holds VESSEL_ panel calibration to the
// script's own table) and calibration-single-source (which holds the calibration
// table itself to one file): this rule holds the paper folder's own name and its
// PDF's filename to the slug contract every cross-reference in the digests, the
// calibration prefixes and references/README.md's index assume.
const SLUG = /^[a-z]+(?:-[a-z]+)*-\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST = /^references\/([^/]+)\/digest\.md$/;
const TOP_LEVEL_PDF = /^references\/([^/]+)\/([^/]+\.pdf)$/i;

const rule = {
  id: 'paper-slug-format',
  severity: 'blocking',
  since: '2026-09-07',
  description: 'Every references/ paper folder follows the <author>-<year>-<topic> slug and holds its PDF under that name',
  doc: '.claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md',
  why: 'the slug is what keeps a paper folder self-contained and its calibration prefix unique - a folder that does not match <first-author>-<year>-<short-topic>, or a PDF still carrying its download name, breaks the one naming contract every digest cross-reference and every VESSEL_ panel prefix assumes',

  run(ctx) {
    const out = [];
    const flag = (file, what, fix) => out.push({
      rule: rule.id, severity: rule.severity, since: rule.since, file, line: null, what, why: rule.why, fix, doc: rule.doc,
    });

    // slug -> PDF basenames tracked directly under references/<slug>/ (never a
    // level deeper - a PDF under <slug>/supplementary/ is supplementary material,
    // not the paper itself, and is none of this rule's business).
    const slugs = new Map();
    for (const file of ctx.tracked) {
      const m = DIGEST.exec(file);
      if (m) slugs.set(m[1], slugs.get(m[1]) ?? []);
    }
    for (const file of ctx.tracked) {
      const m = TOP_LEVEL_PDF.exec(file);
      if (m && slugs.has(m[1])) slugs.get(m[1]).push(m[2]);
    }

    for (const [slug, pdfs] of slugs) {
      const digestFile = `references/${slug}/digest.md`;
      if (!SLUG.test(slug)) {
        flag(digestFile,
          `references/${slug}/ does not follow the <first-author>-<year>-<short-topic> slug`,
          `rename the folder (and every path under it, its PDF included) to a lowercase, hyphenated <first-author>-<year>-<short-topic> slug`);
        continue; // a malformed slug makes "does the PDF match it" moot
      }
      const wantPdf = `${slug}.pdf`;
      if (pdfs.length === 0) {
        flag(digestFile,
          `references/${slug}/ has no ${wantPdf}`,
          `git mv the source PDF into references/${slug}/${wantPdf} - the original file keeps its content, not its download name`);
      } else if (!pdfs.includes(wantPdf)) {
        flag(digestFile,
          `references/${slug}/ carries ${pdfs.join(', ')} instead of ${wantPdf}`,
          `git mv references/${slug}/${pdfs[0]} references/${slug}/${wantPdf}`);
      }
    }
    return out;
  },
};

export default rule;
