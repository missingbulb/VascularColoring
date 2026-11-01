package checks

import "testing"

const (
	shapeDigest = "references/smith-2024-vessels/digest.md"
	goodDigest  = "# d\n## 1. Why this matters to *our* task ⭐\n## 6. Extracted images\n"
)

func TestPaperDigestShapeFiresOnAMissingWhySection(t *testing.T) {
	fs := run(t, paperDigestShape, map[string]string{
		shapeDigest: "# d\n## 6. Extracted images\n",
	}, shapeDigest)
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Sentence, `lacks a "Why this matters`)
}

func TestPaperDigestShapeFiresOnAMissingImagesSection(t *testing.T) {
	fs := run(t, paperDigestShape, map[string]string{
		shapeDigest: "# d\n## 1. Why this matters to our task\n",
	}, shapeDigest)
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Sentence, `lacks an "Extracted images"`)
}

func TestPaperDigestShapeIsQuietOnAWellFormedPaperAndOnTools(t *testing.T) {
	fs := run(t, paperDigestShape, map[string]string{
		shapeDigest:                   goodDigest,
		"references/_tools/digest.md": "# not a paper",
	}, shapeDigest, "references/_tools/digest.md")
	wantCount(t, fs, 0)
}
