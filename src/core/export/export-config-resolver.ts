/**
 * Export Configuration Resolver
 * Story 5.9: Implement Export Settings Configuration
 *
 * Handles merging of locked TexturePacker flags with custom flags,
 * resolving output paths, and validating export configuration.
 */

import path from 'path';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';

/**
 * Locked TexturePacker flags that CANNOT be overridden
 * These are required for Phaser compatibility
 */
export const LOCKED_FLAGS = new Set([
    '--format',
    '--trim-mode',
    '--extrude',
    '--shape-padding',
    '--border-padding',
    '--disable-rotation',
    '--alpha-handling',
    '--trim-sprite-names',
    '--prepend-folder-name',
]);

/**
 * Locked flag values (these must be used as-is)
 */
export const LOCKED_TEXTUREPACKER_FLAGS: string[] = [
    '--format', 'phaser',
    '--trim-mode', 'Trim',
    '--extrude', '1',
    '--shape-padding', '2',
    '--border-padding', '2',
    '--disable-rotation',
    '--alpha-handling', 'ReduceBorderArtifacts',
    '--trim-sprite-names',
    '--prepend-folder-name',
];

/**
 * Allowed custom flags that operators can specify
 */
export const ALLOWED_FLAGS = new Set([
    '--max-size',
    '--multipack',
    '--scale',
    '--size-constraints',
    '--algorithm',
    '--pack-mode',
]);

/**
 * Supported atlas formats (only phaser for MVP)
 */
export type AtlasFormat = 'phaser';

/**
 * Export configuration from manifest
 */
export interface ExportConfig {
    packerFlags?: string[];
    atlasFormat?: AtlasFormat;
    outputPath?: string;
}

/**
 * Resolved export configuration with all paths and flags computed
 */
export interface ResolvedExportConfig {
    /** Merged flags (locked + allowed custom) */
    packerFlags: string[];
    /** Atlas format */
    atlasFormat: AtlasFormat;
    /** Staging folder for frame prep */
    stagingPath: string;
    /** Export folder within run directory */
    exportPath: string;
    /** Custom output target (if specified) */
    outputPath?: string;
    /** Custom flags that were applied */
    customFlagsApplied: string[];
    /** Custom flags that were rejected */
    customFlagsRejected: string[];
}

/**
 * Result of flag merging
 */
export interface MergeFlagsResult {
    merged: string[];
    rejected: string[];
}

/**
 * Default export configuration
 */
export const DEFAULT_EXPORT_CONFIG: Required<Omit<ExportConfig, 'outputPath'>> = {
    packerFlags: [],
    atlasFormat: 'phaser',
};

/**
 * Zod schema for export config (snake_case for manifest)
 */
export const exportConfigSchema = z.object({
    packer_flags: z.array(z.string()).optional().default([]),
    atlas_format: z.enum(['phaser']).optional().default('phaser'),
    output_path: z.string().optional(),
}).optional().default({});

/**
 * Check if a flag is a locked flag
 *
 * @param flag - Flag to check (e.g., "--format")
 * @returns True if the flag is locked
 */
export function isLockedFlag(flag: string): boolean {
    return LOCKED_FLAGS.has(flag);
}

/**
 * Check if a flag is an allowed custom flag
 *
 * @param flag - Flag to check
 * @returns True if the flag is allowed
 */
export function isAllowedFlag(flag: string): boolean {
    return ALLOWED_FLAGS.has(flag);
}

/**
 * Merge locked TexturePacker flags with custom flags
 * Locked flags cannot be overridden for Phaser compatibility
 *
 * @param lockedFlags - The locked flags array
 * @param customFlags - Custom flags from manifest
 * @returns Merged flags and list of rejected flags
 */
