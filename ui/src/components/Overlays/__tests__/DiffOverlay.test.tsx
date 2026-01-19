/**
 * Tests for DiffOverlay components (Story 7.8)
 * AC #1-7: Palette issues, blinking highlight, legalize, alignment, baselines, gap label
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { DiffOverlay, type DiffOverlayProps } from '../DiffOverlay';
import { PaletteDiffOverlay } from '../PaletteDiffOverlay';
import { AlignmentOverlay } from '../AlignmentOverlay';
import {
  hexToRgb,
  rgbToHex,
  colorDistance,
  isInPalette,
  findNearestPaletteColor,
} from '../../../utils/colorUtils';
import { detectBaseline, calculateBaselineDrift, formatDrift } from '../../../utils/baselineUtils';

describe('DiffOverlay Components (Story 7.8)', () => {
  // Mock canvas context
  const mockGetContext = vi.fn();
  const mockFillRect = vi.fn();
  const mockClearRect = vi.fn();
  const mockBeginPath = vi.fn();
  const mockMoveTo = vi.fn();
  const mockLineTo = vi.fn();
  const mockStroke = vi.fn();
  const mockFillText = vi.fn();
  const mockGetImageData = vi.fn();
  const mockPutImageData = vi.fn();
  const mockDrawImage = vi.fn();

  const mockCtx = {
    fillRect: mockFillRect,
    clearRect: mockClearRect,
    beginPath: mockBeginPath,
    moveTo: mockMoveTo,
    lineTo: mockLineTo,
    stroke: mockStroke,
    fillText: mockFillText,
    getImageData: mockGetImageData,
    putImageData: mockPutImageData,
    drawImage: mockDrawImage,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    setLineDash: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetContext.mockReturnValue(mockCtx);

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = mockGetContext as any;

    // Mock toDataURL
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,MOCK');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Color Utilities', () => {
    describe('hexToRgb', () => {
      it('should convert hex to RGB', () => {
        expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
        expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
        expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
      });

      it('should handle hex without hash', () => {
        expect(hexToRgb('ff8800')).toEqual({ r: 255, g: 136, b: 0 });
      });

      it('should return black for invalid hex', () => {
        expect(hexToRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 });
      });
    });

    describe('rgbToHex', () => {
      it('should convert RGB to hex', () => {
        expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
        expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
        expect(rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff');
      });

      it('should pad single digit values', () => {
        expect(rgbToHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
      });
    });

    describe('colorDistance', () => {
      it('should calculate Euclidean distance between colors', () => {
        const black = { r: 0, g: 0, b: 0 };
        const white = { r: 255, g: 255, b: 255 };
        const red = { r: 255, g: 0, b: 0 };

        expect(colorDistance(black, black)).toBe(0);
        expect(colorDistance(black, white)).toBeCloseTo(441.67, 1);
        expect(colorDistance(black, red)).toBe(255);
      });
    });

    describe('isInPalette', () => {
      const palette = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
      ];

      it('should return true for exact match', () => {
        expect(isInPalette({ r: 255, g: 0, b: 0 }, palette)).toBe(true);
      });

      it('should return true within tolerance', () => {
        expect(isInPalette({ r: 253, g: 2, b: 1 }, palette, 5)).toBe(true);
      });

      it('should return false outside tolerance', () => {
        expect(isInPalette({ r: 128, g: 128, b: 128 }, palette, 5)).toBe(false);
      });
    });

    describe('findNearestPaletteColor', () => {
      const palette = [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 0, b: 255 },
      ];

      it('should find nearest red', () => {
        const result = findNearestPaletteColor({ r: 200, g: 50, b: 30 }, palette);
        expect(result).toEqual({ r: 255, g: 0, b: 0 });
      });

      it('should find nearest green', () => {
        const result = findNearestPaletteColor({ r: 50, g: 200, b: 50 }, palette);
        expect(result).toEqual({ r: 0, g: 255, b: 0 });
      });

      it('should find nearest blue', () => {
        const result = findNearestPaletteColor({ r: 30, g: 30, b: 200 }, palette);
        expect(result).toEqual({ r: 0, g: 0, b: 255 });
      });

      it('should return original color for empty palette', () => {
        const color = { r: 128, g: 128, b: 128 };
        expect(findNearestPaletteColor(color, [])).toEqual(color);
      });
    });
  });

  describe('Baseline Utilities', () => {
    describe('calculateBaselineDrift', () => {
      it('should calculate drift down', () => {
        const result = calculateBaselineDrift(100, 110);
        expect(result).toEqual({ drift: 10, direction: 'down' });
      });

      it('should calculate drift up', () => {
        const result = calculateBaselineDrift(100, 90);
        expect(result).toEqual({ drift: 10, direction: 'up' });
      });

      it('should report no drift when aligned', () => {
        const result = calculateBaselineDrift(100, 100);
        expect(result).toEqual({ drift: 0, direction: 'none' });
      });
    });

    describe('formatDrift', () => {
      it('should format drift down', () => {
        expect(formatDrift(10, 'down')).toBe('+10px \u2193');
      });

      it('should format drift up', () => {
        expect(formatDrift(10, 'up')).toBe('-10px \u2191');
      });

      it('should format no drift', () => {
        expect(formatDrift(0, 'none')).toBe('0px (aligned)');
      });
    });
  });

  describe('DiffOverlay Component', () => {
    const defaultProps: DiffOverlayProps = {
      frameIndex: 1,
      canvasWidth: 512,
      canvasHeight: 512,
      zoomLevel: 4,
      palette: ['#ff0000', '#00ff00', '#0000ff'],
      anchorBaselineY: 100,
      imageBase64: 'test_base64_image',
    };

    it('should render with toggle buttons', () => {
      render(<DiffOverlay {...defaultProps} />);

      expect(screen.getByTestId('palette-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('alignment-toggle')).toBeInTheDocument();
    });

    it('should start with no overlay mode', () => {
      render(<DiffOverlay {...defaultProps} />);

      expect(screen.getByTestId('palette-toggle')).not.toHaveClass('active');
      expect(screen.getByTestId('alignment-toggle')).not.toHaveClass('active');
    });

    it('should toggle palette mode on button click', async () => {
      const user = userEvent.setup();
      render(<DiffOverlay {...defaultProps} />);

      await user.click(screen.getByTestId('palette-toggle'));

      expect(screen.getByTestId('palette-toggle').className).toMatch(/active/);
    });

    it('should toggle alignment mode on button click', async () => {
      const user = userEvent.setup();
      render(<DiffOverlay {...defaultProps} />);

      await user.click(screen.getByTestId('alignment-toggle'));

      expect(screen.getByTestId('alignment-toggle').className).toMatch(/active/);
    });

    it('should toggle off when clicking same mode button', async () => {
      const user = userEvent.setup();
      // Use no imageBase64 to avoid async analyzing
      render(<DiffOverlay {...defaultProps} imageBase64={undefined} />);

      await user.click(screen.getByTestId('palette-toggle'));
      expect(screen.getByTestId('palette-toggle').className).toMatch(/active/);

      await user.click(screen.getByTestId('palette-toggle'));
      expect(screen.getByTestId('palette-toggle').className).not.toMatch(/active/);
    });

    it('should switch modes when clicking different button', async () => {
      const user = userEvent.setup();
      // Use no imageBase64 to avoid async analyzing
      render(<DiffOverlay {...defaultProps} imageBase64={undefined} />);

      await user.click(screen.getByTestId('palette-toggle'));
      expect(screen.getByTestId('palette-toggle').className).toMatch(/active/);

      await user.click(screen.getByTestId('alignment-toggle'));
      expect(screen.getByTestId('palette-toggle').className).not.toMatch(/active/);
      expect(screen.getByTestId('alignment-toggle').className).toMatch(/active/);
    });

    it('should show shortcut hints in button titles', () => {
      render(<DiffOverlay {...defaultProps} />);

      expect(screen.getByTestId('palette-toggle')).toHaveAttribute('title', expect.stringContaining('P'));
      expect(screen.getByTestId('alignment-toggle')).toHaveAttribute('title', expect.stringContaining('L'));
    });
  });

  describe('PaletteDiffOverlay (AC #1, #2, #3)', () => {
    const defaultProps = {
      canvasWidth: 128,
      canvasHeight: 128,
      zoomLevel: 4,
      offPalettePixels: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      onLegalize: vi.fn(),
    };

    it('should render overlay canvas', () => {
      render(<PaletteDiffOverlay {...defaultProps} />);
      expect(screen.getByTestId('palette-overlay-canvas')).toBeInTheDocument();
    });

    it('should show blinking animation class when pixels present', () => {
      render(<PaletteDiffOverlay {...defaultProps} />);
      const canvas = screen.getByTestId('palette-overlay-canvas');
      expect(canvas.className).toMatch(/blinking/);
    });

    it('should not show blinking when no off-palette pixels', () => {
      render(<PaletteDiffOverlay {...defaultProps} offPalettePixels={[]} />);
      const canvas = screen.getByTestId('palette-overlay-canvas');
      expect(canvas.className).not.toMatch(/blinking/);
    });

    it('should show pixel count badge', () => {
      render(<PaletteDiffOverlay {...defaultProps} />);
      expect(screen.getByTestId('pixel-count')).toHaveTextContent('2');
    });

    it('should show legalize button when pixels detected', () => {
      render(<PaletteDiffOverlay {...defaultProps} />);
      expect(screen.getByTestId('legalize-button')).toBeInTheDocument();
    });

    it('should not show legalize button when no pixels detected', () => {
      render(<PaletteDiffOverlay {...defaultProps} offPalettePixels={[]} />);
      expect(screen.queryByTestId('legalize-button')).not.toBeInTheDocument();
    });

    it('should call onLegalize when legalize button clicked', async () => {
      const user = userEvent.setup();
      const onLegalize = vi.fn();
      render(<PaletteDiffOverlay {...defaultProps} onLegalize={onLegalize} />);

      await user.click(screen.getByTestId('legalize-button'));
      expect(onLegalize).toHaveBeenCalled();
    });

    it('should draw magenta overlay at off-palette positions', () => {
      render(<PaletteDiffOverlay {...defaultProps} />);

      // Canvas should have been drawn to
      expect(mockFillRect).toHaveBeenCalled();
      // Verify magenta color was used
      expect(mockCtx.fillStyle).toContain('255');
    });
  });

  describe('AlignmentOverlay (AC #4, #5, #6, #7)', () => {
    const defaultProps = {
      canvasWidth: 512,
      canvasHeight: 512,
      zoomLevel: 4,
      anchorBaselineY: 100,
      currentBaselineY: 108,
    };

    it('should render overlay canvas', () => {
      render(<AlignmentOverlay {...defaultProps} />);
      expect(screen.getByTestId('alignment-overlay-canvas')).toBeInTheDocument();
    });

    it('should draw anchor baseline line (cyan)', () => {
      render(<AlignmentOverlay {...defaultProps} />);

      expect(mockBeginPath).toHaveBeenCalled();
      expect(mockMoveTo).toHaveBeenCalled();
      expect(mockLineTo).toHaveBeenCalled();
      expect(mockStroke).toHaveBeenCalled();
    });

    it('should draw current baseline line (red)', () => {
      render(<AlignmentOverlay {...defaultProps} />);

      // Two lines should be drawn (anchor + current)
      expect(mockStroke).toHaveBeenCalledTimes(3); // 2 baseline lines + gap line
    });

    it('should display anchor baseline label', () => {
      render(<AlignmentOverlay {...defaultProps} />);
      expect(screen.getByTestId('anchor-label')).toHaveTextContent('Anchor: 100px');
    });

    it('should display current baseline label', () => {
      render(<AlignmentOverlay {...defaultProps} />);
      expect(screen.getByTestId('current-label')).toHaveTextContent('Current: 108px');
    });

    it('should show gap label with pixel distance', () => {
      render(<AlignmentOverlay {...defaultProps} />);
      expect(screen.getByTestId('gap-label')).toHaveTextContent('+8px');
    });

    it('should show drift direction arrow down', () => {
      render(<AlignmentOverlay {...defaultProps} />);
      expect(screen.getByTestId('gap-label')).toHaveTextContent('\u2193'); // ↓
    });

    it('should show drift direction arrow up', () => {
      render(<AlignmentOverlay {...defaultProps} currentBaselineY={92} />);
      expect(screen.getByTestId('gap-label')).toHaveTextContent('\u2191'); // ↑
    });

    it('should show aligned message when no drift', () => {
      render(<AlignmentOverlay {...defaultProps} currentBaselineY={100} />);
      expect(screen.getByTestId('gap-label')).toHaveTextContent('aligned');
    });
  });

  describe('Keyboard Shortcuts (AC #7)', () => {
    const defaultProps: DiffOverlayProps = {
      frameIndex: 1,
      canvasWidth: 512,
      canvasHeight: 512,
      zoomLevel: 4,
      palette: ['#ff0000', '#00ff00', '#0000ff'],
      anchorBaselineY: 100,
      imageBase64: 'test_base64_image',
    };

    it('should toggle palette mode with P key', async () => {
      const user = userEvent.setup();
      render(<DiffOverlay {...defaultProps} />);

      await user.keyboard('p');
      expect(screen.getByTestId('palette-toggle').className).toMatch(/active/);

      await user.keyboard('p');
      expect(screen.getByTestId('palette-toggle').className).not.toMatch(/active/);
    });

    it('should toggle alignment mode with L key', async () => {
      const user = userEvent.setup();
      render(<DiffOverlay {...defaultProps} />);

      await user.keyboard('l');
      expect(screen.getByTestId('alignment-toggle').className).toMatch(/active/);

      await user.keyboard('l');
      expect(screen.getByTestId('alignment-toggle').className).not.toMatch(/active/);
    });

    it('should handle uppercase P key', async () => {
      const user = userEvent.setup();
      render(<DiffOverlay {...defaultProps} />);

      await user.keyboard('P');
      expect(screen.getByTestId('palette-toggle').className).toMatch(/active/);
    });

    it('should handle uppercase L key', async () => {
      const user = userEvent.setup();
      render(<DiffOverlay {...defaultProps} />);

      await user.keyboard('L');
      expect(screen.getByTestId('alignment-toggle').className).toMatch(/active/);
    });
  });

  describe('Accessibility', () => {
    const defaultProps: DiffOverlayProps = {
      frameIndex: 1,
      canvasWidth: 512,
      canvasHeight: 512,
      zoomLevel: 4,
      palette: ['#ff0000', '#00ff00', '#0000ff'],
      anchorBaselineY: 100,
      imageBase64: 'test_base64_image',
    };

    it('should have proper ARIA labels on toggle buttons', () => {
      render(<DiffOverlay {...defaultProps} />);

      expect(screen.getByTestId('palette-toggle')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('palette')
      );
      expect(screen.getByTestId('alignment-toggle')).toHaveAttribute(
        'aria-label',
        expect.stringContaining('alignment')
      );
    });

    it('should indicate pressed state on toggle buttons', async () => {
      const user = userEvent.setup();
      render(<DiffOverlay {...defaultProps} />);

      const paletteBtn = screen.getByTestId('palette-toggle');
      expect(paletteBtn).toHaveAttribute('aria-pressed', 'false');

      await user.click(paletteBtn);
      expect(paletteBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<DiffOverlay {...defaultProps} />);

      const paletteBtn = screen.getByTestId('palette-toggle');
      paletteBtn.focus();
      await user.keyboard('{Enter}');

      expect(paletteBtn.className).toMatch(/active/);
    });
  });
});
