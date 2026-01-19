/**
 * Commit Service - Finalize Director session and export approved frames
 * Per Story 7.9: Commit and Export Flow
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { Result } from './config-resolver.js';
import type { DirectorSessionManager } from './director-session-manager.js';
import type { DirectorFrameState, HumanAlignmentDelta } from '../domain/types/director-session.js';
import { logger } from '../utils/logger.js';

/**
 * Commit request parameters
 */
export interface CommitRequest {
  /** Run ID being committed */
  runId: string;
}

/**
 * Successful commit result
 */
export interface CommitResult {
  /** Total frames committed */
  approvedCount: number;
  /** Frames with alignment deltas applied */
  nudgedCount: number;
  /** Frames using patched versions */
  patchedCount: number;
  /** Timestamp of commit */
  timestamp: string;
}

/**
 * Commit error codes
 */
export type CommitErrorCode =
  | 'NO_ACTIVE_SESSION'
  | 'NO_FRAMES'
  | 'PATCH_FILE_MISSING'
  | 'IMAGE_PROCESSING_ERROR'
  | 'FILE_WRITE_ERROR'
  | 'SESSION_UPDATE_ERROR';

/**
 * Service for committing Director sessions
 */
export class CommitService {
  /**
   * Commit the current Director session
   *
   * AC #1: Apply all Human Alignment Deltas to pixel data
   * AC #2: Use patched frame versions where applicable
   * AC #3: Write final images to approved/ folder
   * AC #4: Mark session as committed
   */
  async commitSession(
    sessionManager: DirectorSessionManager
  ): Promise<Result<CommitResult, { code: CommitErrorCode; message: string }>> {
    const session = sessionManager.getSession();

    if (!session) {
      return Result.err({
        code: 'NO_ACTIVE_SESSION',
        message: 'No active Director session to commit',
      });
    }

    const frames = Object.values(session.frames);
    if (frames.length === 0) {
      return Result.err({
        code: 'NO_FRAMES',
        message: 'Session has no frames to commit',
      });
    }

    logger.info({
      event: 'commit_start',
      sessionId: session.sessionId,
      frameCount: frames.length,
    });

    const runPath = sessionManager.getRunPath();
    const approvedDir = path.join(runPath, 'approved');

    try {
      await fs.mkdir(approvedDir, { recursive: true });
    } catch (error) {
      return Result.err({
        code: 'FILE_WRITE_ERROR',
        message: `Failed to create approved directory: ${error}`,
      });
    }

    let approvedCount = 0;
    let nudgedCount = 0;
    let patchedCount = 0;

    // Process each frame
    for (const frame of frames) {
      const processResult = await this.processFrame(
        frame,
        approvedDir
      );

      if (!processResult.ok) {
        return processResult;
      }

      approvedCount++;
      if (processResult.value.wasNudged) nudgedCount++;
      if (processResult.value.wasPatched) patchedCount++;

      logger.info({
        event: 'frame_committed',
        frameIndex: frame.frameIndex,
        frameId: frame.id,
        nudged: processResult.value.wasNudged,
        patched: processResult.value.wasPatched,
      });
    }

    // Update session status (AC #4)
    const timestamp = new Date().toISOString();
    const updateResult = await sessionManager.markCommitted({
      approvedCount,
      nudgedCount,
      patchedCount,
      timestamp,
    });

    // markCommitted returns class-based Result from DirectorSessionManager
    if (updateResult.isErr()) {
      return Result.err({
        code: 'SESSION_UPDATE_ERROR',
        message: updateResult.unwrapErr().message,
      });
    }

    logger.info({
      event: 'commit_complete',
      sessionId: session.sessionId,
      approvedCount,
      nudgedCount,
      patchedCount,
    });

    return Result.ok({
      approvedCount,
      nudgedCount,
      patchedCount,
      timestamp,
    });
  }

  /**
   * Process a single frame for commit
   */
  private async processFrame(
    frame: DirectorFrameState,
    approvedDir: string
  ): Promise<Result<{ wasNudged: boolean; wasPatched: boolean }, { code: CommitErrorCode; message: string }>> {
    const outputPath = path.join(
      approvedDir,
      `frame_${String(frame.frameIndex).padStart(4, '0')}.png`
    );

    let imageBuffer: Buffer;
    let wasPatched = false;

    // Determine source image (AC #2)
    if (frame.directorOverrides?.isPatched) {
      const latestPatch = frame.directorOverrides.patchHistory?.at(-1);
      if (!latestPatch?.patchedPath) {
        return Result.err({
          code: 'PATCH_FILE_MISSING',
          message: `Frame ${frame.frameIndex} marked as patched but no patch history found`,
        });
      }

      try {
        const patchPath = latestPatch.patchedPath;
        imageBuffer = await fs.readFile(patchPath);
        wasPatched = true;
      } catch {
        return Result.err({
          code: 'PATCH_FILE_MISSING',
          message: `Patched file not found for frame ${frame.frameIndex}`,
        });
      }
    } else if (frame.imageBase64) {
      imageBuffer = Buffer.from(frame.imageBase64, 'base64');
    } else if (frame.imagePath) {
      try {
        imageBuffer = await fs.readFile(frame.imagePath);
      } catch {
        return Result.err({
          code: 'IMAGE_PROCESSING_ERROR',
          message: `Failed to read image for frame ${frame.frameIndex}`,
        });
      }
    } else {
      return Result.err({
        code: 'IMAGE_PROCESSING_ERROR',
        message: `No image data for frame ${frame.frameIndex}`,
      });
    }

    // Apply alignment delta if present (AC #1)
    let wasNudged = false;
    if (frame.directorOverrides?.alignment) {
      try {
        imageBuffer = await this.applyAlignmentDelta(
          imageBuffer,
          frame.directorOverrides.alignment
        );
        wasNudged = true;
      } catch (error) {
        return Result.err({
          code: 'IMAGE_PROCESSING_ERROR',
          message: `Failed to apply alignment delta to frame ${frame.frameIndex}: ${error}`,
        });
      }
    }

    // Write to approved folder (AC #3)
    try {
      await fs.writeFile(outputPath, imageBuffer);
    } catch (error) {
      return Result.err({
        code: 'FILE_WRITE_ERROR',
        message: `Failed to write frame ${frame.frameIndex}: ${error}`,
      });
    }

    return Result.ok({ wasNudged, wasPatched });
  }

  /**
   * Apply alignment delta to an image buffer
   */
  private async applyAlignmentDelta(
    imageBuffer: Buffer,
    delta: HumanAlignmentDelta
  ): Promise<Buffer> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error('Cannot read image dimensions');
    }

    const offsetX = delta.userOverrideX;
    const offsetY = delta.userOverrideY;

    // If no offset, return original
    if (offsetX === 0 && offsetY === 0) {
      return imageBuffer;
    }

    // Create transparent canvas and composite with offset
    const result = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: imageBuffer,
          left: Math.round(offsetX),
          top: Math.round(offsetY),
          blend: 'over',
        },
      ])
      .png()
      .toBuffer();

    return result;
  }
}

// Singleton instance
let defaultService: CommitService | null = null;

/**
 * Get the default CommitService instance
 */
export function getCommitService(): CommitService {
  if (!defaultService) {
    defaultService = new CommitService();
  }
  return defaultService;
}
