package checks

import (
	"fmt"
	"regexp"

	"claudinite.com/checksdk"
)

// The paper-intake skill names a paper's folder <first-author>-<year>-<topic>
// and its PDF after the folder, so calibration prefixes and links stay stable.
var (
	paperFolderFile = regexp.MustCompile(`^references/([^/_][^/]*)/([^/]+)$`)
	paperSlug       = regexp.MustCompile(`^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*-(19|20)[0-9]{2}-[a-z0-9]+(-[a-z0-9]+)*$`)
	pdfName         = regexp.MustCompile(`^(.+)\.pdf$`)
)

func init() {
	checksdk.Register(checksdk.Check{
		ID:     "paper-slug-shape",
		Tags:   []string{"world"},
		OnFail: "block",
		Since:  "2026-11-22",
		Doc:    ".claudinite/local/packs/vascular-coloring/skills/paper-intake/SKILL.md",
		Why:    "a paper's slug keys its folder, its PDF and the links into its digest; an off-format folder or a PDF that keeps its download name cannot be found by the next session or matched to the index",
		Run:    paperSlugShape,
	})
}

func paperSlugShape(repo checksdk.Repo) []checksdk.Finding {
	var out []checksdk.Finding
	badFolder := map[string]bool{}
	for _, file := range repo.Tracked() {
		m := paperFolderFile.FindStringSubmatch(file)
		if m == nil {
			continue
		}
		folder := m[1]
		if !paperSlug.MatchString(folder) && !badFolder[folder] {
			badFolder[folder] = true
			out = append(out, checksdk.Finding{
				Path:     "references/" + folder,
				Sentence: fmt.Sprintf("folder %q is not <first-author>-<year>-<short-topic>", folder),
				Fix:      "rename it to the paper-intake slug format: lowercase, hyphen-separated, author then four-digit year then topic",
			})
		}
		if p := pdfName.FindStringSubmatch(m[2]); p != nil && p[1] != folder {
			out = append(out, checksdk.Finding{
				Path:     file,
				Sentence: fmt.Sprintf("PDF is named %q, not after its folder %q", p[1], folder),
				Fix:      fmt.Sprintf("git mv it to references/%s/%s.pdf", folder, folder),
			})
		}
	}
	return out
}
