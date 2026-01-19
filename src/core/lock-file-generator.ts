/**
 * Lock file generator - creates deterministic run configuration snapshot
 * Per Story 2.2: Captures resolved paths, versions, and environment info
 */

import { resolve, normalize } from 'path';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { writeJsonAtomic, redactSecrets, pathExists } from '../utils/fs-helpers.js';
import { type Manifest } from '../domain/schemas/manifest.js';
import { type RunPaths } from './run-folder-manager.js';
import { Result } from './config-resolver.js';

/**
 * Environment information captured at run start
 */
export interface Environment {
    node_version: string;
    os: string;
    adapter_version: string;
    model_id: string;
}

/**
 * Lock file structure
 */
export interface LockFile {
    run_id: string;
    run_start: string;
    manifest_path: string;
    manifest_hash: string;
    environment: Environment;
    resolved_config: Record<string, unknown>;
}

/**
 * Error for lock file operations
 */
export interface LockFileError {
    code: string;
    message: string;
    cause?: unknown;
}

// Adapter version (from package.json or constant)
const ADAPTER_VERSION = '0.1.0';

/**
 * Calculate SHA256 hash of file content
 */
export async function calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');
    return `sha256:${hash.substring(0, 16)}`; // Truncate for readability
}

/**
 * Resolve all paths in manifest to absolute paths
 */
export function resolvePaths(
    manifest: Manifest,
    manifestDir: string
): Record<string, unknown> {
    const resolved: Record<string, unknown> = JSON.parse(JSON.stringify(manifest));

    // Resolve inputs.anchor
    if (resolved.inputs && typeof resolved.inputs === 'object') {
        const inputs = resolved.inputs as Record<string, unknown>;
        if (inputs.anchor && typeof inputs.anchor === 'string') {
            inputs.anchor = normalize(resolve(manifestDir, inputs.anchor)).replace(/\\/g, '/');
        }

        // Resolve array paths
        for (const arrayKey of ['style_refs', 'pose_refs', 'guides']) {
            if (Array.isArray(inputs[arrayKey])) {
                inputs[arrayKey] = (inputs[arrayKey] as string[]).map(
                    p => normalize(resolve(manifestDir, p)).replace(/\\/g, '/')
                );
            }
        }
    }

    return resolved;
}

/**
 * Capture environment information
 */
export function captureEnvironment(manifest: Manifest): Environment {
    return {
        node_version: process.version,
        os: process.platform,
        adapter_version: ADAPTER_VERSION,
        model_id: manifest.generator.model,
    };
}

/**
 * Generate lock file from manifest
 */
export async function generateLockFile(
    manifest: Manifest,
    manifestPath: string,
    runId: string,
    runPaths: RunPaths
): Promise<Result<LockFile, LockFileError>> {
    try {
        // Verify manifest file exists
        if (!(await pathExists(manifestPath))) {
            return Result.err({
                code: 'LOCK_MANIFEST_NOT_FOUND',
                message: `Manifest file not found: ${manifestPath}`,
            });
        }

        // Get manifest directory for path resolution
        const manifestDir = resolve(manifestPath, '..');

        // Calculate manifest hash
        const manifestHash = await calculateFileHash(manifestPath);

        // Resolve paths
        const resolvedConfig = resolvePaths(manifest, manifestDir);

        // Redact secrets
        const redactedConfig = redactSecrets(resolvedConfig);

        // Capture environment
        const environment = captureEnvironment(manifest);

        // Build lock file
        const lockFile: LockFile = {
            run_id: runId,
            run_start: new Date().toISOString(),
            manifest_path: normalize(resolve(manifestPath)).replace(/\\/g, '/'),
            manifest_hash: manifestHash,
            environment,
            resolved_config: redactedConfig,
        };

        // Write atomically
        await writeJsonAtomic(runPaths.lockJson, lockFile);

        return Result.ok(lockFile);
    } catch (error) {
        return Result.err({
            code: 'LOCK_GENERATION_FAILED',
            message: 'Failed to generate lock file',
            cause: error,
        });
    }
}

/**
 * Load existing lock file
 */
export async function loadLockFile(lockPath: string): Promise<Result<LockFile, LockFileError>> {
    try {
        const content = await fs.readFile(lockPath, 'utf-8');
        const lockFile = JSON.parse(content) as LockFile;
        return Result.ok(lockFile);
    } catch (error) {
        return Result.err({
            code: 'LOCK_LOAD_FAILED',
            message: `Failed to load lock file: ${lockPath}`,
            cause: error,
        });
    }
}

/**
 * Check if manifest has changed since lock file was created
 */
export async function hasManifestChanged(
    manifestPath: string,
    lockFile: LockFile
): Promise<boolean> {
    try {
        const currentHash = await calculateFileHash(manifestPath);
        return currentHash !== lockFile.manifest_hash;
    } catch {
        return true; // Assume changed if we can't verify
    }
}
