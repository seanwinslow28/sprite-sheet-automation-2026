/**
 * Tests for pose library and prompt template engine (Stories 2.4, 2.10, 2.11)
 */

import { describe, it, expect } from 'vitest';
import {
    getPoseForFrame,
    hasMoveDefinition,
    getDefinedFrames,
    MOVES_LIBRARY,
    FALLBACK_POSE,
} from '../../src/domain/poses.js';
import {
    selectTemplate,
    interpolateTemplate,
    isLoopClosureFrame,
    buildPrompt,
    buildFinalPrompt,
    type PromptContext,
} from '../../src/core/prompt-template-engine.js';
import { type PromptTemplates } from '../../src/domain/schemas/manifest.js';

// Test prompt templates
const testTemplates: PromptTemplates = {
    master: 'Generate Frame 0 of {total_frames} for {character_id} {move_id} animation.',
    variation: 'Generate Frame {frame_index} of {total_frames} for {character_id} {move_id} animation.',
    lock: 'CRITICAL: Identity rescue for Frame {frame_index}. Match anchor exactly.',
    negative: 'blurry, anti-aliased, smooth gradients',
};

// Base context
const baseContext: PromptContext = {
    frameIndex: 0,
    totalFrames: 8,
    attemptIndex: 1,
    characterId: 'champion_01',
    moveId: 'idle',
    isLoop: true,
    retryAction: null,
};

describe('Pose Library (Story 2.11)', () => {
    describe('AC #1: Pose file exists', () => {
        it('should export MOVES_LIBRARY with defined moves', () => {
            expect(MOVES_LIBRARY).toBeDefined();
            expect(MOVES_LIBRARY.idle_standard).toBeDefined();
            expect(MOVES_LIBRARY.walk_forward).toBeDefined();
        });
    });

    describe('AC #2: Frame lookup', () => {
        it('should return null for frame 0 (anchor pose)', () => {
            const pose = getPoseForFrame('idle', 0);
            expect(pose).toBeNull();
        });

        it('should return pose for defined frames', () => {
            const pose = getPoseForFrame('idle', 1);
            expect(pose).not.toBeNull();
            expect(pose?.description).toContain('exhale');
        });
    });

    describe('AC #4: Fallback', () => {
        it('should return fallback for undefined move', () => {
            const pose = getPoseForFrame('unknown_move', 3);
            expect(pose).toEqual(FALLBACK_POSE);
        });

        it('should return fallback for undefined frame in known move', () => {
            const pose = getPoseForFrame('idle', 99);
            expect(pose).toEqual(FALLBACK_POSE);
        });
    });

    describe('AC #5-8: Pose structure', () => {
        it('should include description and tension', () => {
            const pose = getPoseForFrame('walk_forward', 1);
            expect(pose?.description).toBeDefined();
            expect(pose?.tension).toMatch(/^(relaxed|tense|explosive)$/);
        });

        it('should define biomechanical phases for walk', () => {
            const frames = getDefinedFrames('walk_forward');
            expect(frames).toEqual([1, 2, 3, 4, 5, 6, 7]);
        });
    });

    describe('AC #9-10: MVP content', () => {
        it('should define idle_standard with 7 frames', () => {
            const frames = getDefinedFrames('idle_standard');
            expect(frames.length).toBe(7);
        });

        it('should define walk_forward with 7 frames', () => {
            const frames = getDefinedFrames('walk_forward');
            expect(frames.length).toBe(7);
        });
    });
});

describe('Prompt Template System (Story 2.4)', () => {
    describe('AC #1: Master template for frame 0', () => {
        it('should select master for frame 0, attempt 1', () => {
            const template = selectTemplate({ ...baseContext, frameIndex: 0, attemptIndex: 1 });
            expect(template).toBe('master');
        });
    });

    describe('AC #2: Variation template for frame N', () => {
        it('should select variation for frame > 0, attempt 1', () => {
            const template = selectTemplate({ ...baseContext, frameIndex: 3, attemptIndex: 1 });
            expect(template).toBe('variation');
        });
    });

    describe('AC #3: Lock template for recovery', () => {
        it('should select lock for identity_rescue action', () => {
            const template = selectTemplate({ ...baseContext, retryAction: 'identity_rescue' });
            expect(template).toBe('lock');
        });

        it('should select lock for tighten_prompt action', () => {
            const template = selectTemplate({ ...baseContext, retryAction: 'tighten_prompt' });
            expect(template).toBe('lock');
        });
    });

    describe('AC #4: Negative prompt appended', () => {
        it('should include AVOID prefix in final prompt', () => {
            const finalPrompt = buildFinalPrompt(testTemplates, baseContext);
            expect(finalPrompt).toContain('AVOID: blurry');
        });
    });

    describe('Variable interpolation', () => {
        it('should replace all template variables', () => {
            const template = 'Frame {frame_index} of {total_frames} for {character_id}';
            const result = interpolateTemplate(template, { ...baseContext, frameIndex: 3 });
            expect(result).toBe('Frame 3 of 8 for champion_01');
        });
    });

    describe('Pose injection (AC #3 from 2.11)', () => {
        it('should inject pose description in prompt', () => {
            const built = buildPrompt(testTemplates, { ...baseContext, frameIndex: 2 });
            expect(built.resolvedPrompt).toContain('POSE ACTION:');
            expect(built.posePhase).not.toBeNull();
        });

        it('should not inject pose for frame 0', () => {
            const built = buildPrompt(testTemplates, { ...baseContext, frameIndex: 0 });
            expect(built.posePhase).toBeNull();
            expect(built.resolvedPrompt).not.toContain('POSE ACTION:');
        });
    });
});

describe('Loop Closure (Story 2.10)', () => {
    describe('AC #1: Loop detection', () => {
        it('should detect loop closure on final frame of looping animation', () => {
            const closure = isLoopClosureFrame({
                ...baseContext,
                isLoop: true,
                frameIndex: 7, // Last frame of 8
                totalFrames: 8,
            });
            expect(closure).toBe(true);
        });

        it('should not detect loop closure on non-final frames', () => {
            const closure = isLoopClosureFrame({
                ...baseContext,
                isLoop: true,
                frameIndex: 3,
            });
            expect(closure).toBe(false);
        });
    });

    describe('AC #2: Prompt modification', () => {
        it('should include loop closure context in prompt', () => {
            const built = buildPrompt(testTemplates, {
                ...baseContext,
                isLoop: true,
                frameIndex: 7,
                totalFrames: 8,
            });
            expect(built.isLoopClosure).toBe(true);
            expect(built.resolvedPrompt).toContain('CRITICAL CONTEXT');
            expect(built.resolvedPrompt).toContain('FINAL frame');
            expect(built.resolvedPrompt).toContain('85%');
        });
    });

    describe('AC #6: No closure for linear', () => {
        it('should not apply loop closure for non-looping animation', () => {
            const built = buildPrompt(testTemplates, {
                ...baseContext,
                isLoop: false,
                frameIndex: 7,
                totalFrames: 8,
            });
            expect(built.isLoopClosure).toBe(false);
            expect(built.resolvedPrompt).not.toContain('CRITICAL CONTEXT');
        });
    });
});
