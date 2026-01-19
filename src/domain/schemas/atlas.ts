/**
 * Atlas Schema Definitions
 * Story 5.3: Phaser-Compatible Atlas Output
 *
 * Zod schemas for validating TexturePacker JSON Hash output format.
 */

import { z } from 'zod';

/**
 * Frame data schema - represents a single frame in the atlas
 */
export const frameDataSchema = z.object({
    frame: z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        w: z.number().int().positive(),
        h: z.number().int().positive(),
    }),
    rotated: z.literal(false), // We disable rotation with --disable-rotation
    trimmed: z.boolean(),
    spriteSourceSize: z.object({
        x: z.number().int(),
        y: z.number().int(),
        w: z.number().int().positive(),
        h: z.number().int().positive(),
    }),
    sourceSize: z.object({
        w: z.number().int().positive(),
        h: z.number().int().positive(),
    }),
});

/**
 * Atlas meta schema - metadata about the atlas
 */
export const atlasMetaSchema = z.object({
    app: z.string(),
    version: z.string(),
    image: z.string().endsWith('.png'),
    format: z.literal('RGBA8888'),
    size: z.object({
        w: z.number().int().positive(),
        h: z.number().int().positive(),
    }),
    scale: z.string(), // TexturePacker outputs "1" as string
    smartupdate: z.string().optional(),
});

/**
 * Full atlas JSON schema
 * Note: We use a loose frames validation here and do strict key validation separately
 */
export const atlasJsonSchema = z.object({
    frames: z.record(z.string(), frameDataSchema),
    meta: atlasMetaSchema,
});

/**
 * Multipack atlas schema - for atlases that span multiple textures
 * Story 5.4: Multipack Support
 */
export const multipackAtlasSchema = z.object({
    textures: z.array(z.object({
        image: z.string().endsWith('.png'),
        format: z.literal('RGBA8888'),
        size: z.object({
            w: z.number().int().positive(),
            h: z.number().int().positive(),
        }),
        scale: z.string(),
        frames: z.record(z.string(), frameDataSchema),
    })),
    meta: z.object({
        app: z.string(),
        version: z.string(),
        smartupdate: z.string().optional(),
    }),
});

// Type exports
export type FrameData = z.infer<typeof frameDataSchema>;
export type AtlasMeta = z.infer<typeof atlasMetaSchema>;
export type AtlasJson = z.infer<typeof atlasJsonSchema>;
export type MultipackAtlas = z.infer<typeof multipackAtlasSchema>;

/**
 * Frame key pattern for validation
 * Format: {move_id}/{zero_padded_index} e.g., "idle/0003"
 */
export const FRAME_KEY_PATTERN = /^[a-z_]+\/\d{4}$/;

/**
 * Validate a single frame key
 */
export function isValidFrameKey(key: string): boolean {
    return FRAME_KEY_PATTERN.test(key);
}

/**
 * Validate all frame keys in an atlas
 */
export function validateFrameKeys(keys: string[]): { valid: boolean; invalidKeys: string[] } {
    const invalidKeys = keys.filter(k => !isValidFrameKey(k));
    return {
        valid: invalidKeys.length === 0,
        invalidKeys,
    };
}
