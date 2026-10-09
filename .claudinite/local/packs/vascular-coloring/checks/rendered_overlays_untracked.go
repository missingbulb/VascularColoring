package checks

import (
	"fmt"
	"regexp"
	"strings"

	"claudinite.com/checksdk"
)

// Rendered output lives under analysis/ (measure_vessels.py --overlays writes
// analysis/overlays/, annotate_overlays.py writes analysis/annotated/); both are
// gitignored and regenerated. The real source images live under references/.
const renderRoot = "analysis/"

var renderedImage = regexp.MustCompile(`(?i)\.(png|jpe?g|tiff?|gif|bmp|webp)$`)

func init() {
	checksdk.Register(checksdk.Check{
		ID:     "rendered-overlays-untracked",
		Tags:   []string{"world"},
		OnFail: "block",
		Since:  "2026-07-27",
		Doc:    ".claudinite/local/packs/vascular-coloring/RULES.md",
		Why:    "an overlay PNG is a regenerable render, not data — committing one freezes a snapshot that silently stops matching the scripts, and the owner's rule is that only real data or an agreed ground-truth image gets committed",
		Run:    renderedOverlaysUntracked,
	})
}

func renderedOverlaysUntracked(repo checksdk.Repo) []checksdk.Finding {
	var out []checksdk.Finding
	for _, f := range repo.Tracked() {
		if !strings.HasPrefix(f, renderRoot) || !renderedImage.MatchString(f) {
			continue
		}
		out = append(out, checksdk.Finding{
			Path:     f,
			Sentence: fmt.Sprintf("%s is a tracked image under %s", f, renderRoot),
			Fix:      "untrack it (git rm --cached) and regenerate with python3 analysis/measure_vessels.py --overlays or python3 analysis/annotate_overlays.py — commit the script and the numeric results instead; if the image really is data or agreed ground truth, put it under references/",
		})
	}
	return out
}