export function mergePackerFlags(
    lockedFlags: string[],
    customFlags: string[]
): MergeFlagsResult {
    const rejected: string[] = [];
    const allowed: string[] = [];

    for (let i = 0; i < customFlags.length; i++) {
        const flag = customFlags[i];

        // Check if this is a locked flag (cannot override)
        if (isLockedFlag(flag)) {
            rejected.push(flag);
            // Skip the value too if this flag has a value
            if (i + 1 < customFlags.length && !customFlags[i + 1].startsWith('--')) {
                i++; // Skip the value
            }
            continue;
        }

        // Add the flag (and its value if present)
        allowed.push(flag);
    }

    // Log warning if any flags were rejected
    if (rejected.length > 0) {
        logger.warn({
            event: 'custom_flags_rejected',
            rejected,
            reason: 'These flags are locked for Phaser compatibility',
        });
    }

    return {
        merged: [...lockedFlags, ...allowed],
        rejected,
    };
}

/**
 * Resolve export configuration from manifest config
 *
 * @param config - Export config from manifest (may be undefined)
 * @param runId - Run identifier
 * @param runsDir - Base runs directory
 * @returns Resolved export configuration
 */
export function resolveExportConfig(
    config: ExportConfig | undefined,
    runId: string,
    runsDir: string
): ResolvedExportConfig {
    const exportConfig = config ?? {};

    // Merge flags
    const { merged, rejected } = mergePackerFlags(
        LOCKED_TEXTUREPACKER_FLAGS,
        exportConfig.packerFlags ?? []
    );

    // Determine custom flags that were actually applied
    const customFlagsApplied = (exportConfig.packerFlags ?? []).filter(
        f => !isLockedFlag(f)
    );

    // Resolve paths
    const runDir = path.join(runsDir, runId);

    // Resolve custom output path (relative to project root)
    let resolvedOutputPath: string | undefined;
    if (exportConfig.outputPath) {
        resolvedOutputPath = path.resolve(exportConfig.outputPath);
    }

    return {
        packerFlags: merged,
        atlasFormat: exportConfig.atlasFormat ?? 'phaser',
        stagingPath: path.join(runDir, 'export_staging'),
        exportPath: path.join(runDir, 'export'),
        outputPath: resolvedOutputPath,
        customFlagsApplied,
        customFlagsRejected: rejected,
    };
}

/**
 * Convert internal camelCase to external snake_case format
 */
export function toExternalExportConfig(
    resolved: ResolvedExportConfig
): Record<string, unknown> {
    return {
        packer_flags: resolved.packerFlags,
        atlas_format: resolved.atlasFormat,
        staging_path: resolved.stagingPath,
        export_path: resolved.exportPath,
        output_path: resolved.outputPath,
        custom_flags_applied: resolved.customFlagsApplied,
        custom_flags_rejected: resolved.customFlagsRejected,
    };
}

/**
 * Validate that atlas format is supported
 *
 * @param format - Format to validate
 * @returns True if supported (only "phaser" for MVP)
 */
export function isValidAtlasFormat(format: string): format is AtlasFormat {
    return format === 'phaser';
}

/**
 * Get TexturePacker format flag value for atlas format
 *
 * @param format - Atlas format
 * @returns TexturePacker --format value
 */
export function getTexturePackerFormat(format: AtlasFormat): string {
    // For MVP, only phaser is supported
    // This mapping exists for future extensibility
    const formatMap: Record<AtlasFormat, string> = {
        phaser: 'phaser',
    };
    return formatMap[format];
}

/**
 * Log the resolved export configuration
 *
 * @param resolved - Resolved configuration
 * @param runId - Run identifier
 */
export function logExportConfig(
    resolved: ResolvedExportConfig,
    runId: string
): void {
    logger.info({
        event: 'export_config_resolved',
        run_id: runId,
        atlas_format: resolved.atlasFormat,
        staging_path: resolved.stagingPath,
        export_path: resolved.exportPath,
        output_path: resolved.outputPath,
        custom_flags_applied_count: resolved.customFlagsApplied.length,
        custom_flags_rejected_count: resolved.customFlagsRejected.length,
    });

    if (resolved.customFlagsApplied.length > 0) {
        logger.debug({
            event: 'custom_flags_applied',
            flags: resolved.customFlagsApplied,
        });
    }
}
