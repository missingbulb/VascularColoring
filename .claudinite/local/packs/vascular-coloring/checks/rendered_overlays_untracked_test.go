package checks

import "testing"

func TestRenderedOverlaysUntrackedFiresOnACommittedOverlayPNG(t *testing.T) {
	fs := run(t, renderedOverlaysUntracked, nil,
		"analysis/annotated/VESSEL_fig3_ischemic_gP-CD31_red.png", "analysis/measure_vessels.py")
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Path, `^analysis/annotated/`)
}

func TestRenderedOverlaysUntrackedIsQuietOnScriptsPlusSourceImages(t *testing.T) {
	fs := run(t, renderedOverlaysUntracked, nil,
		"analysis/measure_vessels.py",
		"analysis/results-first-pass.md",
		"references/wang-2022-cd31-vascular-network/figures/panels/VESSEL_fig3_ischemic_gP-CD31_red.png",
	)
	wantCount(t, fs, 0)
}
