/**
 * Tests for Gemini Inpaint Adapter (Story 7.6)
 * AC #1-2: API payload and prompt format
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock generateContent function - will be accessed via the module mock
let mockGenerateContent: ReturnType<typeof vi.fn>;

// Mock the Google Generative AI module - must define class inline for hoisting
vi.mock('@google/generative-ai', () => {
  // Create mock inside factory - this gets hoisted
  const mockFn = vi.fn();
  // Expose it globally so tests can access it
  (globalThis as any).__mockGenerateContent = mockFn;

  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return {
          generateContent: (globalThis as any).__mockGenerateContent,
        };
      }
    },
  };
});

import {
  GeminiInpaintAdapter,
  formatInpaintPrompt,
  type InpaintRequest,
} from '../../src/adapters/gemini-inpaint-adapter.js';

describe('GeminiInpaintAdapter (Story 7.6)', () => {
  const mockEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...mockEnv, GEMINI_API_KEY: 'test-api-key' };
    // Get mock from globalThis and reset it
    mockGenerateContent = (globalThis as any).__mockGenerateContent;
    mockGenerateContent.mockReset();
  });

  afterEach(() => {
    process.env = mockEnv;
  });

  describe('formatInpaintPrompt (AC #2)', () => {
    it('should format prompt with task instruction', () => {
      const result = formatInpaintPrompt('Fix the hand');
      expect(result).toContain('TASK: Inpaint the masked area');
    });

    it('should include style consistency reminder', () => {
      const result = formatInpaintPrompt('Fix the hand');
      expect(result).toContain('pixel art style');
    });

    it('should include color palette instruction', () => {
      const result = formatInpaintPrompt('Fix the hand');
      expect(result).toContain('color palette');
    });

    it('should include DO NOT instructions', () => {
      const result = formatInpaintPrompt('Fix the hand');
      expect(result).toContain('DO NOT');
      expect(result).toContain('areas outside the mask');
    });

    it('should append user prompt under DETAIL', () => {
      const userPrompt = 'Clenched fist with darker skin';
      const result = formatInpaintPrompt(userPrompt);
      expect(result).toContain(`DETAIL: ${userPrompt}`);
    });

    it('should work with empty user prompt', () => {
      const result = formatInpaintPrompt('');
      expect(result).toContain('DETAIL: ');
    });

    it('should work with multiline user prompt', () => {
      const userPrompt = 'Line 1\nLine 2\nLine 3';
      const result = formatInpaintPrompt(userPrompt);
      expect(result).toContain(userPrompt);
    });
  });

  describe('Initialization', () => {
    it('should fail to initialize without API key', () => {
      delete process.env.GEMINI_API_KEY;

      const adapter = new GeminiInpaintAdapter();
      const result = adapter.initialize();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONFIG_MISSING_API_KEY');
      }
    });

    it('should initialize successfully with API key', () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const adapter = new GeminiInpaintAdapter();
      const result = adapter.initialize();

      expect(result.ok).toBe(true);
    });

    it('should report initialized state correctly', () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const adapter = new GeminiInpaintAdapter();
      expect(adapter.isInitialized()).toBe(false);

      adapter.initialize();
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should only initialize once', () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const adapter = new GeminiInpaintAdapter();
      const result1 = adapter.initialize();
      const result2 = adapter.initialize();

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
    });
  });

  describe('inpaint() API call', () => {
    it('should auto-initialize on first inpaint call', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: 'ABC123',
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const adapter = new GeminiInpaintAdapter();
      expect(adapter.isInitialized()).toBe(false);

      const request: InpaintRequest = {
        originalImage: 'base64image',
        mask: 'base64mask',
        prompt: 'Fix the hand',
      };

      await adapter.inpaint(request);

      expect(adapter.isInitialized()).toBe(true);
    });

    it('should return error when no API key on inpaint', async () => {
      delete process.env.GEMINI_API_KEY;

      const adapter = new GeminiInpaintAdapter();
      const request: InpaintRequest = {
        originalImage: 'base64image',
        mask: 'base64mask',
        prompt: 'Fix the hand',
      };

      const result = await adapter.inpaint(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('GEMINI_API_KEY');
    });

    it('should handle API response with no candidates', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [],
        },
      });

      const adapter = new GeminiInpaintAdapter();
      const request: InpaintRequest = {
        originalImage: 'base64image',
        mask: 'base64mask',
        prompt: 'Fix the hand',
      };

      const result = await adapter.inpaint(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle API response with no image data', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Some text response',
                  },
                ],
              },
            },
          ],
        },
      });

      const adapter = new GeminiInpaintAdapter();
      const request: InpaintRequest = {
        originalImage: 'base64image',
        mask: 'base64mask',
        prompt: 'Fix the hand',
      };

      const result = await adapter.inpaint(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No image data');
    });

    it('should handle API errors gracefully', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      mockGenerateContent.mockRejectedValue(new Error('API rate limit exceeded'));

      const adapter = new GeminiInpaintAdapter();
      const request: InpaintRequest = {
        originalImage: 'base64image',
        mask: 'base64mask',
        prompt: 'Fix the hand',
      };

      const result = await adapter.inpaint(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
    });

    it('should return success with valid image response', async () => {
      process.env.GEMINI_API_KEY = 'test-key';

      const expectedImageData = 'patched_image_base64_data';

      mockGenerateContent.mockResolvedValue({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: expectedImageData,
                    },
                  },
                ],
              },
            },
          ],
        },
      });

      const adapter = new GeminiInpaintAdapter();
      const request: InpaintRequest = {
        originalImage: 'base64image',
        mask: 'base64mask',
        prompt: 'Fix the hand',
      };

      const result = await adapter.inpaint(request);

      expect(result.success).toBe(true);
      expect(result.imageBase64).toBe(expectedImageData);
    });
  });
});
