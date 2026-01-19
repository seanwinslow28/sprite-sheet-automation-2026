/**
 * Gemini generator adapter with Semantic Interleaving pattern
 * Per Story 2.3: AI frame generation using @google/generative-ai SDK
 */

import { promises as fs } from 'fs';
import { dirname } from 'path';
import { calculateSeed, describeSeedPolicy } from '../utils/crc32.js';
import { redactSecrets } from '../utils/fs-helpers.js';
import { buildPrompt, type PromptContext } from '../core/prompt-template-engine.js';
import { type PromptTemplates } from '../domain/schemas/manifest.js';
import { Result } from '../core/config-resolver.js';
import { logger } from '../utils/logger.js';

/**
 * Part for Gemini API content
 */
export interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

/**
 * Generator context for frame generation
 */
export interface GeneratorContext {
    runId: string;
    frameIndex: number;
    attemptIndex: number;
    totalFrames: number;
    characterId: string;
    moveId: string;
    isLoop: boolean;
    anchorImagePath: string;
    previousFramePath?: string;
    previousFrameSF01?: number;
    retryAction?: 'identity_rescue' | 'tighten_prompt' | 're_anchor' | null;
    outputPath: string;
    canvasSize: number;
}

/**
 * Result of generation attempt
 */
export interface CandidateResult {
    imagePath: string;
    rawPrompt: string;
    generatorParams: Record<string, unknown>;
    attemptId: string;
    seed: number | undefined;
    thoughtSignature?: string;
    thoughtContent?: string;
    durationMs: number;
    errors: string[];
}

/**
 * Error for generator operations
 */
export interface GeneratorError {
    code: string;
    message: string;
    retryable: boolean;
    cause?: unknown;
}

// Temperature lock per Deep Think analysis
const LOCKED_TEMPERATURE = 1.0;
const TOP_P = 0.95;
const TOP_K = 40;

// Drift threshold for reference stack
const SF01_THRESHOLD = 0.9;

/**
 * Load image as base64
 */
async function loadImageBase64(imagePath: string): Promise<string> {
    const buffer = await fs.readFile(imagePath);
    return buffer.toString('base64');
}

/**
 * Build Semantic Interleaving Part[] array
 * Per Deep Think Lock: [Anchor, PrevFrame] with text labels
 */
export async function buildPromptParts(
    context: GeneratorContext,
    promptText: string
): Promise<Part[]> {
    const parts: Part[] = [];

    // [IMAGE 1]: Master anchor
    parts.push({ text: '[IMAGE 1]: MASTER ANCHOR (IDENTITY TRUTH)' });
    const anchorBase64 = await loadImageBase64(context.anchorImagePath);
    parts.push({
        inlineData: {
            mimeType: 'image/png',
            data: anchorBase64,
        },
    });

    // [IMAGE 2]: Previous frame (if available and not drifted)
    if (context.previousFramePath &&
        context.previousFrameSF01 !== undefined &&
        context.previousFrameSF01 >= SF01_THRESHOLD) {
        parts.push({ text: '[IMAGE 2]: PREVIOUS FRAME (POSE REFERENCE)' });
        const prevFrameBase64 = await loadImageBase64(context.previousFramePath);
        parts.push({
            inlineData: {
                mimeType: 'image/png',
                data: prevFrameBase64,
            },
        });
    } else if (context.previousFramePath &&
        context.previousFrameSF01 !== undefined &&
        context.previousFrameSF01 < SF01_THRESHOLD) {
        // Log drift warning (frame excluded from reference stack)
        logger.warn({
            frameIndex: context.frameIndex,
            previousFrameSF01: context.previousFrameSF01,
            threshold: SF01_THRESHOLD,
        }, 'Skipping PrevFrame reference due to drift');
    }

    // Hierarchy instruction
    parts.push({ text: 'HIERARCHY: If [IMAGE 2] conflicts with [IMAGE 1], [IMAGE 1] wins.' });

    // Main prompt
    parts.push({ text: promptText });

    return parts;
}

/**
 * Build generation config with locked parameters
 */
export function buildGenerationConfig(manifestTemperature?: number): {
    temperature: number;
    topP: number;
    topK: number;
} {
    // Warn if manifest attempts to override temperature
    if (manifestTemperature !== undefined && manifestTemperature < LOCKED_TEMPERATURE) {
        logger.warn({
            requested: manifestTemperature,
            locked: LOCKED_TEMPERATURE,
            reason: 'Deep Think Lock',
        }, 'Temperature override blocked - using locked value');
    }

    return {
        temperature: LOCKED_TEMPERATURE,
        topP: TOP_P,
        topK: TOP_K,
    };
}

