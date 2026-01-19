/**
 * Auditor default thresholds with documented rationale
 * Per Story 3.9: Default values for quality gates
 */

/**
 * Auditor threshold configuration interface
 */
export interface AuditorThresholds {
    // Soft metric thresholds
    identity_min: number;           // SSIM minimum (0.0-1.0)
    palette_min: number;            // Palette fidelity minimum (0.0-1.0)
    alpha_artifact_max: number;     // Alpha artifact severity maximum (0.0-1.0)
    baseline_drift_max: number;     // Baseline drift maximum (pixels)
    composite_min: number;          // Composite score minimum (0.0-1.0)
    orphan_pixel_max: number;       // Orphan pixel count maximum
}

/**
 * Default threshold values with documented rationale
 */
export const DEFAULT_THRESHOLDS: AuditorThresholds = {
    /**
     * identity_min: 0.85
     * Rationale: SSIM of 0.85+ indicates strong structural similarity.
     * Characters may have pose variations but core identity preserved.
     * Lower values suggest significant identity drift.
     */
    identity_min: 0.85,

    /**
     * palette_min: 0.90
     * Rationale: 90% of pixels should match the defined palette.
     * Allows for minor anti-aliasing or subtle variations.
     * Lower values indicate off-palette color bleeding.
     */
    palette_min: 0.90,

    /**
     * alpha_artifact_max: 0.20
     * Rationale: Up to 20% of edge pixels can have minor artifacts.
     * Pixel art often has intentional edge effects.
     * Higher values indicate problematic halos or fringe.
     */
    alpha_artifact_max: 0.20,

    /**
     * baseline_drift_max: 4 pixels
     * Rationale: At 128px target size, 4px drift is ~3% of canvas.
     * Allows for minor vertical variation in dynamic poses.
     * Larger drift causes visible "swimming" in animations.
     */
    baseline_drift_max: 4,

    /**
     * composite_min: 0.70
     * Rationale: Weighted average across all metrics.
     * 70% threshold allows frames with one weak area to pass.
     * Frames below 70% are flagged for retry.
     */
    composite_min: 0.70,

    /**
     * orphan_pixel_max: 15
     * Rationale: Up to 15 orphan pixels is acceptable.
     * Some intentional single pixels exist in pixel art (eyes, highlights).
     * Higher counts indicate downsampling artifacts.
     */
    orphan_pixel_max: 15,
};

/**
 * Threshold descriptions for logging
 */
export const THRESHOLD_DESCRIPTIONS: Record<keyof AuditorThresholds, string> = {
    identity_min: 'Minimum SSIM score for identity preservation',
    palette_min: 'Minimum palette fidelity percentage',
    alpha_artifact_max: 'Maximum alpha artifact severity',
    baseline_drift_max: 'Maximum baseline drift in pixels',
    composite_min: 'Minimum composite score for passing',
    orphan_pixel_max: 'Maximum orphan pixel count before soft fail',
};
