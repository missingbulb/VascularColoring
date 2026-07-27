// The extraction script is the single place the three locked metrics are
// computed and named; every downstream table, overlay banner and results
// markdown quotes those field names back.
const MEASURE = 'analysis/measure_vessels.py';

// The professor's three asks, and the metric fields each one is locked to.
const LOCKED = [
  { ask: 'COUNT', meaning: 'branch segments (junction-to-junction / junction-to-tip)', fields: ['segments'] },
  { ask: 'CATEGORIZE', meaning: 'caliber - capillary vs penetrating artery by centerline diameter', fields: ['capillary', 'artery'] },
  { ask: 'MEASURE', meaning: 'total centerline length, as raw um and as density', fields: ['length_um', 'length_density'] },
];

// Parse rather than grep: the metric names count only where they are built as
// keyword fields of a dict(...) construction, never where prose, a docstring or
// a print format string happens to mention them. `defaultdict(` is not a dict
// construction here, hence the non-word/non-dot lookbehind.
const DICT = /(?<![\w.])dict\s*\(/g;
const KWARG = /(?:^|[(,]\s*)([A-Za-z_]\w*)\s*=(?!=)/g;

// The real metrics dict carries trailing `#` comments between its fields, which
// would otherwise sit between a field and the comma that anchors the next one.
// Blank them (keeping the newline) rather than the whole line, so line numbers
// still count. Quote-aware: a `#` inside a string literal is not a comment.
function stripComments(text) {
  return text.split('\n').map((line) => {
    let quote = null;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (quote) {
        if (c === '\\') i += 1;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === '#') return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

// The fields of every dict(...) built in the script, with the line the first
// dict carrying a locked field starts on (where a reviewer should look).
function reportedFields(source) {
  const text = stripComments(source);
  const fields = new Set();
  let dicts = 0;
  let line = null;
  for (const m of text.matchAll(DICT)) {
    dicts += 1;
    let depth = 0;
    let end = m.index + m[0].length - 1;
    for (; end < text.length; end += 1) {
      if (text[end] === '(') depth += 1;
      else if (text[end] === ')' && (depth -= 1) === 0) break;
    }
    const body = text.slice(m.index, end + 1);
    const here = [...body.matchAll(KWARG)].map((k) => k[1]);
    if (line === null && here.some((f) => LOCKED.some((l) => l.fields.includes(f)))) {
      line = text.slice(0, m.index).split('\n').length;
    }
    here.forEach((f) => fields.add(f));
  }
  return { fields, dicts, line };
}

const rule = {
  id: 'locked-metric-fields',
  severity: 'blocking',
  description: 'The extraction script still reports all three locked metrics',
  doc: '.claudinite/local/packs/vascular-coloring/RULES.md',
  why: 'COUNT / CATEGORIZE / MEASURE are locked definitions - dropping or renaming one of their fields changes what every recorded number means, and it fails silently: the metric just stops appearing in the tables it used to anchor',

  run(ctx) {
    const text = ctx.read(MEASURE);
    if (text === null) return [];
    const { fields, dicts, line } = reportedFields(text);
    if (dicts === 0) {
      return [{
        rule: rule.id,
        severity: rule.severity,
        file: MEASURE,
        line: null,
        what: 'no metrics dict found in the extraction script',
        why: rule.why,
        fix: 'keep the per-panel metrics built as a dict(field=...) in this file - it is the one place the locked metric names are defined',
        doc: rule.doc,
      }];
    }
    return LOCKED
      .map((lock) => ({ lock, missing: lock.fields.filter((f) => !fields.has(f)) }))
      .filter(({ missing }) => missing.length)
      .map(({ lock, missing }) => ({
        rule: rule.id,
        severity: rule.severity,
        file: MEASURE,
        line,
        what: `${lock.ask} is locked to ${lock.meaning}, but the metrics dict reports no ${missing.join(' / ')} field`,
        why: rule.why,
        fix: `report ${missing.join(' and ')} again from the metrics dict; if the definition of ${lock.ask} really is changing, that is an owner decision - unlock it in the pack RULES.md first, then re-record every number that was measured under the old definition`,
        doc: rule.doc,
      }));
  },
};

export default rule;
