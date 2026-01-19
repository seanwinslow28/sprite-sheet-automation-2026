/**
 * Patch Service - Manages the patching workflow for corrective inpainting
 * Per Story 7.6: Patch API with history preservation and error handling
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { GeminiInpaintAdapter, getGeminiInpaintAdapter } from '../adapters/gemini-inpaint-adapter.js';
import { DirectorSessionManager } from './director-session-manager.js';
import type { PatchHistoryEntry, DirectorOverrides } from '../domain/types/director-session.js';
import { logger } from '../utils/logger.js';
import { Result } from './config-resolver.js';

/**
 * Request structure for patching a frame
 */
export interface PatchRequest {
  /** Frame ID (e.g., "frame_0001") */
  frameId: string;
  /** Frame index (0-based) */
  frameIndex: number;
  /** Binary mask as base64 PNG */
  maskBase64: string;
  /** User's correction prompt */
  prompt: string;
}

/**
 * Response from a patch operation
 */
export interface PatchResponse {
  /** Whether the patch succeeded */
  success: boolean;
  /** Patched image as base64 (if successful) */
  patchedImageBase64?: string;
  /** Error message (if failed) */
  error?: string;
  /** Path to saved patched image (if successful) */
  patchedPath?: string;
}

/**
 * Error codes for patch operations
 */
export type PatchErrorCode =
  | 'FRAME_NOT_FOUND'
  | 'MISSING_IMAGE_DATA'
  | 'INPAINT_FAILED'
  | 'SAVE_FAILED'
  | 'SESSION_UPDATE_FAILED'
  | 'INVALID_REQUEST';

/**
 * Service for managing frame patching operations
 */
export class PatchService {
  private adapter: GeminiInpaintAdapter;

  constructor(adapter?: GeminiInpaintAdapter) {
    this.adapter = adapter ?? getGeminiInpaintAdapter();
  }

  /**
   * Patch a frame region using AI inpainting
   *
   * @param request - The patch request
   * @param sessionManager - The active director session manager
   * @returns Result with patched image or error
   */
  async patchFrame(
    request: PatchRequest,
    sessionManager: DirectorSessionManager
  ): Promise<Result<PatchResponse, { code: PatchErrorCode; message: string }>> {
    const { frameId, frameIndex, maskBase64, prompt } = request;

    // Validate request first (before logging that accesses prompt)
    if (!frameId || frameIndex === undefined || !maskBase64 || !prompt) {
      return Result.err({
        code: 'INVALID_REQUEST',
        message: 'Missing required fields: frameId, frameIndex, maskBase64, prompt',
      });
    }

    logger.info({
      event: 'patch_start',
      frameId,
      frameIndex,
      promptLength: prompt.length,
    });

    // Get current session
    const session = sessionManager.getSession();
    if (!session) {
      return Result.err({
        code: 'FRAME_NOT_FOUND',
        message: 'No active director session',
      });
    }

    // Get frame state
    const frame = session.frames[String(frameIndex)];
    if (!frame) {
      return Result.err({
        code: 'FRAME_NOT_FOUND',
        message: `Frame not found: ${frameId} (index ${frameIndex})`,
      });
    }

    // Check for image data
    if (!frame.imageBase64) {
      return Result.err({
        code: 'MISSING_IMAGE_DATA',
        message: `Frame ${frameId} has no image data loaded`,
      });
    }

    // Call Gemini inpaint
    const inpaintResult = await this.adapter.inpaint({
      originalImage: frame.imageBase64,
      mask: maskBase64,
      prompt,
    });

    if (!inpaintResult.success || !inpaintResult.imageBase64) {
      logger.warn({
        event: 'patch_inpaint_failed',
        frameId,
        error: inpaintResult.error,
      });
      return Result.err({
        code: 'INPAINT_FAILED',
        message: inpaintResult.error ?? 'Inpainting failed',
      });
    }

    // Save patched image to disk
    const saveResult = await this.savePatchedImage(
      sessionManager.getRunPath(),
      frameId,
      inpaintResult.imageBase64
    );

    if (!saveResult.ok) {
      return Result.err({
        code: 'SAVE_FAILED',
        message: saveResult.error,
      });
    }

    // Save mask to disk
    const maskSaveResult = await this.saveMask(
      sessionManager.getRunPath(),
      frameId,
      maskBase64
    );

    if (!maskSaveResult.ok) {
      return Result.err({
        code: 'SAVE_FAILED',
        message: maskSaveResult.error,
      });
    }

    // Create patch history entry
    const historyEntry: PatchHistoryEntry = {
      originalPath: frame.imagePath,
      patchedPath: saveResult.value,
      maskPath: maskSaveResult.value,
      prompt,
      timestamp: new Date().toISOString(),
    };

    // Update session state with patch
    const updateResult = await this.updateSessionWithPatch(
      sessionManager,
      frameIndex,
      inpaintResult.imageBase64,
      saveResult.value,
      historyEntry
    );

    if (!updateResult.ok) {
      return Result.err({
        code: 'SESSION_UPDATE_FAILED',
        message: updateResult.error,
      });
    }

    logger.info({
      event: 'patch_success',
      frameId,
      patchedPath: saveResult.value,
    });

    return Result.ok({
      success: true,
      patchedImageBase64: inpaintResult.imageBase64,
      patchedPath: saveResult.value,
    });
  }

