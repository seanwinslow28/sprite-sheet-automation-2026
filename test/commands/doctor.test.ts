/**
 * Tests for Doctor command
 * Mocks dependency checks to verify command logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerDoctorCommand } from '../../src/commands/doctor.js';
import * as checker from '../../src/utils/dependency-checker.js';

// Mock dependency checker
vi.mock('../../src/utils/dependency-checker.js', async () => {
    return {
        checkNodeVersion: vi.fn(),
        checkTexturePacker: vi.fn(),
        checkTexturePackerLicense: vi.fn(),
        checkChrome: vi.fn(),
        checkEnvironment: vi.fn(),
        checkGeminiAPI: vi.fn(),
    };
});

describe('Doctor Command', () => {
    let program: Command;
    let consoleLogSpy: any;
    let processExitSpy: any;

    beforeEach(() => {
        program = new Command();
        // Prevent actual exit
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { }) as any);
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

        // Default clean mocks
        vi.mocked(checker.checkNodeVersion).mockResolvedValue({ status: 'PASS', name: 'Node.js', message: 'OK' });
        vi.mocked(checker.checkTexturePacker).mockResolvedValue({ status: 'PASS', name: 'TP', message: 'OK' });
        vi.mocked(checker.checkTexturePackerLicense).mockResolvedValue({ status: 'PASS', name: 'TP License', message: 'OK' });
        vi.mocked(checker.checkChrome).mockResolvedValue({ status: 'PASS', name: 'Chrome', message: 'OK' });
        vi.mocked(checker.checkEnvironment).mockResolvedValue({ status: 'PASS', name: 'Env', message: 'OK' });
        vi.mocked(checker.checkGeminiAPI).mockResolvedValue({ status: 'PASS', name: 'Gemini', message: 'OK' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should register doctor command', () => {
        registerDoctorCommand(program);
        expect(program.commands.find(c => c.name() === 'doctor')).toBeDefined();
    });

    it('should pass given all checks pass', async () => {
        registerDoctorCommand(program);
        await program.parseAsync(['node', 'test', 'doctor']);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('6 passed, 0 failed'));
        expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should fail if any check fails', async () => {
        vi.mocked(checker.checkNodeVersion).mockResolvedValue({
            status: 'FAIL',
            name: 'Node.js',
            message: 'Old version',
            fix: 'Update'
        });

        registerDoctorCommand(program);
        await program.parseAsync(['node', 'test', 'doctor']);

        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('5 passed, 1 failed'));
        expect(processExitSpy).toHaveBeenCalledWith(1);
    });
});
