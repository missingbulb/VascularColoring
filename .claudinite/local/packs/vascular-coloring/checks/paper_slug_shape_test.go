package checks

import "testing"

func TestPaperSlugShapeFiresOnAnOffFormatFolder(t *testing.T) {
	f := "references/Smith_vessels/digest.md"
	fs := run(t, paperSlugShape, map[string]string{f: "x"}, f)
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Sentence, `not <first-author>-<year>`)
}

func TestPaperSlugShapeFiresOnAPdfKeepingItsDownloadName(t *testing.T) {
	f := "references/smith-2024-vessels/1-s2.0-S0000-main.pdf"
	fs := run(t, paperSlugShape, map[string]string{f: "x"}, f)
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Sentence, `not after its folder`)
}

func TestPaperSlugShapeIsQuietOnConformingPapersAndTools(t *testing.T) {
	a := "references/freitas-andrade-2022-pyvane-endothelial-networks/freitas-andrade-2022-pyvane-endothelial-networks.pdf"
	b := "references/freitas-andrade-2022-pyvane-endothelial-networks/digest.md"
	c := "references/_tools/extract_pdf_assets.py"
	d := "references/README.md"
	fs := run(t, paperSlugShape, map[string]string{a: "x", b: "x", c: "x", d: "x"}, a, b, c, d)
	wantCount(t, fs, 0)
}
