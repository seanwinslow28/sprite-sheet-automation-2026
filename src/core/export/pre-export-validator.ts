/**
 * Pre-Export Validator
 * Story 5.5: Implement Pre-Export Validation Checklist
 *
 * Validates approved frames before packing to catch issues early.
 * Implements 12-item validation checklist.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { Result, SystemError } from '../result.js';
import { logger } from '../../utils/logger.js';
import { writeJsonAtomic, pathExists } from '../../utils/fs-helpers.js';
import type { Manifest } from '../../domain/schemas/manifest.js';

/**
 * Frame information collected during validation
 */
export interface FrameInfo {
    index: number;
    path: string;
    filename: string;
    metadata?: sharp.Metadata;
    hash?: string;
    fileSize?: number;
    opaqueBounds?: {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
}

/**
 * Result of a single check
 */
export interface CheckResult {
    passed: boolean;
    message?: string;
    details?: Record<string, unknown>;
    affectedFrames?: number[];
}

/**
 * A single pre-export check
 */
export interface PreExportCheck {
    id: string;
    name: string;
    severity: 'critical' | 'warning';
    check: (frames: FrameInfo[], manifest: Manifest) => Promise<CheckResult>;
}

/**
 * Full validation report
 */
export interface ValidationReport {
    runId: string;
    validatedAt: string;
    approvedPath: string;
    passed: boolean;
    summary: {
        totalChecks: number;
        passed: number;
        failed: number;
        warnings: number;
    };
    checks: Array<{
        id: string;
        name: string;
        severity: 'critical' | 'warning';
        passed: boolean;
        message?: string;
        details?: Record<string, unknown>;
        affectedFrames?: number[];
    }>;
    blocking: boolean;
    blockingReason?: string;
}

/** Common system files to ignore */
const IGNORED_FILES = new Set([
    'thumbs.db',
    '.ds_store',
    'desktop.ini',
    '.gitkeep',
    '.gitignore',
]);

/**
 * Calculate SHA256 hash of a file
 */
async function calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Extract frame index from filename
 * Expected format: frame_XXXX.png
 */
function extractFrameIndex(filename: string): number | null {
    const match = filename.match(/frame_(\d{4})\.png$/i);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Calculate opaque bounding box of an image
 */
async function calculateOpaqueBounds(
    imagePath: string
): Promise<{ left: number; top: number; right: number; bottom: number; width: number; height: number } | null> {
    try {
        const image = sharp(imagePath);
        const { data, info } = await image
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        let minX = info.width;
        let minY = info.height;
        let maxX = 0;
        let maxY = 0;
        let hasOpaque = false;

        for (let y = 0; y < info.height; y++) {
            for (let x = 0; x < info.width; x++) {
                const idx = (y * info.width + x) * 4;
                const alpha = data[idx + 3];
                if (alpha > 0) {
                    hasOpaque = true;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (!hasOpaque) {
            return null;
        }

        return {
            left: minX,
            top: minY,
            right: maxX,
            bottom: maxY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
        };
    } catch {
        return null;
    }
}

// ============================================
// Individual Check Implementations
// ============================================

/**
 * Check 1: Frame count matches manifest
 */
async function checkFrameCount(frames: FrameInfo[], manifest: Manifest): Promise<CheckResult> {
    const expected = manifest.identity.frame_count;
    const actual = frames.length;

    if (actual === expected) {
        return { passed: true, message: `All ${expected} frames present` };
    }

    return {
        passed: false,
        message: `Expected ${expected} frames, found ${actual}`,
        details: { expected, actual },
    };
}

/**
 * Check 2: Dimensions match target canvas size
 */
async function checkDimensions(frames: FrameInfo[], manifest: Manifest): Promise<CheckResult> {
    const targetSize = manifest.canvas.target_size;
    const mismatched: number[] = [];
    const details: Record<string, unknown> = { expected: { w: targetSize, h: targetSize } };

    for (const frame of frames) {
        if (frame.metadata) {
            const { width, height } = frame.metadata;
            if (width !== targetSize || height !== targetSize) {
                mismatched.push(frame.index);
                details[`frame_${frame.index}`] = { w: width, h: height };
            }
        }
    }

    if (mismatched.length === 0) {
        return { passed: true, message: `All frames are ${targetSize}x${targetSize}` };
    }

    return {
        passed: false,
        message: `Dimension mismatch on ${mismatched.length} frame(s)`,
        affectedFrames: mismatched,
        details,
    };
}

/**
 * Check 3: Alpha channel present
 */
async function checkAlphaChannel(frames: FrameInfo[], _manifest: Manifest): Promise<CheckResult> {
    const missing: number[] = [];

    for (const frame of frames) {
        if (frame.metadata && frame.metadata.channels !== 4) {
            missing.push(frame.index);
        }
    }

    if (missing.length === 0) {
        return { passed: true, message: 'All frames have alpha channel' };
    }

    return {
        passed: false,
        message: `${missing.length} frame(s) missing alpha channel`,
        affectedFrames: missing,
    };
}

/**
 * Check 4: No corrupted images
 */
async function checkCorruption(frames: FrameInfo[], _manifest: Manifest): Promise<CheckResult> {
    const corrupted: number[] = [];

    for (const frame of frames) {
        if (!frame.metadata) {
            corrupted.push(frame.index);
        }
    }

    if (corrupted.length === 0) {
        return { passed: true, message: 'All frames readable' };
    }

    return {
        passed: false,
        message: `${corrupted.length} frame(s) corrupted or unreadable`,
        affectedFrames: corrupted,
    };
}

/**
 * Check 5: Naming convention valid
 */
async function checkNamingConvention(frames: FrameInfo[], _manifest: Manifest): Promise<CheckResult> {
    const invalid: number[] = [];
    const details: Record<string, string> = {};

    for (const frame of frames) {
        const expectedName = `frame_${frame.index.toString().padStart(4, '0')}.png`;
        if (frame.filename.toLowerCase() !== expectedName.toLowerCase()) {
            invalid.push(frame.index);
            details[`frame_${frame.index}`] = `Found '${frame.filename}', expected '${expectedName}'`;
        }
    }

    if (invalid.length === 0) {
        return { passed: true, message: 'All filenames follow convention' };
    }

    return {
        passed: false,
        message: `${invalid.length} filename(s) don't follow convention`,
        affectedFrames: invalid,
        details,
    };
}

/**
 * Check 6: No duplicate frames
 */
async function checkDuplicates(frames: FrameInfo[], _manifest: Manifest): Promise<CheckResult> {
    const hashToFrames = new Map<string, number[]>();

    for (const frame of frames) {
        if (frame.hash) {
            const existing = hashToFrames.get(frame.hash) || [];
            existing.push(frame.index);
            hashToFrames.set(frame.hash, existing);
        }
    }

    const duplicatePairs: number[][] = [];
    for (const [_hash, indices] of hashToFrames) {
        if (indices.length > 1) {
            duplicatePairs.push(indices);
        }
    }

    if (duplicatePairs.length === 0) {
        return { passed: true, message: 'No duplicate frames detected' };
    }

    const affectedFrames = duplicatePairs.flat();
    return {
        passed: false,
        message: `${duplicatePairs.length} set(s) of duplicate frames detected`,
        affectedFrames,
        details: { duplicatePairs },
    };
}

/**
 * Check 7: File sizes within bounds
 */
async function checkFileSizeBounds(frames: FrameInfo[], _manifest: Manifest): Promise<CheckResult> {
    const MIN_SIZE = 1024; // 1KB
    const MAX_SIZE = 500 * 1024; // 500KB
    const issues: number[] = [];
    const details: Record<string, unknown> = {};

    for (const frame of frames) {
        if (frame.fileSize !== undefined) {
            if (frame.fileSize < MIN_SIZE) {
                issues.push(frame.index);
                details[`frame_${frame.index}`] = `Too small: ${frame.fileSize} bytes`;
            } else if (frame.fileSize > MAX_SIZE) {
                issues.push(frame.index);
                details[`frame_${frame.index}`] = `Too large: ${frame.fileSize} bytes`;
            }
        }
    }

    if (issues.length === 0) {
        return { passed: true, message: 'All file sizes within bounds' };
    }

    return {
        passed: false,
        message: `${issues.length} frame(s) outside size bounds (1KB-500KB)`,
        affectedFrames: issues,
        details,
    };
}

/**
 * Check 8: Color depth is 32-bit RGBA
 */
async function checkColorDepth(frames: FrameInfo[], _manifest: Manifest): Promise<CheckResult> {
    const invalid: number[] = [];

    for (const frame of frames) {
        if (frame.metadata) {
            const { channels, depth } = frame.metadata;
            // Sharp reports depth as string like 'uchar' for 8-bit
            if (channels !== 4 || (depth !== 'uchar' && depth !== 'char')) {
                invalid.push(frame.index);
            }
        }
    }

    if (invalid.length === 0) {
        return { passed: true, message: 'All frames are 32-bit RGBA' };
    }

    return {
        passed: false,
        message: `${invalid.length} frame(s) not 32-bit RGBA`,
        affectedFrames: invalid,
    };
}

/**
 * Check 9: No stray files
 */
async function checkStrayFiles(
    frames: FrameInfo[],
    _manifest: Manifest,
    approvedPath?: string
): Promise<CheckResult> {
    if (!approvedPath) {
        return { passed: true, message: 'Stray file check skipped (no path provided)' };
    }

    try {
        const allFiles = await fs.readdir(approvedPath);
        const expectedFiles = new Set(frames.map(f => f.filename.toLowerCase()));
        const strayFiles: string[] = [];

        for (const file of allFiles) {
            const lower = file.toLowerCase();
            if (!expectedFiles.has(lower) && !IGNORED_FILES.has(lower)) {
                strayFiles.push(file);
            }
        }

        if (strayFiles.length === 0) {
            return { passed: true, message: 'No stray files found' };
        }

        return {
            passed: false,
            message: `${strayFiles.length} stray file(s) found`,
            details: { strayFiles },
        };
    } catch {
        return { passed: true, message: 'Stray file check skipped (read error)' };
    }
}

/**
 * Check 10: Sequence is contiguous
 */
async function checkSequenceContiguity(frames: FrameInfo[], manifest: Manifest): Promise<CheckResult> {
    const expectedCount = manifest.identity.frame_count;
    const indices = frames.map(f => f.index).sort((a, b) => a - b);
    const missing: number[] = [];

    // Check for starting at 0
    if (indices[0] !== 0) {
        missing.push(0);
    }

    // Check for gaps
    for (let i = 0; i < expectedCount; i++) {
        if (!indices.includes(i)) {
            missing.push(i);
        }
    }

    if (missing.length === 0) {
        return { passed: true, message: 'Frame sequence is contiguous (0 to N-1)' };
    }

    return {
        passed: false,
        message: `Missing frame indices: ${missing.join(', ')}`,
        affectedFrames: missing,
    };
}

/**
 * Check 11: Total size reasonable for packing
 */
async function checkTotalSize(frames: FrameInfo[], _manifest: Manifest): Promise<CheckResult> {
    const MAX_TOTAL = 50 * 1024 * 1024; // 50MB
    const totalSize = frames.reduce((sum, f) => sum + (f.fileSize || 0), 0);

    if (totalSize <= MAX_TOTAL) {
        return {
            passed: true,
            message: `Total size ${(totalSize / 1024 / 1024).toFixed(2)}MB is within limits`,
        };
    }

    return {
        passed: false,
        message: `Total size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds 50MB limit`,
        details: { totalBytes: totalSize, limitBytes: MAX_TOTAL },
    };
}

/**
 * Check 12: Bounding box consistency
 */
async function checkBoundingBoxConsistency(frames: FrameInfo[], _manifest: Manifest): Promise<CheckResult> {
    const bounds = frames
        .map(f => f.opaqueBounds)
        .filter((b): b is NonNullable<typeof b> => b !== null && b !== undefined);

    if (bounds.length === 0) {
        return { passed: true, message: 'No opaque bounds to check' };
    }

    if (bounds.length < frames.length) {
        // Some frames have no opaque pixels
        const missing = frames.filter(f => !f.opaqueBounds).map(f => f.index);
        return {
            passed: false,
            message: `${missing.length} frame(s) have no opaque pixels`,
            affectedFrames: missing,
        };
    }

    // Calculate mean bounding box size
    const meanW = bounds.reduce((s, b) => s + b.width, 0) / bounds.length;
    const meanH = bounds.reduce((s, b) => s + b.height, 0) / bounds.length;

    // Check variance (allow ±20%)
    const threshold = 0.20;
    const outliers: number[] = [];

    for (let i = 0; i < bounds.length; i++) {
        const b = bounds[i];
        const wDiff = Math.abs(b.width - meanW) / meanW;
        const hDiff = Math.abs(b.height - meanH) / meanH;
        if (wDiff > threshold || hDiff > threshold) {
            outliers.push(frames[i].index);
        }
    }

    if (outliers.length === 0) {
        return { passed: true, message: 'Bounding box sizes are consistent' };
    }

    return {
        passed: false,
        message: `${outliers.length} frame(s) have inconsistent bounding box size (>±20%)`,
        affectedFrames: outliers,
        details: { meanSize: { w: meanW, h: meanH }, threshold },
    };
}

// ============================================
// Check Registry
// ============================================

const PRE_EXPORT_CHECKS: PreExportCheck[] = [
    { id: 'frame_count', name: 'Frame Count', severity: 'critical', check: checkFrameCount },
    { id: 'dimensions', name: 'Dimensions', severity: 'critical', check: checkDimensions },
    { id: 'alpha_channel', name: 'Alpha Channel', severity: 'critical', check: checkAlphaChannel },
    { id: 'corruption', name: 'Image Corruption', severity: 'critical', check: checkCorruption },
    { id: 'naming', name: 'Naming Convention', severity: 'warning', check: checkNamingConvention },
    { id: 'duplicates', name: 'Duplicate Detection', severity: 'warning', check: checkDuplicates },
    { id: 'file_size', name: 'File Size Bounds', severity: 'warning', check: checkFileSizeBounds },
    { id: 'color_depth', name: 'Color Depth (32-bit)', severity: 'critical', check: checkColorDepth },
    { id: 'stray_files', name: 'Stray Files', severity: 'warning', check: async () => ({ passed: true, message: 'Stray file check (handled separately)' }) },
    { id: 'sequence', name: 'Sequence Contiguity', severity: 'critical', check: checkSequenceContiguity },
    { id: 'total_size', name: 'Total Size', severity: 'warning', check: checkTotalSize },
    { id: 'bounding_box', name: 'Bounding Box Consistency', severity: 'warning', check: checkBoundingBoxConsistency },
];

// ============================================
// Main Validator
// ============================================

/**
 * Collect information about all frames in the approved folder
 */
async function collectFrameInfo(approvedPath: string): Promise<FrameInfo[]> {
    const files = await fs.readdir(approvedPath);
    const pngFiles = files.filter(f => f.toLowerCase().endsWith('.png')).sort();

    const frames: FrameInfo[] = [];

    for (const filename of pngFiles) {
        const filePath = path.join(approvedPath, filename);
        const index = extractFrameIndex(filename) ?? frames.length;

        let metadata: sharp.Metadata | undefined;
        let hash: string | undefined;
        let fileSize: number | undefined;
        let opaqueBounds: FrameInfo['opaqueBounds'] | undefined;

        try {
            metadata = await sharp(filePath).metadata();
        } catch {
            // Corrupted image
        }

        try {
            hash = await calculateFileHash(filePath);
        } catch {
            // Hash calculation failed
        }

        try {
            const stats = await fs.stat(filePath);
            fileSize = stats.size;
        } catch {
            // Stat failed
        }

        try {
            const bounds = await calculateOpaqueBounds(filePath);
            if (bounds) {
                opaqueBounds = bounds;
            }
        } catch {
            // Bounds calculation failed
        }

        frames.push({
            index,
            path: filePath,
            filename,
            metadata,
            hash,
            fileSize,
            opaqueBounds,
        });
    }

    return frames;
}

/**
 * Run all pre-export validation checks
 *
 * @param approvedPath - Path to approved frames folder
 * @param manifest - Run manifest
 * @param runId - Run identifier
 * @returns Validation report
 */
export async function runPreExportValidation(
    approvedPath: string,
    manifest: Manifest,
    runId: string
): Promise<Result<ValidationReport, SystemError>> {
    logger.info({
        event: 'pre_export_validation_start',
        run_id: runId,
        approved_path: approvedPath,
    });

    // Verify path exists
    if (!(await pathExists(approvedPath))) {
        return Result.err({
            code: 'SYS_PATH_NOT_FOUND',
            message: `Approved frames path does not exist: ${approvedPath}`,
            context: { approvedPath },
        });
    }

    // Collect frame info
    const frames = await collectFrameInfo(approvedPath);

    // Run all checks
    const checkResults: ValidationReport['checks'] = [];
    let criticalFailed = false;
    let blockingReason: string | undefined;

    for (const check of PRE_EXPORT_CHECKS) {
        try {
            // Special handling for stray files check which needs the path
            let result: CheckResult;
            if (check.id === 'stray_files') {
                result = await checkStrayFiles(frames, manifest, approvedPath);
            } else {
                result = await check.check(frames, manifest);
            }

            checkResults.push({
                id: check.id,
                name: check.name,
                severity: check.severity,
                passed: result.passed,
                message: result.message,
                details: result.details,
                affectedFrames: result.affectedFrames,
            });

            if (!result.passed && check.severity === 'critical') {
                criticalFailed = true;
                if (!blockingReason) {
                    blockingReason = `Critical check '${check.name}' failed: ${result.message}`;
                }
            }
        } catch (error) {
            checkResults.push({
                id: check.id,
                name: check.name,
                severity: check.severity,
                passed: false,
                message: `Check threw error: ${error}`,
            });

            if (check.severity === 'critical') {
                criticalFailed = true;
                if (!blockingReason) {
                    blockingReason = `Critical check '${check.name}' threw error`;
                }
            }
        }
    }

    // Calculate summary
    const passed = checkResults.filter(c => c.passed).length;
    const failed = checkResults.filter(c => !c.passed && c.severity === 'critical').length;
    const warnings = checkResults.filter(c => !c.passed && c.severity === 'warning').length;

    const report: ValidationReport = {
        runId,
        validatedAt: new Date().toISOString(),
        approvedPath,
        passed: !criticalFailed,
        summary: {
            totalChecks: checkResults.length,
            passed,
            failed,
            warnings,
        },
        checks: checkResults,
        blocking: criticalFailed,
        blockingReason,
    };

    logger.info({
        event: 'pre_export_validation_complete',
        run_id: runId,
        passed: report.passed,
        total_checks: report.summary.totalChecks,
        passed_checks: report.summary.passed,
        failed_checks: report.summary.failed,
        warnings: report.summary.warnings,
    });

    return Result.ok(report);
}

/**
 * Save validation report to disk
 */
export async function saveValidationReport(
    report: ValidationReport,
    runsDir: string
): Promise<Result<string, SystemError>> {
    const reportPath = path.join(runsDir, report.runId, 'pre_export_validation.json');

    try {
        // Convert to snake_case for external storage
        const externalReport = {
            run_id: report.runId,
            validated_at: report.validatedAt,
            approved_path: report.approvedPath,
            passed: report.passed,
            summary: {
                total_checks: report.summary.totalChecks,
                passed: report.summary.passed,
                failed: report.summary.failed,
                warnings: report.summary.warnings,
            },
            checks: report.checks.map(c => ({
                id: c.id,
                name: c.name,
                severity: c.severity,
                passed: c.passed,
                message: c.message,
                details: c.details,
                affected_frames: c.affectedFrames,
            })),
            blocking: report.blocking,
            blocking_reason: report.blockingReason,
        };

        await writeJsonAtomic(reportPath, externalReport);
        return Result.ok(reportPath);
    } catch (error) {
        return Result.err({
            code: 'SYS_WRITE_FAILED',
            message: `Failed to save validation report: ${error}`,
            context: { reportPath },
        });
    }
}
