/**
 * Tests for texturepacker-adapter.ts
 * Story 5.2: TexturePacker Integration
 */

import { describe, it, expect, vi } from 'vitest';
import { buildTexturePackerArgs } from '../adapters/texturepacker-adapter.js';
import { LOCKED_TEXTUREPACKER_FLAGS, ALLOWED_FLAGS } from '../core/export/export-config-resolver.js';

vi.mock('execa');

describe('TexturePacker Adapter', () => {
    describe('LOCKED_TEXTUREPACKER_FLAGS', () => {
        it('should include Phaser format flag', () => {
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--format');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('phaser');
        });

        it('should include trim mode', () => {
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--trim-mode');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('Trim');
        });

        it('should disable rotation', () => {
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--disable-rotation');
        });
    });

    describe('buildTexturePackerArgs', () => {
        it('should include locked flags', () => {
            const args = buildTexturePackerArgs('/input', '/output/atlas');
            expect(args).toContain('--format');
            expect(args).toContain('phaser');
        });

        it('should set output paths', () => {
            const args = buildTexturePackerArgs('/input', '/output/atlas');
            expect(args).toContain('--data');
            expect(args).toContain('/output/atlas.json');
        });

        it('should enable multipack by default', () => {
            const args = buildTexturePackerArgs('/input', '/output/atlas');
            expect(args).toContain('--multipack');
        });

        it('should use {n} placeholder for multipack sheets', () => {
            const args = buildTexturePackerArgs('/input', '/output/atlas', undefined, true);
            const sheetIndex = args.indexOf('--sheet');
            expect(args[sheetIndex + 1]).toContain('{n}');
        });

        it('should not use placeholder when multipack disabled', () => {
            const args = buildTexturePackerArgs('/input', '/output/atlas', undefined, false);
            const sheetIndex = args.indexOf('--sheet');
            expect(args[sheetIndex + 1]).not.toContain('{n}');
        });
    });

    describe('ALLOWED_FLAGS', () => {
        it('should allow max-size customization', () => {
            expect(ALLOWED_FLAGS.has('--max-size')).toBe(true);
        });

        it('should allow multipack customization', () => {
            expect(ALLOWED_FLAGS.has('--multipack')).toBe(true);
        });

        it('should allow scale customization', () => {
            expect(ALLOWED_FLAGS.has('--scale')).toBe(true);
        });
    });
});
