package checks

import (
	"fmt"
	"regexp"

	"claudinite.com/checksdk"
)

// The paper-intake skill fixes two headings every digest carries: the reason
// the paper matters to this task, and the table of its extracted images.
var (
	digestPath   = regexp.MustCompile(`^references/([^/_][^/]*)/digest\.md$`)
	whyHeading   = regexp.MustCompile(`(?mi)^#{1,6}\s.*why this matters to \*?our\*? task`)
	imageHeading = regexp.MustCompile(`(?mi)^#{1,6}\s.*extracted images`)
)

func init() {
	checksdk.Register(checksdk.Check{
		ID:     "paper-digest-shape",
		Tags:   []string{"world"},
		OnFail: "block",
		Since:  "2026-11-01",
		Doc:    ".claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md",
		Why:    "a digest is read in place of the PDF: without its \"why this matters to our task\" section the next session cannot tell what the paper changes, and without its extracted-images section the figures are unexplained pixels",
		Run:    paperDigestShape,
	})
}

func paperDigestShape(repo checksdk.Repo) []checksdk.Finding {
	var out []checksdk.Finding
	for _, file := range repo.Tracked() {
		if !digestPath.MatchString(file) {
			continue
		}
		text, _ := repo.Read(file)
		for _, want := range []struct {
			re   *regexp.Regexp
			name string
		}{
			{whyHeading, "a \"Why this matters to *our* task\" section"},
			{imageHeading, "an \"Extracted images\" section"},
		} {
			if !want.re.MatchString(text) {
				out = append(out, checksdk.Finding{
					Path:     file,
					Sentence: fmt.Sprintf("digest lacks %s", want.name),
					Fix:      "add the section the paper-intake skill's step 8 lists, so the digest stands alone",
				})
			}
		}
	}
	return out
}
