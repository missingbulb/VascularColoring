// The px -> um scale of every figure comes from ONE measured table: UM_PER_BAR
// and SCALEBAR_PX in analysis/measure_vessels.py. annotate_overlays.py reads them
// by importing from there, never by carrying its own copy — that is the invariant
// this check holds.
//
// Companion to scale-numbers-match-calibration, which holds the numbers quoted in
// *markdown* to that table. Markdown is all that check reads, so a second table
// defined in Python is invisible to it: the two rules cover opposite halves of the
// same single-source line.
//
// Parse rather than grep: the names are stripped of comments and of every string
// literal (including the docstrings that spell the table out) first, and only an
// assignment — `NAME =`, or an annotated `NAME: dict =` — counts. A docstring
// quoting "SCALEBAR_PX = {'fig1': 61}" documents the table; it does not define it.
const SOURCE = 'analysis/measure_vessels.py';
const SHARED = '.claudinite/shared/';        // read-only mounted canon
const CALIBRATION = ['UM_PER_BAR', 'SCALEBAR_PX'];
const ASSIGN = new RegExp(`^\\s*(${CALIBRATION.join('|')})\\s*(?::[^=\\n]+)?=(?!=)`);

// Blank out comments and string literals, keeping every newline and every column
// so line numbers and the assignment shape survive. Handles ''' / """ blocks,
// single-quoted strings and escapes; a `#` inside a string is not a comment.
function code(text) {
  const out = [];
  let i = 0;
  let quote = null;                          // the open delimiter, or null
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === '\\' && quote.length === 1) { out.push(' ', ' '); i += 2; continue; }
      if (text.startsWith(quote, i)) {
        out.push(' '.repeat(quote.length));
        i += quote.length;
        quote = null;
        continue;
      }
      out.push(c === '\n' ? '\n' : ' ');
      i += 1;
      continue;
    }
    if (c === '#') {                         // to end of line
      while (i < text.length && text[i] !== '\n') { out.push(' '); i += 1; }
      continue;
    }
    if (c === '"' || c === "'") {
      quote = text.startsWith(c.repeat(3), i) ? c.repeat(3) : c;
      out.push(' '.repeat(quote.length));
      i += quote.length;
      continue;
    }
    out.push(c);
    i += 1;
  }
  return out.join('');
}

// Every line of `text` that assigns one of the calibration names, as { name, line }.
// Only statements count: a line that starts inside an open bracket is a continuation,
// where `UM_PER_BAR=50` is a keyword argument being passed, not the table being defined.
function definitions(text) {
  const out = [];
  let depth = 0;
  code(text).split('\n').forEach((line, i) => {
    const hit = depth === 0 ? ASSIGN.exec(line) : null;
    if (hit) out.push({ name: hit[1], line: i + 1 });
    for (const c of line) {
      if ('([{'.includes(c)) depth += 1;
      else if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
    }
  });
  return out;
}

const rule = {
  id: 'calibration-single-source',
  severity: 'blocking',
  description: 'The scale-bar calibration is defined only in the extraction script',
  doc: '.claudinite/local/packs/vascular-coloring/RULES.md',
  why: 'UM_PER_BAR / SCALEBAR_PX are a measurement, not a constant — a second definition means two calibrations, and the one a given script happens to read wins silently, re-labelling its lengths and densities with a scale nobody re-measured',

  run(ctx) {
    const out = [];
    const flag = (file, line, what, fix) => out.push({
      rule: rule.id, severity: rule.severity, file, line, what, why: rule.why, fix, doc: rule.doc,
    });

    for (const file of ctx.tracked) {
      if (!file.endsWith('.py') || file.startsWith(SHARED)) continue;
      const text = ctx.read(file);
      if (text === null) continue;
      const defs = definitions(text);

      if (file === SOURCE) {
        // The source file itself: a name assigned twice is the same drift, one
        // file in. The later assignment wins and the earlier measurement is dead
        // code that still reads as the calibration.
        for (const name of CALIBRATION) {
          const mine = defs.filter((d) => d.name === name);
          if (mine.length < 2) continue;
          flag(file, mine[mine.length - 1].line,
            `${name} is assigned ${mine.length} times in ${SOURCE} (lines ${mine.map((d) => d.line).join(', ')})`,
            `keep one ${name} assignment — delete the copies, or if the bar was re-measured, replace the single definition with the new value`);
        }
        continue;
      }

      for (const def of defs) {
        flag(file, def.line,
          `${file} defines its own ${def.name}`,
          `import it instead — \`from measure_vessels import ${def.name}\`, the way the overlay script already reads the table; if a bar really was re-measured, change the value in ${SOURCE}, the one place it is measured`);
      }
    }
    return out;
  },
};

export default rule;
