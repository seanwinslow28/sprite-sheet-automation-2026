/**
 * Tests for Spike command (Puppeteer)
 * Mocks the harness to verify command logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerSpikeCommand } from '../../src/commands/spike.js';
import * as harness from '../../src/adapters/puppeteer-harness.js';
import { Result } from '../../src/core/result.js';

// Mock dependencies
vi.mock('../../src/adapters/puppeteer-harness.js', async () => {
    return {
        launchBrowser: vi.fn(),
        runPhaserTest: vi.fn(),
    };
});

describe('Spike Command', () => {
    let program: Command;
    let consoleLogSpy: any;
    let consoleErrorSpy: any;
    let processExitSpy: any;
    let mockBrowser: any;

    beforeEach(() => {
        program = new Command();
        mockBrowser = { close: vi.fn().mockResolvedValue(undefined) };

        // Mocks
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Default success
        vi.mocked(harness.launchBrowser).mockResolvedValue(Result.ok(mockBrowser));
        vi.mocked(harness.runPhaserTest).mockResolvedValue(Result.ok({
            status: 'PASS',
            framesPlayed: 10,
            errors: [],
            consoleLogs: ['log 1'],
        }));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should register spike command', () => {
        registerSpikeCommand(program);
        expect(program.commands.find(c => c.name() === 'spike')).toBeDefined();
    });

    it('should run successful spike test', async () => {
        registerSpikeCommand(program);
        await program.parseAsync(['node', 'test', 'spike']);

        expect(harness.launchBrowser).toHaveBeenCalled();
        expect(harness.runPhaserTest).toHaveBeenCalled();
        expect(mockBrowser.close).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('SPIKE PASSED'));
        expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle browser launch failure', async () => {
        vi.mocked(harness.launchBrowser).mockResolvedValue(Result.err({
            code: 'FAIL',
            message: 'Launch failed',
            fix: 'Install Chrome'
        }));

        registerSpikeCommand(program);
        await program.parseAsync(['node', 'test', 'spike']);

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Launch failed'));
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle test failure', async () => {
        vi.mocked(harness.runPhaserTest).mockResolvedValue(Result.err({
            code: 'FAIL',
            message: 'Test timeout',
            fix: 'Check logs'
        }));

        registerSpikeCommand(program);
        await program.parseAsync(['node', 'test', 'spike']);

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Test timeout'));
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });
});
