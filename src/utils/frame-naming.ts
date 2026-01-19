/**
 * Frame naming utilities for Phaser-compatible output
 * Implements 4-digit zero padding as per Deep Think Lock
 */

import { z } from 'zod';

/**
 * Frame naming validation result
 */
export interface NamingValidationResult {
    valid: boolean;
    errors: string[];
    invalidNames: string[];
    gaps: number[];
}

/**
 * Frame mapping entry for traceability
 */
export interface FrameMappingEntry {
    original: string;
    renamed: string;
    frameIndex: number;
}

/**
 * Complete frame mapping log
 */
export interface FrameMappingLog {
    runId: string;
    moveId: string;
    frameCount: number;
    mappings: FrameMappingEntry[];
    generatedAt: string;
}

/**
 * Generate a Phaser-compatible frame name with 4-digit zero padding
 * Format: {moveId}/{paddedIndex} (e.g., "idle/0003")
 *
 * @param moveId - The move/animation identifier (e.g., "idle", "walk", "attack")
 * @param frameIndex - Zero-based frame index (0-9999)
 * @returns Formatted frame name
 */
export function generateFrameName(moveId: string, frameIndex: number): string {
    if (frameIndex < 0 || frameIndex > 9999) {
        throw new Error(`Frame index must be between 0 and 9999, got: ${frameIndex}`);
    }
    const paddedIndex = frameIndex.toString().padStart(4, '0');
    return `${moveId}/${paddedIndex}`;
}

/**
 * Parse a frame name back into its components
 *
 * @param frameName - Full frame name (e.g., "idle/0003")
 * @returns Parsed components or null if invalid
 */
export function parseFrameName(frameName: string): { moveId: string; frameIndex: number } | null {
    const match = frameName.match(/^([a-z_]+)\/(\d{4})$/);
    if (!match) {
        return null;
    }
    return {
        moveId: match[1],
        frameIndex: parseInt(match[2], 10),
    };
}

/**
 * Validate frame naming format
 * Regex pattern: ^[a-z_]+/\d{4}$
 *
 * @param frameNames - Array of frame names to validate
 * @returns Validation result with errors and invalid names
 */
export function validateFrameNaming(frameNames: string[]): NamingValidationResult {
    const pattern = /^[a-z_]+\/\d{4}$/;
    const errors: string[] = [];
    const invalidNames: string[] = [];
    const gaps: number[] = [];

    // Check format
    for (const name of frameNames) {
        if (!pattern.test(name)) {
            invalidNames.push(name);
            errors.push(`Invalid frame name format: "${name}" (expected pattern: {move_id}/XXXX)`);
        }
    }

    // If all names are valid, check for contiguous sequence
    if (invalidNames.length === 0 && frameNames.length > 0) {
        const parsed = frameNames
            .map(parseFrameName)
            .filter((p): p is { moveId: string; frameIndex: number } => p !== null);

        // Group by moveId
        const byMoveId = new Map<string, number[]>();
        for (const { moveId, frameIndex } of parsed) {
            const existing = byMoveId.get(moveId) || [];
            existing.push(frameIndex);
            byMoveId.set(moveId, existing);
        }

        // Check each group for gaps
        for (const [moveId, indices] of byMoveId) {
            const sorted = [...indices].sort((a, b) => a - b);
            for (let i = 0; i < sorted.length - 1; i++) {
                const expected = sorted[i] + 1;
                const actual = sorted[i + 1];
                if (actual !== expected) {
                    // Record all missing indices
                    for (let missing = expected; missing < actual; missing++) {
                        gaps.push(missing);
                        errors.push(`Gap in sequence for "${moveId}": missing frame index ${missing}`);
                    }
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        invalidNames,
        gaps,
    };
}

/**
 * Generate expected frame names for a move
 *
 * @param moveId - The move/animation identifier
 * @param frameCount - Total number of frames
 * @returns Array of expected frame names in order
 */
export function generateExpectedFrameNames(moveId: string, frameCount: number): string[] {
    const names: string[] = [];
    for (let i = 0; i < frameCount; i++) {
        names.push(generateFrameName(moveId, i));
    }
    return names;
}

/**
 * Create a frame mapping entry
 *
 * @param originalPath - Original file path
 * @param moveId - Target move ID
 * @param frameIndex - Frame index
 * @returns Frame mapping entry
 */
export function createFrameMapping(
    originalPath: string,
    moveId: string,
    frameIndex: number
): FrameMappingEntry {
    return {
        original: originalPath,
        renamed: generateFrameName(moveId, frameIndex),
        frameIndex,
    };
}

/**
 * Create a complete frame mapping log
 *
 * @param runId - Run identifier
 * @param moveId - Move identifier
 * @param mappings - Array of frame mappings
 * @returns Complete mapping log
 */
export function createFrameMappingLog(
    runId: string,
    moveId: string,
    mappings: FrameMappingEntry[]
): FrameMappingLog {
    return {
        runId,
        moveId,
        frameCount: mappings.length,
        mappings,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Zod schema for frame mapping entry (snake_case for external artifacts)
 */
export const frameMappingEntrySchema = z.object({
    original: z.string(),
    renamed: z.string(),
    frame_index: z.number().int().min(0).max(9999),
});

/**
 * Zod schema for frame mapping log (snake_case for external artifacts)
 */
export const frameMappingLogSchema = z.object({
    run_id: z.string(),
    move_id: z.string(),
    frame_count: z.number().int().positive(),
    mappings: z.array(frameMappingEntrySchema),
    generated_at: z.string().datetime(),
});

/**
 * Convert internal camelCase mapping to external snake_case format
 */
export function toExternalMappingFormat(log: FrameMappingLog): z.infer<typeof frameMappingLogSchema> {
    return {
        run_id: log.runId,
        move_id: log.moveId,
        frame_count: log.frameCount,
        mappings: log.mappings.map(m => ({
            original: m.original,
            renamed: m.renamed,
            frame_index: m.frameIndex,
        })),
        generated_at: log.generatedAt,
    };
}
