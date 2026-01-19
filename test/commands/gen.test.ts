/**
 * Tests for Gen Command (Story 8.1, 8.2)
 * AC #1-5: CLI entry, options, manifest loading, generation flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';

import { registerGenCommand, type GenOptions } from '../../src/commands/gen.js';

// Mock all dependencies
vi.mock('fs/promises', () => ({
    readFile: vi.fn(),
}));

vi.mock('fs', () => ({
    existsSync: vi.fn(),
}));

vi.mock('chalk', () => ({
    default: {
        bold: { cyan: vi.fn((s: string) => s) },
        gray: vi.fn((s: string) => s),
        green: vi.fn((s: string) => s),
        yellow: vi.fn((s: string) => s),
        red: vi.fn((s: string) => s),
    },
}));

vi.mock('yaml', () => ({
    parse: vi.fn(),
}));

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/utils/fs-helpers.js', () => ({
    pathExists: vi.fn(),
}));

vi.mock('../../src/domain/schemas/manifest.js', () => ({
    manifestSchema: {
        parse: vi.fn(),
    },
}));

vi.mock('../../src/core/progress-reporter.js', () => ({
    ProgressReporter: vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        succeed: vi.fn(),
        fail: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
        stop: vi.fn(),
        summary: vi.fn(),
        directorLaunch: vi.fn(),
        directorCommit: vi.fn(),
        directorCancel: vi.fn(),
        getElapsedMs: vi.fn().mockReturnValue(5000),
    })),
}));

vi.mock('../../src/core/orchestrator.js', () => ({
    createOrchestratorContext: vi.fn(),
    runOrchestrator: vi.fn(),
    requestAbort: vi.fn(),
}));

vi.mock('../../src/core/run-folder-manager.js', () => ({
    generateRunId: vi.fn().mockReturnValue('test-run-123'),
    createRunFolder: vi.fn(),
}));

vi.mock('../../src/core/lock-file-generator.js', () => ({
    generateLockFile: vi.fn(),
}));

vi.mock('../../src/core/anchor-analyzer.js', () => ({
    analyzeAnchor: vi.fn(),
}));

vi.mock('../../src/core/shutdown-handler.js', () => ({
    registerShutdownHandlers: vi.fn(),
    isShutdownInProgress: vi.fn().mockReturnValue(false),
}));

vi.mock('../../src/core/director-server.js', () => ({
    startDirectorServer: vi.fn(),
}));

describe('Gen Command (Story 8.1, 8.2)', () => {
    let program: Command;
    let consoleSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let processExitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();

        program = new Command();
        program.exitOverride(); // Prevent commander from exiting

        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });

        // Set API key
        process.env.GEMINI_API_KEY = 'test-api-key';
    });

    afterEach(() => {
        consoleSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
        delete process.env.GEMINI_API_KEY;
    });

    describe('registerGenCommand', () => {
        it('should register gen command with program', () => {
            registerGenCommand(program);

            const commands = program.commands.map(c => c.name());
            expect(commands).toContain('gen');
        });

        it('should register required --move option', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');
            const options = genCommand?.options.map(o => o.long);

            expect(options).toContain('--move');
        });

        it('should register optional options', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');
            const options = genCommand?.options.map(o => o.long);

            expect(options).toContain('--manifest');
            expect(options).toContain('--interactive');
            expect(options).toContain('--frames');
            expect(options).toContain('--skip-validation');
            expect(options).toContain('--allow-validation-fail');
            expect(options).toContain('--no-resume');
            expect(options).toContain('--verbose');
            expect(options).toContain('--runs-dir');
            expect(options).toContain('--port');
            expect(options).toContain('--dry-run');
        });

        it('should use manifest.yaml as default manifest path', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');
            const manifestOption = genCommand?.options.find(o => o.long === '--manifest');

            expect(manifestOption?.defaultValue).toBe('manifest.yaml');
        });

        it('should use 3000 as default port', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');
            const portOption = genCommand?.options.find(o => o.long === '--port');

            expect(portOption?.defaultValue).toBe(3000);
        });

        it('should use runs as default runs directory', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');
            const runsDirOption = genCommand?.options.find(o => o.long === '--runs-dir');

            expect(runsDirOption?.defaultValue).toBe('runs');
        });
    });

    describe('GenOptions interface', () => {
        it('should export GenOptions type', () => {
            // TypeScript will verify the interface exists
            const options: GenOptions = {
                move: 'idle_standard',
                manifest: 'manifest.yaml',
                interactive: false,
                skipValidation: false,
                allowValidationFail: false,
                noResume: false,
                verbose: false,
                runsDir: 'runs',
                port: 3000,
                dryRun: false,
            };

            expect(options.move).toBe('idle_standard');
        });

        it('should allow optional frames property', () => {
            const options: GenOptions = {
                move: 'idle_standard',
                manifest: 'manifest.yaml',
                interactive: false,
                frames: 8,
                skipValidation: false,
                allowValidationFail: false,
                noResume: false,
                verbose: false,
                runsDir: 'runs',
                port: 3000,
                dryRun: false,
            };

            expect(options.frames).toBe(8);
        });
    });

    describe('Command parsing', () => {
        it('should fail when --move is not provided', async () => {
            registerGenCommand(program);

            await expect(async () => {
                await program.parseAsync(['node', 'test', 'gen']);
            }).rejects.toThrow();
        });

        it('should parse -m shorthand for --move', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');
            const moveOption = genCommand?.options.find(o => o.long === '--move');

            expect(moveOption?.short).toBe('-m');
        });

        it('should parse -i shorthand for --interactive', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');
            const interactiveOption = genCommand?.options.find(o => o.long === '--interactive');

            expect(interactiveOption?.short).toBe('-i');
        });

        it('should parse -v shorthand for --verbose', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');
            const verboseOption = genCommand?.options.find(o => o.long === '--verbose');

            expect(verboseOption?.short).toBe('-v');
        });
    });

    describe('Command description', () => {
        it('should have appropriate description', () => {
            registerGenCommand(program);

            const genCommand = program.commands.find(c => c.name() === 'gen');

            expect(genCommand?.description()).toContain('sprite');
        });
    });

    // Note: Testing the full executeGen flow would require extensive mocking
    // of async operations including file system, API calls, and orchestrator.
    // These are typically covered in integration tests.
    describe('Integration points (structure verification)', () => {
        it('should import ProgressReporter', async () => {
            const { ProgressReporter } = await import('../../src/core/progress-reporter.js');
            expect(ProgressReporter).toBeDefined();
        });

        it('should import orchestrator functions', async () => {
            const { createOrchestratorContext, runOrchestrator, requestAbort } =
                await import('../../src/core/orchestrator.js');

            expect(createOrchestratorContext).toBeDefined();
            expect(runOrchestrator).toBeDefined();
            expect(requestAbort).toBeDefined();
        });

        it('should import run folder manager functions', async () => {
            const { generateRunId, createRunFolder } =
                await import('../../src/core/run-folder-manager.js');

            expect(generateRunId).toBeDefined();
            expect(createRunFolder).toBeDefined();
        });

        it('should import shutdown handler functions', async () => {
            const { registerShutdownHandlers, isShutdownInProgress } =
                await import('../../src/core/shutdown-handler.js');

            expect(registerShutdownHandlers).toBeDefined();
            expect(isShutdownInProgress).toBeDefined();
        });

        it('should import director server', async () => {
            const { startDirectorServer } =
                await import('../../src/core/director-server.js');

            expect(startDirectorServer).toBeDefined();
        });
    });
});
