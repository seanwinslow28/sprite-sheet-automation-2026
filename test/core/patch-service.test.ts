/**
 * Tests for Patch Service (Story 7.6)
 * AC #3-6: Response handling, override tracking, history preservation, error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';

// Mock the Google Generative AI module BEFORE importing modules that use it
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn(),
    }),
  })),
}));

import { PatchService, type PatchRequest } from '../../src/core/patch-service.js';
import { GeminiInpaintAdapter } from '../../src/adapters/gemini-inpaint-adapter.js';
import { DirectorSessionManager } from '../../src/core/director-session-manager.js';
import { Result } from '../../src/core/result.js';
import type { DirectorSession, DirectorFrameState } from '../../src/domain/types/director-session.js';

// Mock native fs/promises
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PatchService (Story 7.6)', () => {
  let mockAdapter: {
    inpaint: ReturnType<typeof vi.fn>;
    initialize: ReturnType<typeof vi.fn>;
    isInitialized: ReturnType<typeof vi.fn>;
  };
  let mockSessionManager: {
    getSession: ReturnType<typeof vi.fn>;
    getRunPath: ReturnType<typeof vi.fn>;
    updateFrameOverrides: ReturnType<typeof vi.fn>;
    saveSession: ReturnType<typeof vi.fn>;
  };
  let service: PatchService;

  const createMockFrame = (index: number): DirectorFrameState => ({
    id: `frame_${String(index).padStart(4, '0')}`,
    frameIndex: index,
    status: 'AUDIT_WARN',
    imagePath: `/runs/test/frame_${String(index).padStart(4, '0')}.png`,
    imageBase64: 'original_image_base64',
    auditReport: {
      compositeScore: 0.7,
      flags: [],
      passed: false,
    },
    directorOverrides: {
      isPatched: false,
      patchHistory: [],
    },
    attemptHistory: [],
  });

  const createMockSession = (): DirectorSession => ({
    sessionId: 'test-session-id',
    runId: 'test-run-id',
    moveId: 'idle_standard',
    anchorFrameId: 'frame_0000',
    frames: {
      '0': createMockFrame(0),
      '1': createMockFrame(1),
    },
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    status: 'active',
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock adapter
    mockAdapter = {
      inpaint: vi.fn(),
      initialize: vi.fn().mockReturnValue({ ok: true }),
      isInitialized: vi.fn().mockReturnValue(true),
    };

    // Create mock session manager
    const mockSession = createMockSession();
    mockSessionManager = {
      getSession: vi.fn().mockReturnValue(mockSession),
      getRunPath: vi.fn().mockReturnValue('/runs/test'),
      // updateFrameOverrides returns class-based Result (from result.ts)
      updateFrameOverrides: vi.fn().mockResolvedValue(Result.ok(undefined)),
      saveSession: vi.fn().mockResolvedValue(undefined),
    };

    service = new PatchService(mockAdapter as unknown as GeminiInpaintAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Input Validation', () => {
    it('should reject request with missing frameId', async () => {
      const request: Partial<PatchRequest> = {
        frameIndex: 1,
        maskBase64: 'mask',
        prompt: 'Fix it',
      };

      const result = await service.patchFrame(
        request as PatchRequest,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_REQUEST');
      }
    });

    it('should reject request with missing maskBase64', async () => {
      const request: Partial<PatchRequest> = {
        frameId: 'frame_0001',
        frameIndex: 1,
        prompt: 'Fix it',
      };

      const result = await service.patchFrame(
        request as PatchRequest,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_REQUEST');
      }
    });

    it('should reject request with missing prompt', async () => {
      const request: Partial<PatchRequest> = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask',
      };

      const result = await service.patchFrame(
        request as PatchRequest,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_REQUEST');
      }
    });
  });

  describe('Session Validation', () => {
    it('should fail when no active session', async () => {
      mockSessionManager.getSession.mockReturnValue(null);

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask',
        prompt: 'Fix it',
      };

      const result = await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FRAME_NOT_FOUND');
      }
    });

    it('should fail when frame not found in session', async () => {
      const request: PatchRequest = {
        frameId: 'frame_0099',
        frameIndex: 99, // Does not exist
        maskBase64: 'mask',
        prompt: 'Fix it',
      };

      const result = await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FRAME_NOT_FOUND');
      }
    });

    it('should fail when frame has no image data', async () => {
      const sessionWithNoImage = createMockSession();
      sessionWithNoImage.frames['1'].imageBase64 = undefined;
      mockSessionManager.getSession.mockReturnValue(sessionWithNoImage);

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask',
        prompt: 'Fix it',
      };

      const result = await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_IMAGE_DATA');
      }
    });
  });

  describe('Inpainting Flow (AC #3)', () => {
    it('should call adapter inpaint with correct parameters', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64_data',
        prompt: 'Fix the hand',
      };

      await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(mockAdapter.inpaint).toHaveBeenCalledWith({
        originalImage: 'original_image_base64',
        mask: 'mask_base64_data',
        prompt: 'Fix the hand',
      });
    });

    it('should return patched image on success', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      const result = await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.success).toBe(true);
        expect(result.value.patchedImageBase64).toBe('patched_image_base64');
      }
    });
  });

  describe('Error Handling (AC #6)', () => {
    it('should return error when inpainting fails', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: false,
        error: 'API rate limit exceeded',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      const result = await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INPAINT_FAILED');
        expect(result.error.message).toContain('rate limit');
      }
    });

    it('should not modify session on inpaint failure', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(mockSessionManager.updateFrameOverrides).not.toHaveBeenCalled();
      expect(mockSessionManager.saveSession).not.toHaveBeenCalled();
    });
  });

  describe('History Preservation (AC #5)', () => {
    it('should create patch history entry on success', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      const result = await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(true);
      expect(mockSessionManager.updateFrameOverrides).toHaveBeenCalled();

      // Verify the overrides include patch history
      const updateCall = mockSessionManager.updateFrameOverrides.mock.calls[0];
      expect(updateCall[0]).toBe(1); // frameIndex
      const overrides = updateCall[1];
      expect(overrides.isPatched).toBe(true);
      expect(overrides.patchHistory).toHaveLength(1);
      expect(overrides.patchHistory[0]).toEqual(
        expect.objectContaining({
          prompt: 'Fix the hand',
          originalPath: expect.any(String),
          patchedPath: expect.any(String),
          maskPath: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });

    it('should preserve original image path in history', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      const updateCall = mockSessionManager.updateFrameOverrides.mock.calls[0];
      const overrides = updateCall[1];
      expect(overrides.patchHistory[0].originalPath).toBe('/runs/test/frame_0001.png');
    });

    it('should accumulate history with multiple patches', async () => {
      // Set up frame with existing patch history
      const sessionWithHistory = createMockSession();
      sessionWithHistory.frames['1'].directorOverrides.patchHistory = [
        {
          originalPath: '/runs/test/original.png',
          patchedPath: '/runs/test/patch1.png',
          maskPath: '/runs/test/mask1.png',
          prompt: 'First patch',
          timestamp: '2026-01-01T00:00:00.000Z',
        },
      ];
      mockSessionManager.getSession.mockReturnValue(sessionWithHistory);

      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Second patch',
      };

      await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      const updateCall = mockSessionManager.updateFrameOverrides.mock.calls[0];
      const overrides = updateCall[1];
      expect(overrides.patchHistory).toHaveLength(2);
      expect(overrides.patchHistory[0].prompt).toBe('First patch');
      expect(overrides.patchHistory[1].prompt).toBe('Second patch');
    });
  });

  describe('Override Tracking (AC #4)', () => {
    it('should set isPatched to true on success', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      const updateCall = mockSessionManager.updateFrameOverrides.mock.calls[0];
      const overrides = updateCall[1];
      expect(overrides.isPatched).toBe(true);
    });

    it('should persist session immediately after patch', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      // updateFrameOverrides internally persists the session
      expect(mockSessionManager.updateFrameOverrides).toHaveBeenCalled();
    });
  });

  describe('File Storage', () => {
    it('should save patched image to candidates folder', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('candidates'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('patched'),
        expect.any(Buffer)
      );
    });

    it('should save mask to audit folder', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('audit'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('mask'),
        expect.any(Buffer)
      );
    });

    it('should include timestamp in patched filename', async () => {
      mockAdapter.inpaint.mockResolvedValue({
        success: true,
        imageBase64: 'patched_image_base64',
      });

      const request: PatchRequest = {
        frameId: 'frame_0001',
        frameIndex: 1,
        maskBase64: 'mask_base64',
        prompt: 'Fix the hand',
      };

      const result = await service.patchFrame(
        request,
        mockSessionManager as unknown as DirectorSessionManager
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.patchedPath).toMatch(/patched_\d+\.png$/);
      }
    });
  });
});
