// Every render the pipeline produces is written into a directory the script
// creates for itself (measure_vessels.py --overlays -> analysis/overlays/,
// annotate_overlays.py -> analysis/annotated/). Those directories are gitignored,
// which is what makes "regenerate, never commit" hold under a `git add -A` or an
// agent staging a whole directory.
//
// Sibling of rendered-overlays-untracked, from the other side: that rule fires once
// a render is already tracked (the damage), this one keeps the ignore entry that
// stops it getting there. A newly added output directory is the real gap — it is
// gitignored only if someone remembers, and nothing said so until now.
//
// Parse rather than grep: an output directory is one the script actually creates
// (`os.makedirs(...)`), resolved through the script's own `HERE` constant, with
// comments and string literals handled — a path mentioned in a docstring is not a
// directory anything writes to.
const SHARED = '.claudinite/shared/';        // read-only mounted canon
const HERE_DEF = /^\s*HERE\s*=\s*os\.path\.dirname\(\s*os\.path\.abspath\(\s*__file__\s*\)\s*\)/m;
// NAME = os.path.join(HERE, 'annotated')  /  os.path.join(HERE, 'a', 'b')
const JOIN = /(?:^|[^\w.])([A-Za-z_]\w*)\s*=\s*os\.path\.join\(\s*HERE\s*,\s*((?:'[^']*'|"[^"]*")(?:\s*,\s*(?:'[^']*'|"[^"]*"))*)\s*\)/g;
const MAKEDIRS = /os\.makedirs\(\s*([A-Za-z_]\w*)\b/g;
const PARTS = /'([^']*)'|"([^"]*)"/g;

// Comments stripped, string literals kept: the joined path segments ARE literals,
// so this only removes `#` runs that are not inside a string.
function uncomment(text) {
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

const dirOf = (file) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '');
const joinPath = (...ps) => ps.filter(Boolean).join('/');

// The directories a script creates under its own location, as repo-relative paths
// with the line of the makedirs call. Empty unless HERE is the script's own dir —
// an unrecognised layout is left alone rather than guessed at.
function createdDirs(file, source) {
  const text = uncomment(source);
  if (!HERE_DEF.test(text)) return [];
  const here = dirOf(file);
  const consts = new Map();
  for (const m of text.matchAll(JOIN)) {
    const segs = [...m[2].matchAll(PARTS)].map((p) => p[1] ?? p[2]);
    if (segs.some((s) => s === '..' || s === '')) continue;   // escapes the script's dir
    consts.set(m[1], joinPath(here, ...segs));
  }
  const out = new Map();
  for (const m of text.matchAll(MAKEDIRS)) {
    const path = consts.get(m[1]);
    if (!path || out.has(path)) continue;
    out.set(path, { path, name: m[1], line: text.slice(0, m.index).split('\n').length });
  }
  return [...out.values()];
}

// The ignore patterns that can cover `dir`: git reads a .gitignore per directory,
// so every ancestor of `dir` gets one — root first, deepest last, which is also
// git's precedence order (the last matching pattern wins). A .gitignore *inside*
// `dir` is excluded: it cannot cause its own directory to be ignored. Each entry
// is returned as { path, negated, anchored }, normalised to a repo-relative path
// or a bare name git matches at any depth below that .gitignore's directory.
function patterns(ctx, dir) {
  const segs = dir.split('/').slice(0, -1);
  const bases = ['', ...segs.map((_, i) => segs.slice(0, i + 1).join('/'))];
  const out = [];
  for (const base of new Set(bases)) {
    const text = ctx.read(joinPath(base, '.gitignore'));
    if (text === null) continue;
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const negated = line.startsWith('!');
      const body = (negated ? line.slice(1) : line).replace(/\/+$/, '');
      if (!body) continue;
      const anchored = body.includes('/');
      out.push({ base, negated, anchored, path: anchored ? joinPath(base, body.replace(/^\/+/, '')) : body });
    }
  }
  return out;
}

const covers = (p, dir) => (p.anchored
  ? dir === p.path || dir.startsWith(`${p.path}/`)
  // A bare name matches any path component at or below the .gitignore's directory.
  : (dir === p.base || dir.startsWith(`${p.base}/`) || p.base === '')
    && dir.split('/').includes(p.path));

// Last matching pattern wins in git, negation included.
function ignored(ctx, dir) {
  const hits = patterns(ctx, dir).filter((p) => covers(p, dir));
  return hits.length > 0 && !hits[hits.length - 1].negated;
}

const rule = {
  id: 'render-outputs-gitignored',
  severity: 'blocking',
  description: 'Every directory a script renders into is gitignored',
  doc: '.claudinite/local/packs/vascular-coloring/skills/vessel-overlay-review/SKILL.md',
  why: 'overlay renders are regenerated from the scripts, not data — an output directory that is not ignored gets swept into the repo by the first `git add -A` after a run, and from then on a stale PNG is what reviewers see instead of what the current script draws',

  run(ctx) {
    const out = [];
    for (const file of ctx.tracked) {
      if (!file.endsWith('.py') || file.startsWith(SHARED)) continue;
      const text = ctx.read(file);
      if (text === null) continue;
      for (const dir of createdDirs(file, text)) {
        if (ignored(ctx, dir.path)) continue;
        out.push({
          rule: rule.id,
          severity: rule.severity,
          file,
          line: dir.line,
          what: `${file} renders into ${dir.path}/, which no .gitignore entry covers`,
          why: rule.why,
          fix: `add \`/${dir.path}/\` to .gitignore (with a comment naming the command that regenerates it, as the existing render entries do); if ${dir.path}/ holds real data or agreed ground truth rather than renders, it belongs under references/ instead`,
          doc: rule.doc,
        });
      }
    }
    return out;
  },
};

export default rule;
