/**
 * Tests for Commit Service (Story 7.9)
 * AC #1-4: Delta application, patched frames, approved folder, session marking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'path';
import { tmpdir } from 'os';

import { CommitService, getCommitService } from '../../src/core/commit-service.js';
import { DirectorSessionManager } from '../../src/core/director-session-manager.js';
import { Result } from '../../src/core/result.js';
import type { DirectorSession, DirectorFrameState } from '../../src/domain/types/director-session.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('CommitService (Story 7.9)', () => {
  let testDir: string;
  let approvedDir: string;
  let candidatesDir: string;

  // Create a test PNG buffer (1x1 transparent pixel)
  const createTestPng = (): Buffer => {
    // Minimal valid PNG (1x1 transparent)
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
  };

  const createMockFrame = (index: number, options: Partial<DirectorFrameState> = {}): DirectorFrameState => ({
    id: `frame_${String(index).padStart(4, '0')}`,
    frameIndex: index,
    status: 'APPROVED',
    imagePath: path.join(candidatesDir, `frame_${String(index).padStart(4, '0')}.png`),
    imageBase64: createTestPng().toString('base64'),
    auditReport: {
      compositeScore: 0.9,
      flags: [],
      passed: true,
    },
    directorOverrides: {
      isPatched: false,
      patchHistory: [],
    },
    attemptHistory: [],
    ...options,
  });

  const createMockSession = (frameCount: number): DirectorSession => {
    const frames: Record<string, DirectorFrameState> = {};
    for (let i = 0; i < frameCount; i++) {
      frames[String(i)] = createMockFrame(i);
    }
    return {
      sessionId: 'test-session-id',
      runId: 'test-run-id',
      moveId: 'idle_standard',
      anchorFrameId: 'frame_0000',
      frames,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      status: 'active',
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create temp directories
    testDir = path.join(tmpdir(), `commit-test-${Date.now()}`);
    approvedDir = path.join(testDir, 'approved');
    candidatesDir = path.join(testDir, 'candidates');

    mkdirSync(testDir, { recursive: true });
    mkdirSync(candidatesDir, { recursive: true });

    // Write test PNG files for frames
    for (let i = 0; i < 4; i++) {
      const framePath = path.join(candidatesDir, `frame_${String(i).padStart(4, '0')}.png`);
      writeFileSync(framePath, createTestPng());
    }
  });

  afterEach(async () => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Commit Validation', () => {
    it('should fail when no active session', async () => {
      const service = new CommitService();
      const mockManager = {
        getSession: vi.fn().mockReturnValue(null),
        getRunPath: vi.fn().mockReturnValue(testDir),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NO_ACTIVE_SESSION');
      }
    });

    it('should fail when session has no frames', async () => {
      const service = new CommitService();
      const session = createMockSession(0);
      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NO_FRAMES');
      }
    });
  });

  describe('Basic Commit Flow (AC #3)', () => {
    it('should write frames to approved folder', async () => {
      const service = new CommitService();
      const session = createMockSession(4);
      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(true);

      // Check approved folder exists with frames
      const approvedFiles = readdirSync(approvedDir);
      expect(approvedFiles).toHaveLength(4);
      expect(approvedFiles).toContain('frame_0000.png');
      expect(approvedFiles).toContain('frame_0001.png');
      expect(approvedFiles).toContain('frame_0002.png');
      expect(approvedFiles).toContain('frame_0003.png');
    });

    it('should use 4-digit padding for frame names', async () => {
      const service = new CommitService();
      const session = createMockSession(2);
      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      await service.commitSession(mockManager);

      const approvedFiles = readdirSync(approvedDir);
      expect(approvedFiles).toContain('frame_0000.png');
      expect(approvedFiles).toContain('frame_0001.png');
    });

    it('should return correct frame counts', async () => {
      const service = new CommitService();
      const session = createMockSession(4);
      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.approvedCount).toBe(4);
        expect(result.value.nudgedCount).toBe(0);
        expect(result.value.patchedCount).toBe(0);
      }
    });
  });

  describe('Alignment Delta Application (AC #1)', () => {
    it('should apply alignment delta to frame', async () => {
      const service = new CommitService();
      const session = createMockSession(1);

      // Add alignment delta to frame
      session.frames['0'].directorOverrides.alignment = {
        frameId: 'frame_0000',
        userOverrideX: 5,
        userOverrideY: -3,
        timestamp: new Date().toISOString(),
      };

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.nudgedCount).toBe(1);
      }

      // Verify file was written
      const outputPath = path.join(approvedDir, 'frame_0000.png');
      expect(existsSync(outputPath)).toBe(true);
    });

    it('should count nudged frames correctly', async () => {
      const service = new CommitService();
      const session = createMockSession(4);

      // Add alignment deltas to frames 1 and 3
      session.frames['1'].directorOverrides.alignment = {
        frameId: 'frame_0001',
        userOverrideX: 2,
        userOverrideY: 0,
        timestamp: new Date().toISOString(),
      };
      session.frames['3'].directorOverrides.alignment = {
        frameId: 'frame_0003',
        userOverrideX: -1,
        userOverrideY: 3,
        timestamp: new Date().toISOString(),
      };

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.nudgedCount).toBe(2);
      }
    });
  });

  describe('Patched Frame Handling (AC #2)', () => {
    it('should use patched frame version', async () => {
      const service = new CommitService();
      const session = createMockSession(2);

      // Create a patched file
      const patchDir = path.join(testDir, 'candidates');
      const patchedPath = path.join(patchDir, 'frame_0001_patched.png');
      writeFileSync(patchedPath, createTestPng());

      // Mark frame 1 as patched
      session.frames['1'].directorOverrides.isPatched = true;
      session.frames['1'].directorOverrides.patchHistory = [
        {
          originalPath: path.join(candidatesDir, 'frame_0001.png'),
          patchedPath: patchedPath,
          maskPath: path.join(testDir, 'mask.png'),
          prompt: 'Fix the hand',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.patchedCount).toBe(1);
      }
    });

    it('should fail if patched file is missing', async () => {
      const service = new CommitService();
      const session = createMockSession(1);

      // Mark frame as patched but with non-existent file
      session.frames['0'].directorOverrides.isPatched = true;
      session.frames['0'].directorOverrides.patchHistory = [
        {
          originalPath: path.join(candidatesDir, 'frame_0000.png'),
          patchedPath: '/nonexistent/patched.png',
          maskPath: path.join(testDir, 'mask.png'),
          prompt: 'Fix it',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PATCH_FILE_MISSING');
      }
    });

    it('should fail if isPatched but no patchHistory', async () => {
      const service = new CommitService();
      const session = createMockSession(1);

      session.frames['0'].directorOverrides.isPatched = true;
      session.frames['0'].directorOverrides.patchHistory = [];

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PATCH_FILE_MISSING');
      }
    });
  });

  describe('Session Marking (AC #4)', () => {
    it('should call markCommitted on session manager', async () => {
      const service = new CommitService();
      const session = createMockSession(2);
      const mockMarkCommitted = vi.fn().mockResolvedValue(Result.ok(undefined));

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: mockMarkCommitted,
      } as unknown as DirectorSessionManager;

      await service.commitSession(mockManager);

      expect(mockMarkCommitted).toHaveBeenCalledOnce();
      expect(mockMarkCommitted).toHaveBeenCalledWith(
        expect.objectContaining({
          approvedCount: 2,
          nudgedCount: 0,
          patchedCount: 0,
          timestamp: expect.any(String),
        })
      );
    });

    it('should include timestamp in commit info', async () => {
      const service = new CommitService();
      const session = createMockSession(1);
      const mockMarkCommitted = vi.fn().mockResolvedValue(Result.ok(undefined));

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: mockMarkCommitted,
      } as unknown as DirectorSessionManager;

      const beforeCommit = new Date().toISOString();
      const result = await service.commitSession(mockManager);
      const afterCommit = new Date().toISOString();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.timestamp >= beforeCommit).toBe(true);
        expect(result.value.timestamp <= afterCommit).toBe(true);
      }
    });

    it('should return error if markCommitted fails', async () => {
      const service = new CommitService();
      const session = createMockSession(1);

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(
          Result.err({ code: 'SESSION_SAVE_FAILED', message: 'Disk full' })
        ),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_UPDATE_ERROR');
      }
    });
  });

  describe('Combined Operations', () => {
    it('should handle both nudged and patched frames', async () => {
      const service = new CommitService();
      const session = createMockSession(4);

      // Frame 1: nudged
      session.frames['1'].directorOverrides.alignment = {
        frameId: 'frame_0001',
        userOverrideX: 3,
        userOverrideY: 0,
        timestamp: new Date().toISOString(),
      };

      // Frame 2: patched
      const patchedPath = path.join(candidatesDir, 'frame_0002_patched.png');
      writeFileSync(patchedPath, createTestPng());
      session.frames['2'].directorOverrides.isPatched = true;
      session.frames['2'].directorOverrides.patchHistory = [
        {
          originalPath: path.join(candidatesDir, 'frame_0002.png'),
          patchedPath: patchedPath,
          maskPath: path.join(testDir, 'mask.png'),
          prompt: 'Fix it',
          timestamp: new Date().toISOString(),
        },
      ];

      // Frame 3: both nudged and patched
      const patchedPath3 = path.join(candidatesDir, 'frame_0003_patched.png');
      writeFileSync(patchedPath3, createTestPng());
      session.frames['3'].directorOverrides.alignment = {
        frameId: 'frame_0003',
        userOverrideX: -2,
        userOverrideY: 1,
        timestamp: new Date().toISOString(),
      };
      session.frames['3'].directorOverrides.isPatched = true;
      session.frames['3'].directorOverrides.patchHistory = [
        {
          originalPath: path.join(candidatesDir, 'frame_0003.png'),
          patchedPath: patchedPath3,
          maskPath: path.join(testDir, 'mask3.png'),
          prompt: 'Fix it too',
          timestamp: new Date().toISOString(),
        },
      ];

      const mockManager = {
        getSession: vi.fn().mockReturnValue(session),
        getRunPath: vi.fn().mockReturnValue(testDir),
        markCommitted: vi.fn().mockResolvedValue(Result.ok(undefined)),
      } as unknown as DirectorSessionManager;

      const result = await service.commitSession(mockManager);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.approvedCount).toBe(4);
        expect(result.value.nudgedCount).toBe(2); // Frames 1 and 3
        expect(result.value.patchedCount).toBe(2); // Frames 2 and 3
      }
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getCommitService();
      const instance2 = getCommitService();
      expect(instance1).toBe(instance2);
    });
  });
});
