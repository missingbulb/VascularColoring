package checks

import (
	"fmt"
	"regexp"
	"slices"
	"strings"

	"claudinite.com/checksdk"
)

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
var (
	hereDef = regexp.MustCompile(`(?m)^\s*HERE\s*=\s*os\.path\.dirname\(\s*os\.path\.abspath\(\s*__file__\s*\)\s*\)`)
	// NAME = os.path.join(HERE, 'annotated')  /  os.path.join(HERE, 'a', 'b')
	hereJoin  = regexp.MustCompile(`(?:^|[^\w.])([A-Za-z_]\w*)\s*=\s*os\.path\.join\(\s*HERE\s*,\s*((?:'[^']*'|"[^"]*")(?:\s*,\s*(?:'[^']*'|"[^"]*"))*)\s*\)`)
	makedirs  = regexp.MustCompile(`os\.makedirs\(\s*([A-Za-z_]\w*)\b`)
	joinParts = regexp.MustCompile(`'([^']*)'|"([^"]*)"`)
)

func init() {
	checksdk.Register(checksdk.Check{
		ID:     "render-outputs-gitignored",
		Tags:   []string{"world"},
		OnFail: "block",
		Since:  "2026-07-29",
		Doc:    ".claudinite/local/packs/vascular-coloring/skills/vessel-overlay-review/SKILL.md",
		Why:    "overlay renders are regenerated from the scripts, not data — an output directory that is not ignored gets swept into the repo by the first `git add -A` after a run, and from then on a stale PNG is what reviewers see instead of what the current script draws",
		Run:    renderOutputsGitignored,
	})
}

func dirOf(file string) string {
	if i := strings.LastIndex(file, "/"); i >= 0 {
		return file[:i]
	}
	return ""
}

func joinPath(parts ...string) string {
	var kept []string
	for _, p := range parts {
		if p != "" {
			kept = append(kept, p)
		}
	}
	return strings.Join(kept, "/")
}

type createdDir struct {
	path string
	line int
}

// createdDirs is the directories a script creates under its own location, as
// repo-relative paths with the line of the makedirs call. Empty unless HERE is the
// script's own dir — an unrecognised layout is left alone rather than guessed at.
// Comments are stripped and string literals kept: the joined path segments ARE
// literals.
func createdDirs(file, source string) []createdDir {
	text := uncomment(source)
	if !hereDef.MatchString(text) {
		return nil
	}
	here := dirOf(file)
	consts := map[string]string{}
	for _, m := range hereJoin.FindAllStringSubmatch(text, -1) {
		segs := []string{here}
		escapes := false
		for _, p := range joinParts.FindAllStringSubmatch(m[2], -1) {
			s := p[1] + p[2] // only one of the two alternatives took part
			escapes = escapes || s == ".." || s == ""
			segs = append(segs, s)
		}
		if escapes { // escapes the script's dir
			continue
		}
		consts[m[1]] = joinPath(segs...)
	}
	var out []createdDir
	seen := map[string]bool{}
	for _, m := range makedirs.FindAllStringSubmatchIndex(text, -1) {
		path, ok := consts[text[m[2]:m[3]]]
		if !ok || path == "" || seen[path] {
			continue
		}
		seen[path] = true
		out = append(out, createdDir{path, lineAt(text, m[0])})
	}
	return out
}

type ignorePattern struct {
	base, path        string
	negated, anchored bool
}

// ignorePatterns is the ignore patterns that can cover dir: git reads a .gitignore
// per directory, so every ancestor of dir gets one — root first, deepest last, which
// is also git's precedence order (the last matching pattern wins). A .gitignore
// *inside* dir is excluded: it cannot cause its own directory to be ignored. Each
// path is normalised to a repo-relative path or a bare name git matches at any
// depth below that .gitignore's directory.
func ignorePatterns(repo checksdk.Repo, dir string) []ignorePattern {
	parts := strings.Split(dir, "/")
	segs := parts[:len(parts)-1]
	bases := []string{""}
	for i := range segs {
		b := strings.Join(segs[:i+1], "/")
		if !slices.Contains(bases, b) {
			bases = append(bases, b)
		}
	}
	var out []ignorePattern
	for _, base := range bases {
		text, ok := repo.Read(joinPath(base, ".gitignore"))
		if !ok {
			continue
		}
		for _, raw := range strings.Split(text, "\n") {
			line := trim(raw)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			negated := strings.HasPrefix(line, "!")
			body := line
			if negated {
				body = line[1:]
			}
			body = strings.TrimRight(body, "/")
			if body == "" {
				continue
			}
			p := ignorePattern{base: base, negated: negated, anchored: strings.Contains(body, "/"), path: body}
			if p.anchored {
				p.path = joinPath(base, strings.TrimLeft(body, "/"))
			}
			out = append(out, p)
		}
	}
	return out
}

func (p ignorePattern) covers(dir string) bool {
	if p.anchored {
		return dir == p.path || strings.HasPrefix(dir, p.path+"/")
	}
	// A bare name matches any path component at or below the .gitignore's directory.
	return (dir == p.base || strings.HasPrefix(dir, p.base+"/") || p.base == "") &&
		slices.Contains(strings.Split(dir, "/"), p.path)
}

// ignored follows git: the last matching pattern wins, negation included.
func ignored(repo checksdk.Repo, dir string) bool {
	var last *ignorePattern
	for _, p := range ignorePatterns(repo, dir) {
		if p.covers(dir) {
			last = &p
		}
	}
	return last != nil && !last.negated
}

func renderOutputsGitignored(repo checksdk.Repo) []checksdk.Finding {
	var out []checksdk.Finding
	for _, file := range repo.Tracked() {
		if !strings.HasSuffix(file, ".py") || strings.HasPrefix(file, shared) {
			continue
		}
		text, ok := repo.Read(file)
		if !ok {
			continue
		}
		for _, dir := range createdDirs(file, text) {
			if ignored(repo, dir.path) {
				continue
			}
			out = append(out, checksdk.Finding{
				Path:     file,
				Line:     dir.line,
				Sentence: fmt.Sprintf("%s renders into %s/, which no .gitignore entry covers", file, dir.path),
				Fix:      fmt.Sprintf("add `/%s/` to .gitignore (with a comment naming the command that regenerates it, as the existing render entries do); if %s/ holds real data or agreed ground truth rather than renders, it belongs under references/ instead", dir.path, dir.path),
			})
		}
	}
	return out
}
