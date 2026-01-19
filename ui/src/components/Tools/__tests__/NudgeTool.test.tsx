/**
 * Tests for NudgeTool component (Story 7.4)
 * AC #1-6: Mouse tracking, real-time preview, delta recording, override storage, status update, non-destructive
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NudgeTool } from '../NudgeTool';
import type { HumanAlignmentDelta } from '../../../types/director-session';

describe('NudgeTool Component (Story 7.4)', () => {
  const defaultProps = {
    frameIndex: 1,
    zoomLevel: 4,
    onNudgeApply: vi.fn(),
    onNudgeReset: vi.fn(),
    onPreviewUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the nudge tool overlay', () => {
      render(<NudgeTool {...defaultProps} />);
      expect(screen.getByTestId('nudge-tool')).toBeInTheDocument();
    });

    it('should have grab cursor when not dragging', () => {
      render(<NudgeTool {...defaultProps} />);
      const overlay = screen.getByTestId('nudge-tool');
      expect(overlay.className).not.toMatch(/dragging/i);
    });

    it('should not show offset indicator when no offset', () => {
      render(<NudgeTool {...defaultProps} />);
      expect(screen.queryByTestId('offset-indicator')).not.toBeInTheDocument();
    });

    it('should not show reset button when no offset', () => {
      render(<NudgeTool {...defaultProps} />);
      expect(screen.queryByTestId('reset-alignment-button')).not.toBeInTheDocument();
    });

    it('should have proper ARIA attributes', () => {
      render(<NudgeTool {...defaultProps} />);
      const overlay = screen.getByTestId('nudge-tool');
      expect(overlay).toHaveAttribute('role', 'application');
      expect(overlay).toHaveAttribute('aria-label', 'Nudge tool for frame 1');
    });
  });

  describe('Mouse Tracking (AC #1)', () => {
    it('should start drag on mousedown', () => {
      render(<NudgeTool {...defaultProps} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });

      expect(overlay.className).toMatch(/dragging/i);
    });

    it('should stop drag on mouseup', async () => {
      render(<NudgeTool {...defaultProps} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      expect(overlay.className).toMatch(/dragging/i);

      fireEvent.mouseUp(overlay);

      await waitFor(() => {
        expect(overlay.className).not.toMatch(/dragging/i);
      });
    });

    it('should stop drag on mouseleave', async () => {
      render(<NudgeTool {...defaultProps} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseLeave(overlay);

      await waitFor(() => {
        expect(overlay.className).not.toMatch(/dragging/i);
      });
    });

    it('should track mouse position during drag', async () => {
      const onPreviewUpdate = vi.fn();
      render(<NudgeTool {...defaultProps} onPreviewUpdate={onPreviewUpdate} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 120, clientY: 108 });

      await waitFor(() => {
        expect(onPreviewUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Real-time Preview (AC #2)', () => {
    it('should call onPreviewUpdate during drag', async () => {
      const onPreviewUpdate = vi.fn();
      render(<NudgeTool {...defaultProps} onPreviewUpdate={onPreviewUpdate} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 116, clientY: 108 });

      await waitFor(() => {
        // Delta should be scaled by zoom (4x): (116-100)/4 = 4, (108-100)/4 = 2
        expect(onPreviewUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            x: 4,
            y: 2,
          })
        );
      });
    });

    it('should show offset indicator during drag', async () => {
      render(<NudgeTool {...defaultProps} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 120, clientY: 100 });

      await waitFor(() => {
        expect(screen.getByTestId('offset-indicator')).toBeInTheDocument();
      });
    });

    it('should display correct offset values', async () => {
      render(<NudgeTool {...defaultProps} />);
      const overlay = screen.getByTestId('nudge-tool');

      // Move 20px at 4x zoom = 5px offset
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 120, clientY: 88 });

      await waitFor(() => {
        const indicator = screen.getByTestId('offset-indicator');
        expect(indicator.textContent).toContain('+5');
        expect(indicator.textContent).toContain('-3');
      });
    });
  });

  describe('Delta Recording (AC #3, #4)', () => {
    it('should call onNudgeApply with correct delta on drag end', async () => {
      const onNudgeApply = vi.fn();
      render(<NudgeTool {...defaultProps} onNudgeApply={onNudgeApply} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 120, clientY: 108 });
      fireEvent.mouseUp(overlay);

      await waitFor(() => {
        expect(onNudgeApply).toHaveBeenCalledWith(
          expect.objectContaining({
            frameId: 'frame_0001',
            userOverrideX: 5,
            userOverrideY: 2,
            timestamp: expect.any(String),
          })
        );
      });
    });

    it('should include timestamp in delta', async () => {
      const onNudgeApply = vi.fn();
      render(<NudgeTool {...defaultProps} onNudgeApply={onNudgeApply} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 120, clientY: 100 });
      fireEvent.mouseUp(overlay);

      await waitFor(() => {
        const call = onNudgeApply.mock.calls[0][0] as HumanAlignmentDelta;
        expect(call.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });
    });

    it('should not call onNudgeApply if no movement', async () => {
      const onNudgeApply = vi.fn();
      render(<NudgeTool {...defaultProps} onNudgeApply={onNudgeApply} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseUp(overlay);

      await waitFor(() => {
        expect(onNudgeApply).not.toHaveBeenCalled();
      });
    });

    it('should format frameId with leading zeros', async () => {
      const onNudgeApply = vi.fn();
      render(<NudgeTool {...defaultProps} frameIndex={5} onNudgeApply={onNudgeApply} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 108, clientY: 100 });
      fireEvent.mouseUp(overlay);

      await waitFor(() => {
        const call = onNudgeApply.mock.calls[0][0] as HumanAlignmentDelta;
        expect(call.frameId).toBe('frame_0005');
      });
    });
  });

  describe('Existing Alignment (AC #4)', () => {
    it('should display existing alignment offset', () => {
      const currentAlignment: HumanAlignmentDelta = {
        frameId: 'frame_0001',
        userOverrideX: 3,
        userOverrideY: -2,
        timestamp: new Date().toISOString(),
      };

      render(<NudgeTool {...defaultProps} currentAlignment={currentAlignment} />);

      const indicator = screen.getByTestId('offset-indicator');
      expect(indicator.textContent).toContain('+3');
      expect(indicator.textContent).toContain('-2');
    });

    it('should show reset button when alignment exists', () => {
      const currentAlignment: HumanAlignmentDelta = {
        frameId: 'frame_0001',
        userOverrideX: 3,
        userOverrideY: -2,
        timestamp: new Date().toISOString(),
      };

      render(<NudgeTool {...defaultProps} currentAlignment={currentAlignment} />);

      expect(screen.getByTestId('reset-alignment-button')).toBeInTheDocument();
    });

    it('should accumulate new drag on top of existing alignment', async () => {
      const onNudgeApply = vi.fn();
      const currentAlignment: HumanAlignmentDelta = {
        frameId: 'frame_0001',
        userOverrideX: 3,
        userOverrideY: -2,
        timestamp: new Date().toISOString(),
      };

      render(
        <NudgeTool
          {...defaultProps}
          onNudgeApply={onNudgeApply}
          currentAlignment={currentAlignment}
        />
      );
      const overlay = screen.getByTestId('nudge-tool');

      // Drag +8px at 4x zoom = +2 source pixels
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 108, clientY: 104 });
      fireEvent.mouseUp(overlay);

      await waitFor(() => {
        const call = onNudgeApply.mock.calls[0][0] as HumanAlignmentDelta;
        // Should be 3 + 2 = 5 for X, -2 + 1 = -1 for Y
        expect(call.userOverrideX).toBe(5);
        expect(call.userOverrideY).toBe(-1);
      });
    });
  });

  describe('Reset Functionality (AC #6)', () => {
    it('should call onNudgeReset when reset button clicked', async () => {
      const onNudgeReset = vi.fn();
      const currentAlignment: HumanAlignmentDelta = {
        frameId: 'frame_0001',
        userOverrideX: 3,
        userOverrideY: -2,
        timestamp: new Date().toISOString(),
      };

      const user = userEvent.setup();
      render(
        <NudgeTool {...defaultProps} onNudgeReset={onNudgeReset} currentAlignment={currentAlignment} />
      );

      await user.click(screen.getByTestId('reset-alignment-button'));

      expect(onNudgeReset).toHaveBeenCalled();
    });

    it('should clear offset display after reset', async () => {
      const onNudgeReset = vi.fn();
      const currentAlignment: HumanAlignmentDelta = {
        frameId: 'frame_0001',
        userOverrideX: 3,
        userOverrideY: -2,
        timestamp: new Date().toISOString(),
      };

      const user = userEvent.setup();
      render(
        <NudgeTool {...defaultProps} onNudgeReset={onNudgeReset} currentAlignment={currentAlignment} />
      );

      expect(screen.getByTestId('offset-indicator')).toBeInTheDocument();

      await user.click(screen.getByTestId('reset-alignment-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('offset-indicator')).not.toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('should not respond to mouse events when disabled', async () => {
      const onNudgeApply = vi.fn();
      render(<NudgeTool {...defaultProps} disabled={true} onNudgeApply={onNudgeApply} />);
      const overlay = screen.getByTestId('nudge-tool');

      expect(overlay.className).toMatch(/disabled/i);

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 120, clientY: 100 });
      fireEvent.mouseUp(overlay);

      expect(onNudgeApply).not.toHaveBeenCalled();
    });
  });

  describe('Touch Support (AC #2)', () => {
    it('should start drag on touchstart', () => {
      render(<NudgeTool {...defaultProps} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.touchStart(overlay, {
        touches: [{ clientX: 100, clientY: 100 }],
      });

      expect(overlay.className).toMatch(/dragging/i);
    });

    it('should track touch position during drag', async () => {
      const onPreviewUpdate = vi.fn();
      render(<NudgeTool {...defaultProps} onPreviewUpdate={onPreviewUpdate} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.touchStart(overlay, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchMove(overlay, {
        touches: [{ clientX: 120, clientY: 108 }],
      });

      await waitFor(() => {
        expect(onPreviewUpdate).toHaveBeenCalled();
      });
    });

    it('should end drag on touchend', async () => {
      const onNudgeApply = vi.fn();
      render(<NudgeTool {...defaultProps} onNudgeApply={onNudgeApply} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.touchStart(overlay, {
        touches: [{ clientX: 100, clientY: 100 }],
      });
      fireEvent.touchMove(overlay, {
        touches: [{ clientX: 120, clientY: 100 }],
      });
      fireEvent.touchEnd(overlay);

      await waitFor(() => {
        expect(onNudgeApply).toHaveBeenCalled();
      });
    });
  });

  describe('Zoom Scaling', () => {
    it('should scale delta by zoom level', async () => {
      const onNudgeApply = vi.fn();
      // At 2x zoom, 20px mouse movement = 10px source pixels
      render(<NudgeTool {...defaultProps} zoomLevel={2} onNudgeApply={onNudgeApply} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 120, clientY: 100 });
      fireEvent.mouseUp(overlay);

      await waitFor(() => {
        const call = onNudgeApply.mock.calls[0][0] as HumanAlignmentDelta;
        expect(call.userOverrideX).toBe(10);
      });
    });

    it('should round delta to integers', async () => {
      const onNudgeApply = vi.fn();
      // At 4x zoom, 7px mouse movement = 1.75 -> rounds to 2
      render(<NudgeTool {...defaultProps} zoomLevel={4} onNudgeApply={onNudgeApply} />);
      const overlay = screen.getByTestId('nudge-tool');

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(overlay, { clientX: 107, clientY: 100 });
      fireEvent.mouseUp(overlay);

      await waitFor(() => {
        const call = onNudgeApply.mock.calls[0][0] as HumanAlignmentDelta;
        expect(Number.isInteger(call.userOverrideX)).toBe(true);
      });
    });
  });
});

// useDrag Hook tests are implicitly covered through NudgeTool component tests
// Additional isolated hook tests could be added using @testing-library/react-hooks
// if more granular testing is needed
