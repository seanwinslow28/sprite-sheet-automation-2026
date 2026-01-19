/**
 * Tests for MaskPenTool component (Story 7.5)
 * AC #1-5: Brush cursor, mask drawing, mask erasing, mask storage, prompt input
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MaskPenTool } from '../MaskPenTool';

// Mock canvas context
const mockCanvasContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  getImageData: vi.fn(() => ({
    data: new Uint8ClampedArray(512 * 512 * 4),
  })),
  putImageData: vi.fn(),
  globalCompositeOperation: 'source-over',
  fillStyle: '',
};

// Mock canvas with proper dimensions
const mockCanvas = {
  getContext: vi.fn(() => mockCanvasContext),
  width: 512,
  height: 512,
  getBoundingClientRect: () => ({
    left: 0,
    top: 0,
    width: 512,
    height: 512,
  }),
  toDataURL: vi.fn(() => 'data:image/png;base64,ABC123'),
};

describe('MaskPenTool Component (Story 7.5)', () => {
  const defaultProps = {
    canvasWidth: 512,
    canvasHeight: 512,
    zoomLevel: 4,
    sourceSize: 128,
    onMaskComplete: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock HTMLCanvasElement
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext) as any;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,ABC123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the mask pen tool container', () => {
      render(<MaskPenTool {...defaultProps} />);
      expect(screen.getByTestId('mask-pen-tool')).toBeInTheDocument();
    });

    it('should render the mask canvas', () => {
      render(<MaskPenTool {...defaultProps} />);
      expect(screen.getByTestId('mask-canvas')).toBeInTheDocument();
    });

    it('should render the controls panel', () => {
      render(<MaskPenTool {...defaultProps} />);
      expect(screen.getByTestId('mask-controls')).toBeInTheDocument();
    });

    it('should render brush size slider', () => {
      render(<MaskPenTool {...defaultProps} />);
      expect(screen.getByRole('slider', { name: /brush size/i })).toBeInTheDocument();
    });

    it('should render eraser toggle button', () => {
      render(<MaskPenTool {...defaultProps} />);
      expect(screen.getByTestId('eraser-toggle')).toBeInTheDocument();
    });

    it('should render clear mask button', () => {
      render(<MaskPenTool {...defaultProps} />);
      expect(screen.getByTestId('clear-mask-button')).toBeInTheDocument();
    });

    it('should not show prompt panel initially', () => {
      render(<MaskPenTool {...defaultProps} />);
      expect(screen.queryByTestId('prompt-panel')).not.toBeInTheDocument();
    });

    it('should have proper ARIA attributes on canvas', () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');
      expect(canvas).toHaveAttribute('aria-label', 'Mask drawing canvas');
    });
  });

  describe('Brush Cursor (AC #1)', () => {
    it('should show brush preview on mouse move', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        expect(screen.getByTestId('brush-preview')).toBeInTheDocument();
      });
    });

    it('should position brush preview at cursor location', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 200 });

      await waitFor(() => {
        const preview = screen.getByTestId('brush-preview');
        expect(preview).toHaveStyle({ left: '150px', top: '200px' });
      });
    });

    it('should hide brush preview on mouse leave', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });
      await waitFor(() => {
        expect(screen.getByTestId('brush-preview')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(canvas);
      await waitFor(() => {
        expect(screen.queryByTestId('brush-preview')).not.toBeInTheDocument();
      });
    });

    it('should update brush preview size when slider changes', async () => {
      render(<MaskPenTool {...defaultProps} />);

      const slider = screen.getByRole('slider', { name: /brush size/i });
      fireEvent.change(slider, { target: { value: '30' } });

      const canvas = screen.getByTestId('mask-canvas');
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        const preview = screen.getByTestId('brush-preview');
        expect(preview).toHaveStyle({ width: '30px', height: '30px' });
      });
    });
  });

  describe('Mask Drawing (AC #2)', () => {
    it('should call canvas context methods on draw', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        expect(mockCanvasContext.beginPath).toHaveBeenCalled();
        expect(mockCanvasContext.arc).toHaveBeenCalled();
        expect(mockCanvasContext.fill).toHaveBeenCalled();
      });
    });

    it('should use source-over composite operation for drawing', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        expect(mockCanvasContext.globalCompositeOperation).toBe('source-over');
      });
    });

    it('should draw continuously on mouse move while pressed', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 120, clientY: 120 });
      fireEvent.mouseMove(canvas, { clientX: 140, clientY: 140 });

      await waitFor(() => {
        // Multiple draw calls for interpolation
        expect(mockCanvasContext.arc.mock.calls.length).toBeGreaterThan(1);
      });
    });

    it('should stop drawing on mouse up', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      const initialCalls = mockCanvasContext.arc.mock.calls.length;

      fireEvent.mouseUp(canvas);
      fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 });

      await waitFor(() => {
        // No additional draw calls after mouse up
        expect(mockCanvasContext.arc.mock.calls.length).toBe(initialCalls);
      });
    });
  });

  describe('Mask Erasing (AC #3)', () => {
    it('should activate eraser mode on toggle click', async () => {
      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} />);

      const eraserButton = screen.getByTestId('eraser-toggle');
      expect(eraserButton).toHaveAttribute('aria-pressed', 'false');

      await user.click(eraserButton);
      expect(eraserButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show active style when eraser is on', async () => {
      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} />);

      const eraserButton = screen.getByTestId('eraser-toggle');
      await user.click(eraserButton);

      expect(eraserButton.className).toMatch(/active/i);
    });

    it('should toggle eraser off on second click', async () => {
      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} />);

      const eraserButton = screen.getByTestId('eraser-toggle');
      await user.click(eraserButton);
      expect(eraserButton).toHaveAttribute('aria-pressed', 'true');

      await user.click(eraserButton);
      expect(eraserButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should use destination-out for erasing', async () => {
      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} />);

      const eraserButton = screen.getByTestId('eraser-toggle');
      await user.click(eraserButton);

      const canvas = screen.getByTestId('mask-canvas');
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        expect(mockCanvasContext.globalCompositeOperation).toBe('destination-out');
      });
    });

    it('should clear entire mask on clear button click', async () => {
      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} />);

      await user.click(screen.getByTestId('clear-mask-button'));

      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('Brush Size Controls', () => {
    it('should have default brush size of 20', () => {
      render(<MaskPenTool {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /brush size/i });
      expect(slider).toHaveValue('20');
    });

    it('should update brush size on slider change', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /brush size/i });

      fireEvent.change(slider, { target: { value: '35' } });

      expect(slider).toHaveValue('35');
      expect(screen.getByText('Brush Size: 35px')).toBeInTheDocument();
    });

    it('should have min brush size of 5', () => {
      render(<MaskPenTool {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /brush size/i });
      expect(slider).toHaveAttribute('min', '5');
    });

    it('should have max brush size of 50', () => {
      render(<MaskPenTool {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /brush size/i });
      expect(slider).toHaveAttribute('max', '50');
    });
  });

  describe('Prompt Input (AC #5)', () => {
    // To test prompt panel, we need to simulate having mask content
    // This requires mocking getImageData to return non-zero alpha values
    it('should show prompt panel when mask has content', async () => {
      // Mock getImageData to return data with alpha > 0
      mockCanvasContext.getImageData.mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 128, 0, 0, 0, 0]), // First pixel has alpha
      });

      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      // Draw to trigger mask content check
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(canvas);

      await waitFor(() => {
        expect(screen.getByTestId('prompt-panel')).toBeInTheDocument();
      });
    });

    it('should have correction prompt textarea', async () => {
      mockCanvasContext.getImageData.mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 128]),
      });

      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(canvas);

      await waitFor(() => {
        expect(screen.getByTestId('correction-prompt')).toBeInTheDocument();
      });
    });

    it('should have placeholder text in prompt', async () => {
      mockCanvasContext.getImageData.mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 128]),
      });

      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        const textarea = screen.getByTestId('correction-prompt');
        expect(textarea).toHaveAttribute('placeholder');
        expect(textarea.getAttribute('placeholder')).toContain('Clenched fist');
      });
    });

    it('should have patch button disabled when no prompt', async () => {
      mockCanvasContext.getImageData.mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 128]),
      });

      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        expect(screen.getByTestId('patch-button')).toBeDisabled();
      });
    });

    it('should enable patch button when prompt is entered', async () => {
      mockCanvasContext.getImageData.mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 128]),
      });

      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(async () => {
        const textarea = screen.getByTestId('correction-prompt');
        await user.type(textarea, 'Fix the hand');
      });

      expect(screen.getByTestId('patch-button')).not.toBeDisabled();
    });

    it('should call onMaskComplete when patch button clicked', async () => {
      mockCanvasContext.getImageData.mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 128]),
      });

      const onMaskComplete = vi.fn();
      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} onMaskComplete={onMaskComplete} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(async () => {
        const textarea = screen.getByTestId('correction-prompt');
        await user.type(textarea, 'Fix the hand');
        await user.click(screen.getByTestId('patch-button'));
      });

      expect(onMaskComplete).toHaveBeenCalledWith(
        expect.any(String), // maskBase64
        'Fix the hand'
      );
    });
  });

  describe('Cancel Functionality', () => {
    it('should call onCancel when cancel button clicked', async () => {
      mockCanvasContext.getImageData.mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 128]),
      });

      const onCancel = vi.fn();
      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} onCancel={onCancel} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(async () => {
        await user.click(screen.getByTestId('cancel-button'));
      });

      expect(onCancel).toHaveBeenCalled();
    });

    it('should clear mask on cancel', async () => {
      mockCanvasContext.getImageData.mockReturnValue({
        data: new Uint8ClampedArray([255, 0, 0, 128]),
      });

      const user = userEvent.setup();
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });

      await waitFor(async () => {
        await user.click(screen.getByTestId('cancel-button'));
      });

      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should have disabled class when disabled', () => {
      render(<MaskPenTool {...defaultProps} disabled={true} />);
      const container = screen.getByTestId('mask-pen-tool');
      expect(container.className).toMatch(/disabled/i);
    });

    it('should not draw when disabled', async () => {
      render(<MaskPenTool {...defaultProps} disabled={true} />);
      const canvas = screen.getByTestId('mask-canvas');

      const initialCalls = mockCanvasContext.arc.mock.calls.length;

      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });

      expect(mockCanvasContext.arc.mock.calls.length).toBe(initialCalls);
    });

    it('should not show brush preview when disabled', async () => {
      render(<MaskPenTool {...defaultProps} disabled={true} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 100 });

      await waitFor(() => {
        expect(screen.queryByTestId('brush-preview')).not.toBeInTheDocument();
      });
    });
  });

  describe('Touch Support', () => {
    it('should handle touch start', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      await waitFor(() => {
        expect(mockCanvasContext.beginPath).toHaveBeenCalled();
      });
    });

    it('should handle touch move', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      const initialCalls = mockCanvasContext.arc.mock.calls.length;

      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 120, clientY: 120 }],
      });

      await waitFor(() => {
        expect(mockCanvasContext.arc.mock.calls.length).toBeGreaterThan(initialCalls);
      });
    });

    it('should stop drawing on touch end', async () => {
      render(<MaskPenTool {...defaultProps} />);
      const canvas = screen.getByTestId('mask-canvas');

      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      fireEvent.touchEnd(canvas);

      const callsAfterEnd = mockCanvasContext.arc.mock.calls.length;

      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 200, clientY: 200 }],
      });

      expect(mockCanvasContext.arc.mock.calls.length).toBe(callsAfterEnd);
    });
  });
});
