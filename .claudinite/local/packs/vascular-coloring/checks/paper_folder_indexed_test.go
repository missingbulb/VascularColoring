package checks

import "testing"

const (
	paperPDFFile = "references/smith-2024-vessels/smith-2024-vessels.pdf"
	paperDigest  = "references/smith-2024-vessels/digest.md"
)

func TestPaperFolderIndexedFiresOnAPDFWithNoDigest(t *testing.T) {
	fs := run(t, paperFolderIndexed, map[string]string{
		paperPDFFile:    "%PDF",
		referencesIndex: "| [x](smith-2024-vessels/digest.md) |",
	}, paperPDFFile, referencesIndex)
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Sentence, `smith-2024-vessels has no digest\.md`)
}

func TestPaperFolderIndexedFiresOnADigestTheIndexOmits(t *testing.T) {
	fs := run(t, paperFolderIndexed, map[string]string{
		paperPDFFile:    "%PDF",
		paperDigest:     "# digest",
		referencesIndex: "| [other](other-2020-x/digest.md) |",
	}, paperPDFFile, paperDigest, referencesIndex)
	wantCount(t, fs, 1)
	if fs[0].Path != referencesIndex {
		t.Errorf("finding on %s, want %s", fs[0].Path, referencesIndex)
	}
	wantMatch(t, fs[0].Sentence, `smith-2024-vessels is not linked`)
}

func TestPaperFolderIndexedIsQuietOnADigestedIndexedPaperAndOnToolsAndSupplements(t *testing.T) {
	fs := run(t, paperFolderIndexed, map[string]string{
		paperPDFFile:    "%PDF",
		paperDigest:     "# digest",
		referencesIndex: "| [**smith**](smith-2024-vessels/digest.md) |",
		"references/smith-2024-vessels/supplementary/data.pdf": "%PDF",
		"references/_tools/notes.pdf":                         "%PDF",
	}, paperPDFFile, paperDigest, referencesIndex,
		"references/smith-2024-vessels/supplementary/data.pdf", "references/_tools/notes.pdf")
	wantCount(t, fs, 0)
}
