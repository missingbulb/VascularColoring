// Every UNCALIBRATED entry names why that panel's scale can't be measured — the
// point of the table is that no panel is uncalibrated silently, and an entry
// with no reason string defeats that the moment someone adds a key in a hurry.
//
// Companion to panel-scale-calibration, which checks that a panel appears in the
// table at all; this checks what the entry says once it is there.
const MEASURE = 'analysis/measure_vessels.py';
const BLOCK = /UNCALIBRATED\s*=\s*\{([\s\S]*?)\n\}/;
const KEY = /^\s*['"]([^'"]+)['"]\s*:/;

// Quote-aware split on top-level commas, since a reason string is free prose and
// may itself contain commas. Returns {start, text} pairs, start being the entry's
// offset within the block so a violation can be pointed at its own line.
function splitEntries(block) {
  const out = [];
  let start = 0;
  let quote = null;
  for (let i = 0; i < block.length; i += 1) {
    const c = block[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === ',') { out.push({ start, text: block.slice(start, i) }); start = i + 1; }
  }
  if (block.slice(start).trim()) out.push({ start, text: block.slice(start) });
  return out;
}

// The concatenated content of every quoted string segment after the key's colon —
// Python's implicit adjacent-literal concatenation, so 'a'\n'b' reads as "ab".
function reasonOf(entryText) {
  const value = entryText.slice(KEY.exec(entryText)[0].length);
  let out = '';
  let quote = null;
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) { quote = null; continue; }
      out += c;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
  }
  return out.trim();
}

const rule = {
  id: 'uncalibrated-reason-required',
  severity: 'blocking',
  description: 'Every UNCALIBRATED panel entry carries a reason',
  doc: '.claudinite/local/packs/vascular-coloring/RULES.md',
  why: 'a panel goes in UNCALIBRATED so its missing scale is a documented decision, not a silent gap — an entry with an empty reason is indistinguishable from nobody having explained why the bar could not be measured',

  run(ctx) {
    const text = ctx.read(MEASURE);
    if (text === null) return [];
    const m = BLOCK.exec(text);
    if (!m) return [];   // panel-scale-calibration owns "no table at all"
    const blockStart = m.index + m[0].indexOf(m[1]);

    return splitEntries(m[1])
      .filter((e) => KEY.test(e.text))
      .filter((e) => reasonOf(e.text).length === 0)
      .map((e) => {
        const key = KEY.exec(e.text)[1];
        // e.start points at the entry's own leading whitespace (including the
        // newline carried over from the previous entry's comma); skip past it
        // so the count lands on the line the key itself is written on.
        const keyOffset = blockStart + e.start + e.text.match(/^\s*/)[0].length;
        const line = text.slice(0, keyOffset).split('\n').length;
        return {
          rule: rule.id,
          severity: rule.severity,
          file: MEASURE,
          line,
          what: `UNCALIBRATED['${key}'] carries no reason`,
          why: rule.why,
          fix: `add a reason string explaining why ${key}'s scale bar could not be measured`,
          doc: rule.doc,
        };
      });
  },
};

export default rule;
