/**
 * Tests for artifact folder organization
 * Per Story 6.4: Folder structure, naming conventions, cleanup
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
    buildRunPaths,
    createRunFolder,
    generateRunId,
    getCandidatePath,
    getApprovedPath,
    generateRejectedFrameName,
    getRejectedPath,
    getRejectedMetadataPath,
    saveRejectedFrame,
    writeRunReadme,
    cleanupOldRuns,
    type RunPaths,
} from '../../src/core/run-folder-manager.js';
import {
    RUN_FOLDERS,
    RUN_FILES,
    ALL_RUN_FOLDERS,
    RUN_FOLDER_DESCRIPTIONS,
} from '../../src/domain/constants/run-folders.js';

describe('Run Folder Constants', () => {
    it('should define all required folders', () => {
        expect(RUN_FOLDERS.APPROVED).toBe('approved');
        expect(RUN_FOLDERS.REJECTED).toBe('rejected');
        expect(RUN_FOLDERS.CANDIDATES).toBe('candidates');
        expect(RUN_FOLDERS.AUDIT).toBe('audit');
        expect(RUN_FOLDERS.LOGS).toBe('logs');
        expect(RUN_FOLDERS.EXPORT).toBe('export');
        expect(RUN_FOLDERS.VALIDATION).toBe('validation');
    });

    it('should define all required files', () => {
        expect(RUN_FILES.STATE).toBe('state.json');
        expect(RUN_FILES.SUMMARY).toBe('summary.json');
        expect(RUN_FILES.DIAGNOSTIC).toBe('diagnostic.json');
        expect(RUN_FILES.MANIFEST_LOCK).toBe('manifest.lock.json');
        expect(RUN_FILES.README).toBe('README.md');
    });

    it('should have all folders in array', () => {
        expect(ALL_RUN_FOLDERS).toContain('approved');
        expect(ALL_RUN_FOLDERS).toContain('rejected');
        expect(ALL_RUN_FOLDERS).toContain('candidates');
        expect(ALL_RUN_FOLDERS).toContain('audit');
        expect(ALL_RUN_FOLDERS).toContain('logs');
        expect(ALL_RUN_FOLDERS).toContain('export');
        expect(ALL_RUN_FOLDERS).toContain('validation');
        expect(ALL_RUN_FOLDERS.length).toBe(7);
    });

    it('should have descriptions for all folders', () => {
        for (const folder of ALL_RUN_FOLDERS) {
            expect(RUN_FOLDER_DESCRIPTIONS[folder]).toBeDefined();
            expect(RUN_FOLDER_DESCRIPTIONS[folder].length).toBeGreaterThan(0);
        }
    });
});

describe('Run Paths', () => {
    it('should build all paths from run directory', () => {
        const runDir = path.join('test', 'runs', 'run_001');
        const paths = buildRunPaths(runDir);

        expect(paths.root).toBe(runDir);
        expect(paths.candidates).toBe(path.join(runDir, 'candidates'));
        expect(paths.approved).toBe(path.join(runDir, 'approved'));
        expect(paths.rejected).toBe(path.join(runDir, 'rejected'));
        expect(paths.audit).toBe(path.join(runDir, 'audit'));
        expect(paths.logs).toBe(path.join(runDir, 'logs'));
        expect(paths.export).toBe(path.join(runDir, 'export'));
        expect(paths.validation).toBe(path.join(runDir, 'validation'));
    });

    it('should build file paths correctly', () => {
        const runDir = path.join('test', 'run');
        const paths = buildRunPaths(runDir);

        expect(paths.stateJson).toBe(path.join(runDir, 'state.json'));
        expect(paths.lockJson).toBe(path.join(runDir, 'manifest.lock.json'));
        expect(paths.summaryJson).toBe(path.join(runDir, 'summary.json'));
        expect(paths.diagnosticJson).toBe(path.join(runDir, 'diagnostic.json'));
        expect(paths.readmeMd).toBe(path.join(runDir, 'README.md'));
    });
});

describe('Folder Creation', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `folder-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should create all subdirectories', async () => {
        const runId = generateRunId();
        const result = await createRunFolder(testDir, runId);

        expect(result.ok).toBe(true);

        if (result.ok) {
            const paths = result.value;

            // Check all folders exist
            for (const folder of ALL_RUN_FOLDERS) {
                const folderPath = path.join(paths.root, folder);
                const exists = await fs.access(folderPath).then(() => true).catch(() => false);
                expect(exists).toBe(true);
            }
        }
    });

    it('should return correct paths', async () => {
        const runId = 'test_run_001';
        const result = await createRunFolder(testDir, runId);

        expect(result.ok).toBe(true);

        if (result.ok) {
            const paths = result.value;
            expect(paths.root).toBe(path.join(testDir, runId));
            expect(paths.approved).toBe(path.join(testDir, runId, 'approved'));
            expect(paths.rejected).toBe(path.join(testDir, runId, 'rejected'));
        }
    });
});

describe('Frame Naming', () => {
    it('should generate candidate path with 4-digit frame and 2-digit attempt', () => {
        const runDir = path.join('test', 'run');
        const paths = buildRunPaths(runDir);
        const candidatePath = getCandidatePath(paths, 3, 5);

        expect(candidatePath).toBe(path.join(runDir, 'candidates', 'frame_0003_attempt_05.png'));
    });

    it('should generate candidate path with suffix', () => {
        const runDir = path.join('test', 'run');
        const paths = buildRunPaths(runDir);
        const candidatePath = getCandidatePath(paths, 0, 1, '_norm');

        expect(candidatePath).toBe(path.join(runDir, 'candidates', 'frame_0000_attempt_01_norm.png'));
    });

    it('should generate approved path with 4-digit frame', () => {
        const runDir = path.join('test', 'run');
        const paths = buildRunPaths(runDir);
        const approvedPath = getApprovedPath(paths, 7);

        expect(approvedPath).toBe(path.join(runDir, 'approved', 'frame_0007.png'));
    });

    it('should handle large frame indices', () => {
        const runDir = path.join('test', 'run');
        const paths = buildRunPaths(runDir);

        expect(getCandidatePath(paths, 9999, 99)).toBe(path.join(runDir, 'candidates', 'frame_9999_attempt_99.png'));
        expect(getApprovedPath(paths, 1234)).toBe(path.join(runDir, 'approved', 'frame_1234.png'));
    });
});

describe('Rejected Frame Naming', () => {
    it('should generate rejected filename with reason code', () => {
        const filename = generateRejectedFrameName(4, 'HF_IDENTITY_COLLAPSE');
        expect(filename).toBe('frame_0004_HF_IDENTITY_COLLAPSE.png');
    });

    it('should sanitize invalid characters in reason code', () => {
        const filename = generateRejectedFrameName(0, 'HF01-DIMENSION.MISMATCH');
        expect(filename).toBe('frame_0000_HF01_DIMENSION_MISMATCH.png');
    });

    it('should get rejected frame path', () => {
        const runDir = path.join('test', 'run');
        const paths = buildRunPaths(runDir);
        const rejectedPath = getRejectedPath(paths, 6, 'HF02_FORMAT_INVALID');

        expect(rejectedPath).toBe(path.join(runDir, 'rejected', 'frame_0006_HF02_FORMAT_INVALID.png'));
    });

    it('should get rejected metadata path', () => {
        const runDir = path.join('test', 'run');
        const paths = buildRunPaths(runDir);
        const metadataPath = getRejectedMetadataPath(paths, 4, 'HF_IDENTITY_COLLAPSE');

        expect(metadataPath).toBe(path.join(runDir, 'rejected', 'frame_0004_HF_IDENTITY_COLLAPSE_metadata.json'));
    });
});

describe('Save Rejected Frame', () => {
    let testDir: string;
    let paths: RunPaths;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `rejected-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        paths = buildRunPaths(testDir);

        // Create required directories
        await fs.mkdir(paths.rejected, { recursive: true });
        await fs.mkdir(paths.candidates, { recursive: true });

        // Create a dummy candidate file
        const candidatePath = getCandidatePath(paths, 0, 3);
        await fs.writeFile(candidatePath, 'test image data');
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should save rejected frame with metadata', async () => {
        const candidatePath = getCandidatePath(paths, 0, 3);

        const result = await saveRejectedFrame(
            paths,
            0,
            'HF_IDENTITY_COLLAPSE',
            candidatePath,
            {
                reason_message: 'Frame failed identity check after 2 consecutive re-anchors',
                attempts: 5,
                last_composite_score: 0.58,
                suggestion: 'Anchor may lack resolution for this pose angle',
            }
        );

        // Check files exist
        const frameExists = await fs.access(result.framePath).then(() => true).catch(() => false);
        const metaExists = await fs.access(result.metadataPath).then(() => true).catch(() => false);

        expect(frameExists).toBe(true);
        expect(metaExists).toBe(true);

        // Check metadata content
        const metadata = JSON.parse(await fs.readFile(result.metadataPath, 'utf-8'));
        expect(metadata.frame_index).toBe(0);
        expect(metadata.reason_code).toBe('HF_IDENTITY_COLLAPSE');
        expect(metadata.attempts).toBe(5);
        expect(metadata.last_composite_score).toBe(0.58);
    });
});

describe('Run README', () => {
    let testDir: string;
    let paths: RunPaths;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `readme-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        paths = buildRunPaths(testDir);
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should write README to run folder', async () => {
        await writeRunReadme(paths);

        const exists = await fs.access(paths.readmeMd).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        const content = await fs.readFile(paths.readmeMd, 'utf-8');
        expect(content).toContain('# Run Artifacts');
        expect(content).toContain('approved/');
        expect(content).toContain('rejected/');
        expect(content).toContain('candidates/');
    });

    it('should document folder structure', async () => {
        await writeRunReadme(paths);

        const content = await fs.readFile(paths.readmeMd, 'utf-8');
        expect(content).toContain('| Folder | Contents |');
        expect(content).toContain('`approved/`');
        expect(content).toContain('`rejected/`');
        expect(content).toContain('`audit/`');
    });

    it('should document file naming conventions', async () => {
        await writeRunReadme(paths);

        const content = await fs.readFile(paths.readmeMd, 'utf-8');
        expect(content).toContain('frame_XXXX.png');
        expect(content).toContain('frame_XXXX_REASON_CODE.png');
        expect(content).toContain('frame_XXXX_attempt_YY.png');
    });
});

describe('Cleanup Old Runs', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `cleanup-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should scan runs directory', async () => {
        // Create some run directories
        await fs.mkdir(path.join(testDir, 'run_001'), { recursive: true });
        await fs.mkdir(path.join(testDir, 'run_002'), { recursive: true });

        const result = await cleanupOldRuns(testDir, {
            maxAgeDays: 0.001, // Very small to catch all
            dryRun: true,
        });

        expect(result.runsScanned).toBe(2);
    });

    it('should respect dry run mode', async () => {
        const runDir = path.join(testDir, 'run_001');
        await fs.mkdir(runDir, { recursive: true });

        // Backdate the directory
        const oldTime = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
        await fs.utimes(runDir, oldTime, oldTime);

        const result = await cleanupOldRuns(testDir, {
            maxAgeDays: 30,
            dryRun: true,
        });

        expect(result.runsDeleted).toBe(1);

        // Directory should still exist
        const exists = await fs.access(runDir).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });

    it('should delete old runs when not dry run', async () => {
        const runDir = path.join(testDir, 'run_old');
        await fs.mkdir(runDir, { recursive: true });
        await fs.writeFile(path.join(runDir, 'test.txt'), 'test');

        // Backdate the directory
        const oldTime = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
        await fs.utimes(runDir, oldTime, oldTime);

        const result = await cleanupOldRuns(testDir, {
            maxAgeDays: 30,
            dryRun: false,
        });

        expect(result.runsDeleted).toBe(1);

        // Directory should be gone
        const exists = await fs.access(runDir).then(() => true).catch(() => false);
        expect(exists).toBe(false);
    });

    it('should preserve runs with approved frames when option set', async () => {
        const runDir = path.join(testDir, 'run_with_approved');
        const approvedDir = path.join(runDir, 'approved');
        await fs.mkdir(approvedDir, { recursive: true });
        await fs.writeFile(path.join(approvedDir, 'frame_0000.png'), 'test');

        // Backdate
        const oldTime = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
        await fs.utimes(runDir, oldTime, oldTime);

        const result = await cleanupOldRuns(testDir, {
            maxAgeDays: 30,
            preserveApproved: true,
            dryRun: false,
        });

        expect(result.runsPreserved).toBe(1);

        // Directory should still exist
        const exists = await fs.access(runDir).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });

    it('should calculate space freed', async () => {
        const runDir = path.join(testDir, 'run_001');
        await fs.mkdir(runDir, { recursive: true });
        await fs.writeFile(path.join(runDir, 'test.txt'), 'x'.repeat(1000));

        const oldTime = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
        await fs.utimes(runDir, oldTime, oldTime);

        const result = await cleanupOldRuns(testDir, {
            maxAgeDays: 30,
            dryRun: true,
        });

        expect(result.spaceFreedBytes).toBeGreaterThan(0);
    });

    it('should preserve recent runs', async () => {
        const runDir = path.join(testDir, 'run_recent');
        await fs.mkdir(runDir, { recursive: true });

        const result = await cleanupOldRuns(testDir, {
            maxAgeDays: 30,
            dryRun: true,
        });

        expect(result.runsPreserved).toBe(1);
        expect(result.runsDeleted).toBe(0);
    });
});
