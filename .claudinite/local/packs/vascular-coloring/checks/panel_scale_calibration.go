package checks

import (
	"fmt"
	"regexp"
	"sort"
	"strings"

	"claudinite.com/checksdk"
)

// Every panel in the working dataset is named VESSEL_<prefix>_... and lives under
// references/<paper-slug>/figures/panels/. The px -> um scale is measured from the scale bar
// the figure prints and tabulated as SCALEBAR_PX in the extraction script, keyed by panel-name
// prefix (longest match wins) so one figure can calibrate rows that differ in zoom.
//
// A panel may instead carry its scale DIRECTLY, in UMPP_DIRECT, when the source image's own
// metadata states um/px and no bar is involved — stronger evidence than a measured bar.
//
// A panel whose scale genuinely cannot be measured — the figure draws no bar — is not a
// violation, but it must SAY so: an entry in UNCALIBRATED, carrying the reason. The point of
// this rule is that no panel is uncalibrated by accident.
const scaleSource = "analysis/measure_vessels.py"

var (
	workingPanel     = regexp.MustCompile(`(?i)^references/[^/]+/figures/panels/VESSEL_(.+)\.png$`)
	scalebarTable    = regexp.MustCompile(`SCALEBAR_PX\s*=\s*\{([\s\S]*?)\}`)
	directTable      = regexp.MustCompile(`UMPP_DIRECT\s*=\s*\{([\s\S]*?)\n\}`)
	uncalibratedDecl = regexp.MustCompile(`UNCALIBRATED\s*=\s*\{([\s\S]*?)\n\}`)
	tableKey         = regexp.MustCompile(`['"]([^'"]+)['"]\s*:`)
	// The wang-2022 panels carry a channel suffix the calibration keys never include.
	channelSuffix = regexp.MustCompile(`_gP-CD31_red$`)
)

func init() {
	checksdk.Register(checksdk.Check{
		ID:     "panel-scale-calibration",
		Tags:   []string{"world"},
		OnFail: "block",
		Since:  "2026-07-27",
		Doc:    ".claudinite/local/packs/vascular-coloring/RULES.md",
		Why:    `an uncalibrated figure does not fail — it silently reports "um n/a" and drops out of every length and density number, so a panel added without its bar measurement quietly shrinks the result set`,
		Run:    panelScaleCalibration,
	})
}

// tableKeys is the quoted keys of the table body re's first group captures in
// text, none when re does not match.
func tableKeys(re *regexp.Regexp, text string) []string {
	m := re.FindStringSubmatch(text)
	if m == nil {
		return nil
	}
	var out []string
	for _, k := range tableKey.FindAllStringSubmatch(m[1], -1) {
		out = append(out, k[1])
	}
	return out
}

func panelScaleCalibration(repo checksdk.Repo) []checksdk.Finding {
	text, ok := repo.Read(scaleSource)
	if !ok {
		return nil
	}
	if !scalebarTable.MatchString(text) {
		return []checksdk.Finding{{
			Path:     scaleSource,
			Sentence: "no SCALEBAR_PX table found",
			Fix:      "keep the per-prefix scale-bar widths in a SCALEBAR_PX = { ... } table in this file — it is the single calibration source annotate_overlays.py imports",
		}}
	}
	var keys []string
	for _, re := range []*regexp.Regexp{scalebarTable, directTable, uncalibratedDecl} {
		keys = append(keys, tableKeys(re, text)...)
	}
	covers := func(name string) bool {
		for _, k := range keys {
			if strings.HasPrefix(name, k) {
				return true
			}
		}
		return false
	}
	tableLine := 0
	for i, l := range strings.Split(text, "\n") {
		if strings.Contains(l, "SCALEBAR_PX") {
			tableLine = i + 1
			break
		}
	}

	seen := map[string]bool{}
	var panels []string
	for _, f := range repo.Tracked() {
		if hit := workingPanel.FindStringSubmatch(f); hit != nil {
			name := channelSuffix.ReplaceAllString(hit[1], "")
			if !seen[name] {
				seen[name] = true
				panels = append(panels, name)
			}
		}
	}
	sort.Strings(panels)
	var out []checksdk.Finding
	for _, name := range panels {
		if covers(name) {
			continue
		}
		out = append(out, checksdk.Finding{
			Path:     scaleSource,
			Line:     tableLine,
			Sentence: fmt.Sprintf("VESSEL_%s matches no SCALEBAR_PX, UMPP_DIRECT or UNCALIBRATED prefix", name),
			Fix:      "measure the scale bar printed on that panel's row and add a '<prefix>': <bar width in px> entry to SCALEBAR_PX (plus SCALEBAR_UM if the bar is not 50 um); or, if the source image states its own um/px, put it in UMPP_DIRECT with its provenance; or, if the figure draws no bar at all, add the prefix to UNCALIBRATED with the reason",
		})
	}
	return out
}
