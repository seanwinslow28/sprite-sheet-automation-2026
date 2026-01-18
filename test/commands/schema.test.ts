/**
 * Tests for Schema command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerSchemaCommand } from '../../src/commands/schema.js';

describe('Schema Command', () => {
    let program: Command;
    let consoleLogSpy: any;

    beforeEach(() => {
        program = new Command();
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should register schema command', () => {
        registerSchemaCommand(program);
        const cmd = program.commands.find(c => c.name() === 'schema');
        expect(cmd).toBeDefined();
        expect(cmd?.description()).toBe('View manifest schema and examples');
    });

    it('should output JSON schema by default', () => {
        registerSchemaCommand(program);
        program.parse(['node', 'test', 'schema']);

        expect(consoleLogSpy).toHaveBeenCalled();
        // Find the call that looks like JSON (starts with {)
        const output = consoleLogSpy.mock.calls.flat().find((arg: any) => typeof arg === 'string' && arg.trim().startsWith('{'));
        expect(output).toBeDefined();
        const json = JSON.parse(output);
        expect(json.title).toBe('Sprite Animation Manifest Schema');
        expect(json.properties.identity).toBeDefined();
    });

    it('should output example manifest with --example flag', () => {
        registerSchemaCommand(program);
        program.parse(['node', 'test', 'schema', '--example']);

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls[0][0];
        expect(output).toContain('character: "champion_01"');
        expect(output).toContain('move: "idle"');
    });
});
