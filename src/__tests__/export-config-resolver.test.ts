/**
 * Tests for export-config-resolver.ts
 * Story 5.9: Export Settings Configuration
 */

import { describe, it, expect } from 'vitest';
import {
    ALLOWED_FLAGS,
    LOCKED_TEXTUREPACKER_FLAGS,
} from '../core/export/export-config-resolver.js';

describe('Export Config Resolver', () => {
    describe('LOCKED_TEXTUREPACKER_FLAGS', () => {
        it('should include format phaser', () => {
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--format');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('phaser');
        });

        it('should include trim-mode', () => {
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--trim-mode');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('Trim');
        });

        it('should disable rotation', () => {
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--disable-rotation');
        });

        it('should include extrude padding', () => {
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('--extrude');
            expect(LOCKED_TEXTUREPACKER_FLAGS).toContain('1');
        });
    });

    describe('ALLOWED_FLAGS', () => {
        it('should allow max-size', () => {
            expect(ALLOWED_FLAGS.has('--max-size')).toBe(true);
        });

        it('should allow scale', () => {
            expect(ALLOWED_FLAGS.has('--scale')).toBe(true);
        });

        it('should allow multipack', () => {
            expect(ALLOWED_FLAGS.has('--multipack')).toBe(true);
        });

        it('should allow algorithm', () => {
            expect(ALLOWED_FLAGS.has('--algorithm')).toBe(true);
        });
    });

    describe('resolveExportConfig', () => {
        it.todo('should merge locked flags with custom flags');
        it.todo('should reject overriding locked flags');
        it.todo('should resolve output paths from manifest');
        it.todo('should apply defaults for missing config');
    });
});
