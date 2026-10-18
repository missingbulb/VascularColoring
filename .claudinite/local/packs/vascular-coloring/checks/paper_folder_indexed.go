package checks

import (
	"fmt"
	"regexp"
	"strings"

	"claudinite.com/checksdk"
)

// A paper's folder is references/<slug>/<slug>.pdf. Intake is finished when the
// digest makes that PDF redundant and the paper has its row in the index, so a
// folder carrying a PDF needs both a digest.md and a README link to it.
const (
	referencesIndex = "references/README.md"
	paperPDF        = `^references/([^/_][^/]*)/([^/]+)\.pdf$`
)

var paperPDFPath = regexp.MustCompile(paperPDF)

func init() {
	checksdk.Register(checksdk.Check{
		ID:     "paper-folder-indexed",
		Tags:   []string{"world"},
		OnFail: "block",
		Since:  "2026-10-16",
		Doc:    ".claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md",
		Why:    "a paper is only finished when its digest makes the PDF redundant and the index points at it — a folder with a PDF but no digest sends the next session back into the PDF, and one the index omits is a paper nobody knows is already digested",
		Run:    paperFolderIndexed,
	})
}

func paperFolderIndexed(repo checksdk.Repo) []checksdk.Finding {
	tracked := map[string]bool{}
	for _, f := range repo.Tracked() {
		tracked[f] = true
	}
	index, _ := repo.Read(referencesIndex)
	var out []checksdk.Finding
	for _, file := range repo.Tracked() {
		m := paperPDFPath.FindStringSubmatch(file)
		if m == nil || m[1] != m[2] {
			continue
		}
		slug := m[1]
		digest := "references/" + slug + "/digest.md"
		if !tracked[digest] {
			out = append(out, checksdk.Finding{
				Path:     file,
				Sentence: fmt.Sprintf("%s has no digest.md beside its PDF", slug),
				Fix:      fmt.Sprintf("write %s following the paper-intake skill, so the PDF never has to be reopened", digest),
			})
			continue
		}
		if !strings.Contains(index, "("+slug+"/digest.md)") {
			out = append(out, checksdk.Finding{
				Path:     referencesIndex,
				Sentence: fmt.Sprintf("%s is not linked from the paper index", slug),
				Fix:      fmt.Sprintf("add its row to the Papers table in %s, linking (%s/digest.md)", referencesIndex, slug),
			})
		}
	}
	return out
}
