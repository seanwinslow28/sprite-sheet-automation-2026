/**
 * Tests for new-manifest command
 * Per Story 6.5: Manifest template generator
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
    MANIFEST_PRESETS,
    validateName,
    sanitizeName,
    generateOutputPath,
    applyReplacements,
    generateManifest,
    validateManifest,
} from '../../src/commands/new-manifest.js';

describe('Manifest Presets', () => {
    it('should define champion preset', () => {
        expect(MANIFEST_PRESETS.champion).toBeDefined();
        expect(MANIFEST_PRESETS.champion.target_size).toBe(128);
        expect(MANIFEST_PRESETS.champion.frame_count).toBe(8);
        expect(MANIFEST_PRESETS.champion.identity_min).toBe(0.80);
    });

    it('should define boss preset', () => {
        expect(MANIFEST_PRESETS.boss).toBeDefined();
        expect(MANIFEST_PRESETS.boss.target_size).toBe(256);
        expect(MANIFEST_PRESETS.boss.frame_count).toBe(12);
        expect(MANIFEST_PRESETS.boss.identity_min).toBe(0.75);
    });

    it('should define npc preset', () => {
        expect(MANIFEST_PRESETS.npc).toBeDefined();
        expect(MANIFEST_PRESETS.npc.target_size).toBe(128);
        expect(MANIFEST_PRESETS.npc.frame_count).toBe(4);
        expect(MANIFEST_PRESETS.npc.identity_min).toBe(0.85);
    });
});

describe('Name Validation', () => {
    it('should accept valid names', () => {
        expect(validateName('NOVA', 'Character')).toBeNull();
        expect(validateName('blaze', 'Character')).toBeNull();
        expect(validateName('idle_standard', 'Move')).toBeNull();
        expect(validateName('walk-forward', 'Move')).toBeNull();
        expect(validateName('a1', 'Name')).toBeNull();
    });

    it('should reject empty names', () => {
        expect(validateName('', 'Character')).toContain('cannot be empty');
        expect(validateName('   ', 'Character')).toContain('cannot be empty');
    });

    it('should reject names starting with numbers', () => {
        expect(validateName('123abc', 'Character')).toContain('must start with a letter');
    });

    it('should reject names with invalid characters', () => {
        expect(validateName('nova@attack', 'Move')).toContain('must start with a letter');
        expect(validateName('nova move', 'Move')).toContain('must start with a letter');
    });

    it('should reject names that are too long', () => {
        const longName = 'a'.repeat(33);
        expect(validateName(longName, 'Character')).toContain('32 characters or less');
    });
});

describe('Name Sanitization', () => {
    it('should convert to lowercase', () => {
        expect(sanitizeName('NOVA')).toBe('nova');
        expect(sanitizeName('NoVa')).toBe('nova');
    });

    it('should replace hyphens with underscores', () => {
        expect(sanitizeName('walk-forward')).toBe('walk_forward');
        expect(sanitizeName('idle-standard-loop')).toBe('idle_standard_loop');
    });

    it('should handle mixed case and hyphens', () => {
        expect(sanitizeName('Walk-Forward')).toBe('walk_forward');
    });
});

describe('Output Path Generation', () => {
    it('should generate path from character and move', () => {
        const result = generateOutputPath('NOVA', 'attack');
        expect(result).toBe(path.join('manifests', 'nova-attack.yaml'));
    });

    it('should use custom output directory', () => {
        const result = generateOutputPath('blaze', 'idle', 'custom/dir');
        expect(result).toBe(path.join('custom/dir', 'blaze-idle.yaml'));
    });

    it('should sanitize names in path', () => {
        const result = generateOutputPath('Nova-Char', 'walk-forward');
        expect(result).toBe(path.join('manifests', 'nova_char-walk_forward.yaml'));
    });
});

describe('Template Replacement', () => {
    it('should replace placeholders', () => {
        const template = 'Hello {{NAME}}, welcome to {{PLACE}}!';
        const result = applyReplacements(template, {
            '{{NAME}}': 'World',
            '{{PLACE}}': 'Earth',
        });
        expect(result).toBe('Hello World, welcome to Earth!');
    });

    it('should replace multiple occurrences', () => {
        const template = '{{X}} + {{X}} = {{RESULT}}';
        const result = applyReplacements(template, {
            '{{X}}': '2',
            '{{RESULT}}': '4',
        });
        expect(result).toBe('2 + 2 = 4');
    });

    it('should handle empty replacements', () => {
        const template = 'No replacements here';
        const result = applyReplacements(template, {});
        expect(result).toBe('No replacements here');
    });
});

describe('Manifest Generation', () => {
    it('should generate manifest with champion preset', async () => {
        const manifest = await generateManifest('NOVA', 'attack', 'champion');

        expect(manifest).toContain('character: "NOVA"');
        expect(manifest).toContain('move: "attack"');
        expect(manifest).toContain('target_size: 128');
        expect(manifest).toContain('frame_count: 8');
        expect(manifest).toContain('SF01_IDENTITY_DRIFT: 0.8');
    });

    it('should generate manifest with boss preset', async () => {
        const manifest = await generateManifest('TITAN', 'smash', 'boss');

        expect(manifest).toContain('character: "TITAN"');
        expect(manifest).toContain('target_size: 256');
        expect(manifest).toContain('frame_count: 12');
    });

    it('should generate manifest with npc preset', async () => {
        const manifest = await generateManifest('villager', 'idle', 'npc');

        expect(manifest).toContain('character: "VILLAGER"');
        expect(manifest).toContain('target_size: 128');
        expect(manifest).toContain('frame_count: 4');
    });

    it('should include lowercase character in paths', async () => {
        const manifest = await generateManifest('NOVA', 'attack', 'champion');

        expect(manifest).toContain('assets/characters/nova/anchor.png');
        expect(manifest).toContain('assets/prompts/nova/master.txt');
    });

    it('should include current date', async () => {
        const manifest = await generateManifest('test', 'idle', 'champion');
        const today = new Date().toISOString().split('T')[0];

        expect(manifest).toContain(`Date: ${today}`);
    });
});

describe('Manifest Validation', () => {
    it('should validate generated manifest', async () => {
        const manifest = await generateManifest('NOVA', 'attack', 'champion');
        const result = validateManifest(manifest);

        if (!result.valid) {
            console.log('Validation errors:', result.errors);
        }

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid YAML', () => {
        const result = validateManifest('invalid: yaml: syntax: [');
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect missing required fields', () => {
        const result = validateManifest('identity:\n  character: "TEST"');
        expect(result.valid).toBe(false);
    });
});

describe('Manifest File Writing', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `manifest-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    it('should write manifest to file', async () => {
        const manifest = await generateManifest('NOVA', 'attack', 'champion');
        const outputPath = path.join(testDir, 'test-manifest.yaml');

        await fs.writeFile(outputPath, manifest, 'utf-8');

        const exists = await fs.access(outputPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        const content = await fs.readFile(outputPath, 'utf-8');
        expect(content).toContain('character: "NOVA"');
    });

    it('should create nested directories', async () => {
        const manifest = await generateManifest('NOVA', 'attack', 'champion');
        const outputPath = path.join(testDir, 'nested', 'dir', 'manifest.yaml');

        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, manifest, 'utf-8');

        const exists = await fs.access(outputPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
    });
});
