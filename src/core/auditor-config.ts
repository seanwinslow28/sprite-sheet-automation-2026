/**
 * Auditor configuration resolver - merges manifest thresholds with defaults
 * Per Story 3.9: Configurable threshold management
 */

import { logger } from '../utils/logger.js';
import {
    DEFAULT_THRESHOLDS,
    THRESHOLD_DESCRIPTIONS,
    type AuditorThresholds,
} from '../domain/defaults/auditor-defaults.js';

/**
 * Resolved threshold with source tracking
 */
export interface ResolvedThreshold {
    value: number;
    source: 'manifest' | 'default';
}

/**
 * Fully resolved thresholds with source tracking
 */
export interface ResolvedThresholds {
    identity_min: ResolvedThreshold;
    palette_min: ResolvedThreshold;
    alpha_artifact_max: ResolvedThreshold;
    baseline_drift_max: ResolvedThreshold;
    composite_min: ResolvedThreshold;
    orphan_pixel_max: ResolvedThreshold;
}

/**
 * Partial thresholds from manifest (all optional)
 */
export type ManifestThresholds = Partial<AuditorThresholds>;

/**
 * Resolve thresholds by merging manifest values with defaults
 */
export function resolveThresholds(
    manifestThresholds?: ManifestThresholds
): ResolvedThresholds {
    const resolved: ResolvedThresholds = {
        identity_min: resolveOne('identity_min', manifestThresholds?.identity_min),
        palette_min: resolveOne('palette_min', manifestThresholds?.palette_min),
        alpha_artifact_max: resolveOne('alpha_artifact_max', manifestThresholds?.alpha_artifact_max),
        baseline_drift_max: resolveOne('baseline_drift_max', manifestThresholds?.baseline_drift_max),
        composite_min: resolveOne('composite_min', manifestThresholds?.composite_min),
        orphan_pixel_max: resolveOne('orphan_pixel_max', manifestThresholds?.orphan_pixel_max),
    };

    // Log effective thresholds
    logResolvedThresholds(resolved);

    return resolved;
}

/**
 * Resolve a single threshold value
 */
function resolveOne(
    key: keyof AuditorThresholds,
    manifestValue?: number
): ResolvedThreshold {
    if (manifestValue !== undefined) {
        // Validate range
        if (!isValidThreshold(key, manifestValue)) {
            logger.warn({
                key,
                manifestValue,
                usingDefault: DEFAULT_THRESHOLDS[key],
            }, `Invalid threshold value for ${key}, using default`);
            return { value: DEFAULT_THRESHOLDS[key], source: 'default' };
        }
        return { value: manifestValue, source: 'manifest' };
    }
    return { value: DEFAULT_THRESHOLDS[key], source: 'default' };
}

/**
 * Validate threshold value is within acceptable range
 */
function isValidThreshold(key: keyof AuditorThresholds, value: number): boolean {
    switch (key) {
        case 'identity_min':
        case 'palette_min':
        case 'alpha_artifact_max':
        case 'composite_min':
            return value >= 0.0 && value <= 1.0;
        case 'baseline_drift_max':
            return value >= 0 && value <= 100;
        case 'orphan_pixel_max':
            return value >= 0 && value <= 1000;
        default:
            return true;
    }
}

/**
 * Log resolved thresholds with sources
 */
function logResolvedThresholds(resolved: ResolvedThresholds): void {
    const thresholdInfo = Object.entries(resolved).map(([key, threshold]) => ({
        threshold: key,
        value: threshold.value,
        source: threshold.source,
        description: THRESHOLD_DESCRIPTIONS[key as keyof AuditorThresholds],
    }));

    logger.info({ thresholds: thresholdInfo }, 'Auditor thresholds resolved');
}

/**
 * Get flat threshold values (for use in metric calculations)
 */
export function getThresholdValues(resolved: ResolvedThresholds): AuditorThresholds {
    return {
        identity_min: resolved.identity_min.value,
        palette_min: resolved.palette_min.value,
        alpha_artifact_max: resolved.alpha_artifact_max.value,
        baseline_drift_max: resolved.baseline_drift_max.value,
        composite_min: resolved.composite_min.value,
        orphan_pixel_max: resolved.orphan_pixel_max.value,
    };
}
