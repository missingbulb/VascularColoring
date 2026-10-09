package checks

import (
	"strings"
	"testing"
)

func renderScript(dir string) string {
	return strings.Join([]string{
		`#!/usr/bin/env python3`,
		`"""Writes PNGs to analysis/reports/ (gitignored)."""`,
		`import os`,
		`HERE = os.path.dirname(os.path.abspath(__file__))`,
		`OUT = os.path.join(HERE, '` + dir + `')`,
		`SRC = os.path.normpath(os.path.join(HERE, '..', 'references'))`,
		``,
		`def main():`,
		`    os.makedirs(OUT, exist_ok=True)`,
		`    canvas.save(os.path.join(OUT, name + '.png'))`,
	}, "\n")
}

var renderIgnores = strings.Join([]string{"# generated overlays", "/analysis/overlays/", "/analysis/annotated/", "__pycache__/"}, "\n")

func TestRenderOutputsGitignoredFiresOnANewOutputDirectoryNobodyIgnored(t *testing.T) {
	fs := run(t, renderOutputsGitignored, map[string]string{
		annotateScript: renderScript("reports"),
		".gitignore":   renderIgnores,
	}, annotateScript, ".gitignore")
	wantCount(t, fs, 1)
	if fs[0].Path != annotateScript {
		t.Errorf("finding on %s, want %s", fs[0].Path, annotateScript)
	}
	wantLine(t, fs[0], 9)
	wantMatch(t, fs[0].Sentence, `analysis/reports/, which no .gitignore entry covers`)
}

func TestRenderOutputsGitignoredFiresWhenAnEntryIsUnIgnoredByALaterNegation(t *testing.T) {
	fs := run(t, renderOutputsGitignored, map[string]string{
		annotateScript: renderScript("annotated"),
		".gitignore":   renderIgnores + "\n!/analysis/annotated/\n",
	}, annotateScript, ".gitignore")
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Sentence, `analysis/annotated/`)
}

func TestRenderOutputsGitignoredIsQuietWhenEveryRenderDirectoryIsIgnored(t *testing.T) {
	const expectations = "references/wang-2022-cd31-vascular-network/figures/panels/expected-results.md"
	fs := run(t, renderOutputsGitignored, map[string]string{
		annotateScript: renderScript("annotated"),
		measureScript:  renderScript("overlays"),
		".gitignore":   renderIgnores,
		// A source tree the scripts only read from is not an output directory.
		expectations: "# expectations\n",
	}, annotateScript, measureScript, ".gitignore", expectations)
	wantCount(t, fs, 0)
}

func TestRenderOutputsGitignoredHonoursAGitignoreBesideTheScripts(t *testing.T) {
	fs := run(t, renderOutputsGitignored, map[string]string{
		annotateScript:        renderScript("annotated"),
		".gitignore":          "__pycache__/\n",
		"analysis/.gitignore": "annotated/\n",
	}, annotateScript, ".gitignore", "analysis/.gitignore")
	wantCount(t, fs, 0)
}
