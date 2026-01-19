/**
 * Prompt template engine for AI frame generation
 * Per Stories 2.4 and 2.10: Template selection, interpolation, and loop closure
 */

import { type PromptTemplates } from '../domain/schemas/manifest.js';
import { getPoseForFrame, type PosePhase } from '../domain/poses.js';

/**
 * Context for prompt construction
 */
export interface PromptContext {
    frameIndex: number;
    totalFrames: number;
    attemptIndex: number;
    characterId: string;
    moveId: string;
    isLoop: boolean;
    retryAction?: 'identity_rescue' | 'tighten_prompt' | 're_anchor' | null;
    previousFrameSF01?: number;
}

/**
 * Result of prompt building
 */
export interface BuiltPrompt {
    templateName: 'master' | 'variation' | 'lock';
    rawTemplate: string;
    resolvedPrompt: string;
    negativePrompt: string;
    posePhase: PosePhase | null;
    isLoopClosure: boolean;
}

// Loop closure constants
const LOOP_CLOSURE_CONTEXT = `CRITICAL CONTEXT: This is the FINAL frame of a looping animation.

OBJECTIVE: Create the missing link that connects [IMAGE 2] (current pose) back to [IMAGE 1] (starting pose).

CONSTRAINT: The pose must be 85% transitioned towards [IMAGE 1]. The character should be almost returned to the starting position but with residual motion energy.

PHYSICS: Ensure momentum decelerates to match the starting state. No abrupt stops - the motion should flow naturally into the loop restart.

`;

/**
 * Select which template to use based on context
 */
export function selectTemplate(
    context: PromptContext
): 'master' | 'variation' | 'lock' {
    // Identity rescue or tighten prompt → lock template
    if (context.retryAction === 'identity_rescue' || context.retryAction === 'tighten_prompt') {
        return 'lock';
    }

    // Frame 0, attempt 1 → master template
    if (context.frameIndex === 0 && context.attemptIndex === 1) {
        return 'master';
    }

    // All other cases → variation template
    return 'variation';
}

/**
 * Interpolate template variables
 */
export function interpolateTemplate(
    template: string,
    context: PromptContext
): string {
    const variables: Record<string, string | number> = {
        frame_index: context.frameIndex,
        total_frames: context.totalFrames,
        attempt_index: context.attemptIndex,
        character_id: context.characterId,
        move_id: context.moveId,
    };

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }

    // Warn on unresolved placeholders (in development)
    const unresolved = result.match(/\{[a-z_]+\}/gi);
    if (unresolved && process.env.NODE_ENV !== 'production') {
        console.warn(`Unresolved template placeholders: ${unresolved.join(', ')}`);
    }

    return result;
}

/**
 * Check if this frame is the loop closure frame
 */
export function isLoopClosureFrame(context: PromptContext): boolean {
    return context.isLoop && context.frameIndex === context.totalFrames - 1;
}

/**
 * Build the complete prompt for frame generation
 */
export function buildPrompt(
    templates: PromptTemplates,
    context: PromptContext
): BuiltPrompt {
    // Select template
    const templateName = selectTemplate(context);
    const rawTemplate = templates[templateName];

    // Get pose phase for this frame
    const posePhase = getPoseForFrame(context.moveId, context.frameIndex);

    // Check loop closure
    const isLoopClosure = isLoopClosureFrame(context);

    // Build the prompt parts
    const parts: string[] = [];

    // Add loop closure context if applicable
    if (isLoopClosure) {
        parts.push(LOOP_CLOSURE_CONTEXT);
    }

    // Add pose action if available
    if (posePhase) {
        parts.push(`POSE ACTION: ${posePhase.description}`);
        parts.push(`TENSION: ${posePhase.tension}`);
        parts.push('');
    }

    // Add interpolated main template
    const interpolatedTemplate = interpolateTemplate(rawTemplate, context);
    parts.push(interpolatedTemplate);

    // Combine parts
    const resolvedPrompt = parts.join('\n');

    // Format negative prompt
    const negativePrompt = `AVOID: ${templates.negative}`;

    return {
        templateName,
        rawTemplate,
        resolvedPrompt,
        negativePrompt,
        posePhase,
        isLoopClosure,
    };
}

/**
 * Build the final prompt with negative appended
 */
export function buildFinalPrompt(
    templates: PromptTemplates,
    context: PromptContext
): string {
    const built = buildPrompt(templates, context);
    return `${built.resolvedPrompt}\n\n${built.negativePrompt}`;
}

/**
 * Log prompt details for audit
 */
export interface PromptLogEntry {
    timestamp: string;
    frameIndex: number;
    attemptIndex: number;
    templateName: string;
    isLoopClosure: boolean;
    poseDescription: string | null;
    resolvedPrompt: string;
}

export function createPromptLogEntry(
    built: BuiltPrompt,
    context: PromptContext
): PromptLogEntry {
    return {
        timestamp: new Date().toISOString(),
        frameIndex: context.frameIndex,
        attemptIndex: context.attemptIndex,
        templateName: built.templateName,
        isLoopClosure: built.isLoopClosure,
        poseDescription: built.posePhase?.description ?? null,
        resolvedPrompt: built.resolvedPrompt,
    };
}
