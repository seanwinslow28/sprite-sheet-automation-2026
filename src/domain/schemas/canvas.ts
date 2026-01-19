/**
 * Canvas configuration schema for resolution and alignment settings
 * Deep Think Lock: 512→128 nearest-neighbor, contact patch alignment
 */

import { z } from 'zod';

// Alignment configuration schema
export const alignmentSchema = z.object({
    method: z.enum(['contact_patch', 'center', 'none'])
        .default('contact_patch')
        .describe('Alignment method: contact_patch (feet), center (bounding box), or none'),
    vertical_lock: z.boolean()
        .default(true)
        .describe('Snap to anchor baseline Y position'),
    root_zone_ratio: z.number()
        .min(0.05)
        .max(0.50)
        .default(0.15)
        .describe('Bottom percentage of visible height for root detection (0.15 = 15%)'),
    max_shift_x: z.number()
        .int()
        .positive()
        .default(32)
        .describe('Safety valve: max horizontal shift in pixels'),
});

// Canvas configuration schema
export const canvasSchema = z.object({
    generation_size: z.literal(512)
        .describe('AI generates at this resolution (locked to 512 for MVP)'),
    target_size: z.union([z.literal(128), z.literal(256)])
        .default(128)
        .describe('Final output resolution (128 for champions, 256 for bosses)'),
    downsample_method: z.literal('nearest')
        .describe('Downsampling interpolation (locked to nearest for pixel art)'),
    alignment: alignmentSchema
        .default({
            method: 'contact_patch',
            vertical_lock: true,
            root_zone_ratio: 0.15,
            max_shift_x: 32,
        })
        .describe('Sprite alignment configuration'),
});

// Inferred TypeScript types
export type Alignment = z.infer<typeof alignmentSchema>;
export type Canvas = z.infer<typeof canvasSchema>;