/**
 * Generate a frame using Gemini API
 * NOTE: This is a stub implementation - actual API call requires @google/generative-ai SDK
 */
export async function generateFrame(
    context: GeneratorContext,
    templates: PromptTemplates,
    apiKey: string
): Promise<Result<CandidateResult, GeneratorError>> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
        // Check API key
        if (!apiKey) {
            return Result.err({
                code: 'SYS_GEMINI_UNAVAILABLE',
                message: 'GEMINI_API_KEY not set',
                retryable: false,
            });
        }

        // Build prompt context
        const promptContext: PromptContext = {
            frameIndex: context.frameIndex,
            totalFrames: context.totalFrames,
            attemptIndex: context.attemptIndex,
            characterId: context.characterId,
            moveId: context.moveId,
            isLoop: context.isLoop,
            retryAction: context.retryAction,
            previousFrameSF01: context.previousFrameSF01,
        };

        // Build the prompt
        const builtPrompt = buildPrompt(templates, promptContext);
        const fullPrompt = `${builtPrompt.resolvedPrompt}\n\n${builtPrompt.negativePrompt}`;

        // Calculate seed
        const seed = calculateSeed(context.runId, context.frameIndex, context.attemptIndex);

        // Build generation config
        const genConfig = buildGenerationConfig();

        // Build prompt parts for Semantic Interleaving
        // Note: 'parts' is built for future API integration but unused in stub
        const parts = await buildPromptParts(context, fullPrompt);
        void parts; // Suppress unused variable warning - will be used when API call is implemented

        // Create attempt ID
        const attemptId = `${context.runId}_f${context.frameIndex}_a${context.attemptIndex}`;

        // Build generator params for logging (redacted)
        const generatorParams = redactSecrets({
            model: 'gemini-2.0-flash-exp',
            ...genConfig,
            seed,
            seedPolicy: describeSeedPolicy(context.attemptIndex),
            canvasSize: context.canvasSize,
        });

        // -------------------------------------------------------------------
        // ACTUAL API CALL WOULD GO HERE
        // Using @google/generative-ai SDK:
        //
        // import { GoogleGenerativeAI } from '@google/generative-ai';
        // const genAI = new GoogleGenerativeAI(apiKey);
        // const model = genAI.getGenerativeModel({ 
        //     model: 'gemini-2.0-flash-exp',
        //     generationConfig: genConfig,
        // });
        // const result = await model.generateContent({ contents: [{ parts }] });
        // const response = result.response;
        // Extract image from response and save to context.outputPath
        // -------------------------------------------------------------------

        // For now, return a stub result indicating API call needed
        // In production, this would be replaced with actual API call

        // Ensure output directory exists
        await fs.mkdir(dirname(context.outputPath), { recursive: true });

        // Create a placeholder file to indicate where output would go
        // (In production, this is the generated image)
        await fs.writeFile(
            context.outputPath + '.stub',
            JSON.stringify({
                message: 'Stub: Real API call would generate image here',
                prompt: fullPrompt.substring(0, 200) + '...',
                seed,
                attemptId,
            }, null, 2)
        );

        const durationMs = Date.now() - startTime;

        return Result.ok({
            imagePath: context.outputPath,
            rawPrompt: fullPrompt,
            generatorParams,
            attemptId,
            seed,
            thoughtSignature: undefined,
            thoughtContent: undefined,
            durationMs,
            errors,
        });
    } catch (error) {
        // Map errors to codes
        const errorMessage = error instanceof Error ? error.message : String(error);
        let code = 'SYS_GEMINI_UNKNOWN';
        let retryable = false;

        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
            code = 'SYS_GEMINI_RATE_LIMIT';
            retryable = true;
        } else if (errorMessage.includes('timeout')) {
            code = 'SYS_GEMINI_TIMEOUT';
            retryable = true;
        } else if (errorMessage.includes('unavailable') || errorMessage.includes('ENOTFOUND')) {
            code = 'SYS_GEMINI_UNAVAILABLE';
            retryable = false;
        }

        return Result.err({
            code,
            message: errorMessage,
            retryable,
            cause: error,
        });
    }
}

/**
 * Log generation attempt to audit file
 */
export async function logGenerationToAudit(
    auditPath: string,
    result: CandidateResult,
    context: GeneratorContext
): Promise<void> {
    const entry = {
        timestamp: new Date().toISOString(),
        run_id: context.runId,
        frame_index: context.frameIndex,
        attempt_index: context.attemptIndex,
        attempt_id: result.attemptId,
        seed: result.seed,
        duration_ms: result.durationMs,
        image_path: result.imagePath,
        prompt_length: result.rawPrompt.length,
        thought_signature: result.thoughtSignature || null,
        errors: result.errors,
    };

    // Append to JSONL file
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(auditPath, line);
}
