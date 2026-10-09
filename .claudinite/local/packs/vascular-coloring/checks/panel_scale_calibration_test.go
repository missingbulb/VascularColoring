package checks

import (
	"fmt"
	"strings"
	"testing"
)

const measureScript = "analysis/measure_vessels.py"

func withTable(keys, uncal, direct []string) string {
	var entries, d, u []string
	for _, k := range keys {
		entries = append(entries, fmt.Sprintf("'%s': 61", k))
	}
	for _, k := range direct {
		d = append(d, fmt.Sprintf("    '%s': 0.606,", k))
	}
	for _, k := range uncal {
		u = append(u, fmt.Sprintf("    '%s': 'no bar drawn',", k))
	}
	return "UM_PER_BAR = 50.0\nSCALEBAR_PX = {" + strings.Join(entries, ", ") + "}\n" +
		"UMPP_DIRECT = {\n" + strings.Join(d, "\n") + "\n}\n" +
		"UNCALIBRATED = {\n" + strings.Join(u, "\n") + "\n}\n"
}

const wangPanels = "references/wang-2022-cd31-vascular-network/figures/panels"

func TestPanelScaleCalibrationFiresOnAPanelWithNoBarMeasurement(t *testing.T) {
	fs := run(t, panelScaleCalibration, map[string]string{measureScript: withTable([]string{"fig1"}, nil, nil)},
		wangPanels+"/VESSEL_fig1_C1_healthy_gP-CD31_red.png",
		wangPanels+"/VESSEL_fig9_ischemic_gP-CD31_red.png",
	)
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Sentence, `fig9`)
	wantLine(t, fs[0], 2)
}

func TestPanelScaleCalibrationIsQuietWhenEveryPanelIsCalibrated(t *testing.T) {
	fs := run(t, panelScaleCalibration, map[string]string{measureScript: withTable([]string{"fig1", "fig3"}, nil, nil)},
		wangPanels+"/VESSEL_fig1_C1_healthy_gP-CD31_red.png",
		wangPanels+"/VESSEL_fig3_ischemic_gP-CD31_red.png",
		// fig7 has panels but no VESSEL_ panel — not in the working dataset.
		wangPanels+"/fig7_capillaries_gP-CD31.png",
	)
	wantCount(t, fs, 0)
}

func TestPanelScaleCalibrationAcceptsAPanelDeclaredUncalibratedWithItsReason(t *testing.T) {
	fs := run(t, panelScaleCalibration, map[string]string{measureScript: withTable([]string{"fig1"}, []string{"rust20fig2_overview"}, nil)},
		wangPanels+"/VESSEL_fig1_C1_healthy_gP-CD31_red.png",
		"references/rust-2020-fiji-vascular-analysis/figures/panels/VESSEL_rust20fig2_overview_intact_vasculature.png",
	)
	wantCount(t, fs, 0)
}

func TestPanelScaleCalibrationAcceptsAPanelCalibratedFromItsOwnImageMetadata(t *testing.T) {
	fs := run(t, panelScaleCalibration, map[string]string{measureScript: withTable([]string{"fig1"}, nil, []string{"rust20suppl_representative"})},
		"references/rust-2020-fiji-vascular-analysis/figures/panels/VESSEL_rust20suppl_representative.png",
	)
	wantCount(t, fs, 0)
}

func TestPanelScaleCalibrationStillFiresOnASecondPapersUncoveredPanel(t *testing.T) {
	fs := run(t, panelScaleCalibration, map[string]string{measureScript: withTable([]string{"fig1"}, []string{"rust20fig2_overview"}, nil)},
		"references/rust-2020-fiji-vascular-analysis/figures/panels/VESSEL_rust20fig3_overview_AD_vasculature.png",
	)
	wantCount(t, fs, 1)
	wantMatch(t, fs[0].Sentence, `rust20fig3_overview_AD_vasculature`)
}
