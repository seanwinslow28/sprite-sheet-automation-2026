/**
 * Tests for release-gating.ts
 * Story 5.8: Release-Ready Gating
 */

import { describe, it, expect, vi } from 'vitest';
import {
    evaluateReleaseReadiness,
    canPromote,
    createPendingReleaseInfo,
    buildValidationSummary,
} from '../core/export/release-gating.js';

vi.mock('fs');

describe('Release Gating', () => {
    describe('evaluateReleaseReadiness', () => {
        it('should return release-ready when all tests pass', () => {
            const summary = buildValidationSummary(true, true);
            const result = evaluateReleaseReadiness(summary);
            expect(result.releaseInfo.status).toBe('release-ready');
        });

        it('should return validation-failed when tests fail', () => {
            const summary = buildValidationSummary(false, false, 'Test failed');
            const result = evaluateReleaseReadiness(summary);
            expect(result.releaseInfo.status).toBe('validation-failed');
        });

        it('should return debug-only when override is used', () => {
            const summary = buildValidationSummary(false, false, 'Test failed');
            const result = evaluateReleaseReadiness(summary, true);
            expect(result.releaseInfo.status).toBe('debug-only');
            expect(result.releaseInfo.override_used).toBe(true);
        });
    });

    describe('canPromote', () => {
        it('should allow promotion for release-ready status', () => {
            const info = createPendingReleaseInfo();
            info.status = 'release-ready';
            expect(canPromote(info)).toBe(true);
        });

        it('should block promotion for validation-failed status', () => {
            const info = createPendingReleaseInfo();
            info.status = 'validation-failed';
            expect(canPromote(info)).toBe(false);
        });

        it('should block promotion for pending status', () => {
            const info = createPendingReleaseInfo();
            expect(canPromote(info)).toBe(false);
        });
    });

    describe('createPendingReleaseInfo', () => {
        it('should create info with pending status', () => {
            const info = createPendingReleaseInfo();
            expect(info.status).toBe('pending');
            expect(info.promoted).toBe(false);
            expect(info.override_used).toBe(false);
        });
    });
});