  /**
   * Save a patched image to the candidates folder
   */
  private async savePatchedImage(
    runPath: string,
    frameId: string,
    imageBase64: string
  ): Promise<Result<string, string>> {
    try {
      const candidatesDir = path.join(runPath, 'candidates');
      await fs.mkdir(candidatesDir, { recursive: true });

      const timestamp = Date.now();
      const filename = `${frameId}_patched_${timestamp}.png`;
      const filepath = path.join(candidatesDir, filename);

      const buffer = Buffer.from(imageBase64, 'base64');
      await fs.writeFile(filepath, buffer);

      return Result.ok(filepath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save patched image';
      return Result.err(message);
    }
  }

  /**
   * Save a mask image to the audit folder
   */
  private async saveMask(
    runPath: string,
    frameId: string,
    maskBase64: string
  ): Promise<Result<string, string>> {
    try {
      const auditDir = path.join(runPath, 'audit');
      await fs.mkdir(auditDir, { recursive: true });

      const timestamp = Date.now();
      const filename = `${frameId}_mask_${timestamp}.png`;
      const filepath = path.join(auditDir, filename);

      const buffer = Buffer.from(maskBase64, 'base64');
      await fs.writeFile(filepath, buffer);

      return Result.ok(filepath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save mask';
      return Result.err(message);
    }
  }

  /**
   * Update session state after successful patch
   */
  private async updateSessionWithPatch(
    sessionManager: DirectorSessionManager,
    frameIndex: number,
    patchedImageBase64: string,
    patchedPath: string,
    historyEntry: PatchHistoryEntry
  ): Promise<Result<void, string>> {
    try {
      const session = sessionManager.getSession();
      if (!session) {
        return Result.err('No active session');
      }

      const frame = session.frames[String(frameIndex)];
      if (!frame) {
        return Result.err(`Frame ${frameIndex} not found`);
      }

      // Update frame with patched data
      const newOverrides: DirectorOverrides = {
        ...frame.directorOverrides,
        isPatched: true,
        patchHistory: [...frame.directorOverrides.patchHistory, historyEntry],
      };

      // Update frame image path and base64 in session state first
      session.frames[String(frameIndex)] = {
        ...frame,
        imagePath: patchedPath,
        imageBase64: patchedImageBase64,
        directorOverrides: newOverrides,
        status: 'APPROVED', // Mark as approved after patch
      };

      // Update frame overrides (this also persists the session)
      // updateFrameOverrides returns class-based Result from DirectorSessionManager
      const overrideResult = await sessionManager.updateFrameOverrides(frameIndex, newOverrides);
      if (overrideResult.isErr()) {
        return Result.err(overrideResult.unwrapErr().message);
      }

      return Result.ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update session';
      return Result.err(message);
    }
  }
}

// Singleton instance
let defaultService: PatchService | null = null;

/**
 * Get the default Patch Service instance
 */
export function getPatchService(): PatchService {
  if (!defaultService) {
    defaultService = new PatchService();
  }
  return defaultService;
}
