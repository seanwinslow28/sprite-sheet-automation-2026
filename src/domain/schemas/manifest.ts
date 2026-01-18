/**
 * Complete manifest schema definition using Zod
 * This is the ONLY source of truth for manifest data shapes
 */

import { z } from 'zod';

// Identity schema - run identification
export const identitySchema = z.object({
    character: z.string().describe('Character ID (e.g., "champion_01")'),
    move: z.string().describe('Move name (e.g., "idle", "walk", "attack")'),
    version: z.string().describe('Manifest version (e.g., "1.0.0")'),
    frame_count: z.number().int().positive().describe('Total frames in animation'),
});

// Inputs schema - reference images
export const inputsSchema = z.object({
    anchor: z.string().describe('Path to anchor image (required)'),
    style_refs: z.array(z.string()).optional().describe('Optional style reference images'),
    pose_refs: z.array(z.string()).optional().describe('Optional pose reference images'),
    guides: z.array(z.string()).optional().describe('Optional guide overlays'),
});

// Prompt templates schema
export const promptTemplatesSchema = z.object({
    master: z.string().describe('First attempt prompt'),
    variation: z.string().describe('Frame i of N prompt'),
    lock: z.string().describe('Recovery prompt after drift'),
    negative: z.string().describe('Avoid list'),
});

// Generator schema - AI backend configuration
export const generatorSchema = z.object({
    backend: z.literal('gemini').describe('AI backend (only gemini for MVP)'),
    model: z.string().describe('Model ID (e.g., "gemini-2.0-flash-exp")'),
    mode: z.literal('edit').describe('Generation mode'),
    seed_policy: z.string().default('fixed_then_random').describe('Seed policy'),
    max_attempts_per_frame: z.number().int().positive().describe('Maximum attempts per frame'),
    prompts: promptTemplatesSchema.describe('Prompt templates for generation'),
});

// Auditor schema - quality gates and metrics
export const auditorSchema = z.object({
    hard_gates: z.record(z.number()).describe('HF01-HF05 thresholds'),
    soft_metrics: z.record(z.number()).describe('SF01-SF05 thresholds'),
    weights: z.record(z.number()).describe('Scoring weights'),
});

// Retry schema - retry strategy
export const retrySchema = z.object({
    ladder: z.array(z.string()).describe('Retry strategy sequence'),
    stop_conditions: z.record(z.any()).describe('When to halt'),
});

// Export schema - TexturePacker configuration
export const exportSchema = z.object({
    packer_flags: z.string().describe('TexturePacker CLI flags'),
    atlas_format: z.string().describe('Output format (phaser-hash)'),
});

// Complete manifest schema
export const manifestSchema = z.object({
    identity: identitySchema.describe('Run identification'),
    inputs: inputsSchema.describe('Reference images'),
    generator: generatorSchema.describe('AI backend configuration'),
    auditor: auditorSchema.describe('Quality gates and metrics'),
    retry: retrySchema.describe('Retry strategy'),
    export: exportSchema.describe('Export configuration'),
});

// Inferred TypeScript type
export type Manifest = z.infer<typeof manifestSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type Inputs = z.infer<typeof inputsSchema>;
export type Generator = z.infer<typeof generatorSchema>;
export type PromptTemplates = z.infer<typeof promptTemplatesSchema>;
export type Auditor = z.infer<typeof auditorSchema>;
export type Retry = z.infer<typeof retrySchema>;
export type Export = z.infer<typeof exportSchema>;
