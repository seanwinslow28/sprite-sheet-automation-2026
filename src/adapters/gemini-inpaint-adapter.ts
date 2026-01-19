/**
 * Gemini Inpaint Adapter - AI-based image inpainting via Gemini API
 * Per Story 7.6: Patch API for corrective inpainting
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Result } from '../core/config-resolver.js';
import { logger } from '../utils/logger.js';

/**
 * Request structure for inpainting
 */
export interface InpaintRequest {
  /** Original image as base64 PNG */
  originalImage: string;
  /** Binary mask as base64 PNG (white = inpaint region) */
  mask: string;
  /** User-provided correction prompt */
  prompt: string;
}

/**
 * Result from inpainting operation
 */
export interface InpaintResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Patched image as base64 PNG (if successful) */
  imageBase64?: string;
  /** Error message (if failed) */
  error?: string;
}

/**
 * System error codes for inpainting
 */
export type InpaintErrorCode =
  | 'GEMINI_API_ERROR'
  | 'GEMINI_NO_IMAGE'
  | 'GEMINI_INVALID_RESPONSE'
  | 'CONFIG_MISSING_API_KEY';

/**
 * Format the inpainting prompt with standard instructions
 * Per AC #2: Prompt structured with task, style, and user detail
 */
export function formatInpaintPrompt(userPrompt: string): string {
  return `TASK: Inpaint the masked area. Integrate seamlessly with existing pixel art style.
STYLE: Maintain exact color palette, pixel density, and shading style of surrounding pixels.
DO NOT: Introduce new colors, change art style, or affect areas outside the mask.
DETAIL: ${userPrompt}`;
}

/**
 * Adapter for Gemini's image editing/inpainting capabilities
 */
export class GeminiInpaintAdapter {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private initialized = false;

  /**
   * Initialize the adapter with API key
   * Deferred initialization allows testing without API key
   */
  initialize(): Result<void, { code: InpaintErrorCode; message: string }> {
    if (this.initialized) {
      return Result.ok(undefined);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Result.err({
        code: 'CONFIG_MISSING_API_KEY',
        message: 'GEMINI_API_KEY environment variable not configured',
      });
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-exp',
      });
      this.initialized = true;
      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown initialization error';
      return Result.err({
        code: 'GEMINI_API_ERROR',
        message,
      });
    }
  }

  /**
   * Check if adapter is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Perform inpainting on an image
   *
   * @param request - The inpainting request with image, mask, and prompt
   * @returns Result containing the patched image or error
   */
  async inpaint(request: InpaintRequest): Promise<InpaintResult> {
    // Initialize on first use if not already done
    if (!this.initialized) {
      const initResult = this.initialize();
      if (!initResult.ok) {
        return {
          success: false,
          error: initResult.error.message,
        };
      }
    }

    if (!this.model) {
      return {
        success: false,
        error: 'Model not initialized',
      };
    }

    const formattedPrompt = formatInpaintPrompt(request.prompt);

    logger.info({
      event: 'gemini_inpaint_start',
      promptLength: request.prompt.length,
      maskSize: request.mask.length,
    });

    try {
      // Construct the edit request with image, mask, and prompt
      // Using Gemini's multimodal input with two images (original + mask) and text
      const result = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              // Original image
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: request.originalImage,
                },
              },
              // Mask image (white = region to inpaint)
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: request.mask,
                },
              },
              // Prompt text
              {
                text: formattedPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 1.0, // Deep Think Lock - values < 1.0 cause mode collapse
          topP: 0.95,
          topK: 40,
        },
      });

      // Extract image from response
      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate?.content?.parts) {
        logger.warn({
          event: 'gemini_inpaint_no_parts',
          hasCandidate: !!candidate,
        });
        return {
          success: false,
          error: 'No content parts in response',
        };
      }

      // Find image part in response
      const imagePart = candidate.content.parts.find(
        (p: { inlineData?: { mimeType?: string; data?: string } }) =>
          p.inlineData?.mimeType?.startsWith('image/')
      );

      if (!imagePart?.inlineData?.data) {
        logger.warn({
          event: 'gemini_inpaint_no_image',
          partsCount: candidate.content.parts.length,
        });
        return {
          success: false,
          error: 'No image data in response',
        };
      }

      logger.info({
        event: 'gemini_inpaint_success',
        imageSize: imagePart.inlineData.data.length,
      });

      return {
        success: true,
        imageBase64: imagePart.inlineData.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown API error';
      logger.error({
        event: 'gemini_inpaint_error',
        error: message,
      });
      return {
        success: false,
        error: message,
      };
    }
  }
}

// Singleton instance for convenience
let defaultAdapter: GeminiInpaintAdapter | null = null;

/**
 * Get the default Gemini Inpaint adapter instance
 */
export function getGeminiInpaintAdapter(): GeminiInpaintAdapter {
  if (!defaultAdapter) {
    defaultAdapter = new GeminiInpaintAdapter();
  }
  return defaultAdapter;
}
