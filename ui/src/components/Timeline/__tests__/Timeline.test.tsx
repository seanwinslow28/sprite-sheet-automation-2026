/**
 * Tests for Timeline component (Story 7.2)
 * AC #1-5: Filmstrip layout, status colors, frame selection, keyboard nav
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timeline } from '../Timeline';
import { FrameThumbnail } from '../FrameThumbnail';
import type { DirectorFrameState, FrameStatus } from '../../../types/director-session';

// Factory function for creating mock frame data
function createMockFrame(
  index: number,
  status: FrameStatus = 'PENDING',
  overrides?: Partial<DirectorFrameState>
): DirectorFrameState {
  return {
    id: `frame_${String(index).padStart(4, '0')}`,
    frameIndex: index,
    status,
    imagePath: `/runs/test/frame_${String(index).padStart(4, '0')}.png`,
    auditReport: {
      compositeScore: status === 'APPROVED' ? 0.95 : 0.7,
      flags: status === 'AUDIT_FAIL' ? ['SF01_IDENTITY_DRIFT'] : [],
      passed: status === 'APPROVED',
    },
    directorOverrides: {
      isPatched: false,
      patchHistory: [],
    },
    attemptHistory: [],
    ...overrides,
  };
}

// Create a set of test frames
function createMockFrames(count: number): DirectorFrameState[] {
  return Array.from({ length: count }, (_, i) => createMockFrame(i, 'PENDING'));
}

describe('Timeline Component (Story 7.2)', () => {
  describe('Filmstrip Layout (AC #1)', () => {
    it('should render as a horizontal container', () => {
      const frames = createMockFrames(8);
      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={0}
          onFrameSelect={() => {}}
        />
      );

      const timeline = screen.getByTestId('timeline');
      expect(timeline).toBeInTheDocument();
    });

    it('should render all frames', () => {
      const frames = createMockFrames(8);
      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={0}
          onFrameSelect={() => {}}
        />
      );

      // Should have 8 frame thumbnails
      for (let i = 0; i < 8; i++) {
        expect(screen.getByTestId(`frame-thumbnail-${i}`)).toBeInTheDocument();
      }
    });

    it('should render scroll navigation buttons', () => {
      const frames = createMockFrames(8);
      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={0}
          onFrameSelect={() => {}}
        />
      );

      expect(screen.getByLabelText('Scroll left')).toBeInTheDocument();
      expect(screen.getByLabelText('Scroll right')).toBeInTheDocument();
    });

    it('should show empty state when no frames', () => {
      render(
        <Timeline
          frames={[]}
          selectedFrameIndex={0}
          onFrameSelect={() => {}}
        />
      );

      expect(screen.getByText('No frames loaded')).toBeInTheDocument();
    });

    it('should display frame counter', () => {
      const frames = createMockFrames(8);
      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={3}
          onFrameSelect={() => {}}
        />
      );

      expect(screen.getByText('4 / 8')).toBeInTheDocument();
    });
  });

  describe('Frame Selection (AC #3, #4)', () => {
    it('should call onFrameSelect when frame is clicked', async () => {
      const frames = createMockFrames(4);
      const onFrameSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={0}
          onFrameSelect={onFrameSelect}
        />
      );

      await user.click(screen.getByTestId('frame-thumbnail-2'));
      expect(onFrameSelect).toHaveBeenCalledWith(2);
    });

    it('should highlight the selected frame', () => {
      const frames = createMockFrames(4);
      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={2}
          onFrameSelect={() => {}}
        />
      );

      const selectedThumbnail = screen.getByTestId('frame-thumbnail-2');
      // CSS modules mangle class names, check for partial match
      expect(selectedThumbnail.className).toMatch(/selected/i);
    });

    it('should auto-scroll to selected frame', () => {
      const frames = createMockFrames(16);
      const { rerender } = render(
        <Timeline
          frames={frames}
          selectedFrameIndex={0}
          onFrameSelect={() => {}}
        />
      );

      // Change selection
      rerender(
        <Timeline
          frames={frames}
          selectedFrameIndex={10}
          onFrameSelect={() => {}}
        />
      );

      // scrollIntoView should have been called
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation (AC #4)', () => {
    it('should navigate left with ArrowLeft key', async () => {
      const frames = createMockFrames(4);
      const onFrameSelect = vi.fn();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={2}
          onFrameSelect={onFrameSelect}
        />
      );

      const timeline = screen.getByTestId('timeline');
      fireEvent.keyDown(timeline, { key: 'ArrowLeft' });

      expect(onFrameSelect).toHaveBeenCalledWith(1);
    });

    it('should navigate right with ArrowRight key', async () => {
      const frames = createMockFrames(4);
      const onFrameSelect = vi.fn();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={1}
          onFrameSelect={onFrameSelect}
        />
      );

      const timeline = screen.getByTestId('timeline');
      fireEvent.keyDown(timeline, { key: 'ArrowRight' });

      expect(onFrameSelect).toHaveBeenCalledWith(2);
    });

    it('should not navigate left from first frame', () => {
      const frames = createMockFrames(4);
      const onFrameSelect = vi.fn();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={0}
          onFrameSelect={onFrameSelect}
        />
      );

      const timeline = screen.getByTestId('timeline');
      fireEvent.keyDown(timeline, { key: 'ArrowLeft' });

      expect(onFrameSelect).not.toHaveBeenCalled();
    });

    it('should not navigate right from last frame', () => {
      const frames = createMockFrames(4);
      const onFrameSelect = vi.fn();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={3}
          onFrameSelect={onFrameSelect}
        />
      );

      const timeline = screen.getByTestId('timeline');
      fireEvent.keyDown(timeline, { key: 'ArrowRight' });

      expect(onFrameSelect).not.toHaveBeenCalled();
    });

    it('should navigate to first frame with Home key', () => {
      const frames = createMockFrames(8);
      const onFrameSelect = vi.fn();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={5}
          onFrameSelect={onFrameSelect}
        />
      );

      const timeline = screen.getByTestId('timeline');
      fireEvent.keyDown(timeline, { key: 'Home' });

      expect(onFrameSelect).toHaveBeenCalledWith(0);
    });

    it('should navigate to last frame with End key', () => {
      const frames = createMockFrames(8);
      const onFrameSelect = vi.fn();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={2}
          onFrameSelect={onFrameSelect}
        />
      );

      const timeline = screen.getByTestId('timeline');
      fireEvent.keyDown(timeline, { key: 'End' });

      expect(onFrameSelect).toHaveBeenCalledWith(7);
    });
  });

  describe('Scroll Buttons', () => {
    it('should call scrollBy when left button is clicked', async () => {
      const frames = createMockFrames(16);
      const user = userEvent.setup();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={8}
          onFrameSelect={() => {}}
        />
      );

      await user.click(screen.getByLabelText('Scroll left'));
      expect(Element.prototype.scrollBy).toHaveBeenCalled();
    });

    it('should call scrollBy when right button is clicked', async () => {
      const frames = createMockFrames(16);
      const user = userEvent.setup();

      render(
        <Timeline
          frames={frames}
          selectedFrameIndex={0}
          onFrameSelect={() => {}}
        />
      );

      await user.click(screen.getByLabelText('Scroll right'));
      expect(Element.prototype.scrollBy).toHaveBeenCalled();
    });
  });
});

describe('FrameThumbnail Component (Story 7.2)', () => {
  describe('Status Color Coding (AC #2)', () => {
    it('should apply green border for APPROVED status', () => {
      const frame = createMockFrame(0, 'APPROVED');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      expect(thumbnail).toHaveStyle({ borderColor: '#44cc44' });
    });

    it('should apply yellow border for AUDIT_WARN status', () => {
      const frame = createMockFrame(0, 'AUDIT_WARN');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      expect(thumbnail).toHaveStyle({ borderColor: '#ffcc00' });
    });

    it('should apply red border for AUDIT_FAIL status', () => {
      const frame = createMockFrame(0, 'AUDIT_FAIL');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      expect(thumbnail).toHaveStyle({ borderColor: '#ff4444' });
    });

    it('should apply gray border for PENDING status', () => {
      const frame = createMockFrame(0, 'PENDING');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      expect(thumbnail).toHaveStyle({ borderColor: '#888888' });
    });

    it('should apply gray border for GENERATED status', () => {
      const frame = createMockFrame(0, 'GENERATED');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      expect(thumbnail).toHaveStyle({ borderColor: '#888888' });
    });
  });

  describe('Thumbnail Display (AC #5)', () => {
    it('should display frame number label', () => {
      const frame = createMockFrame(5, 'PENDING');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      // Multiple elements have the frame number (placeholder + label)
      const elements = screen.getAllByText('05');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should display audit score when available', () => {
      const frame = createMockFrame(0, 'APPROVED', {
        auditReport: {
          compositeScore: 0.92,
          flags: [],
          passed: true,
        },
      });
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('should render image when base64 is provided', () => {
      const frame = createMockFrame(0, 'PENDING', {
        imageBase64: 'ABC123', // Fake base64
      });
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,ABC123');
    });

    it('should show placeholder when no image base64', () => {
      const frame = createMockFrame(0, 'PENDING');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      // Should have placeholder with frame number
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('Selection Highlight (AC #4)', () => {
    it('should have selected class when isSelected is true', () => {
      const frame = createMockFrame(0, 'PENDING');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={true}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      // CSS modules mangle class names, check for partial match
      expect(thumbnail.className).toMatch(/selected/i);
    });

    it('should not have selected class when isSelected is false', () => {
      const frame = createMockFrame(0, 'PENDING');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      // Should not have 'selected' as a distinct word in class (but may have underscore-mangled versions)
      expect(thumbnail.className).not.toMatch(/_selected_/i);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const frame = createMockFrame(3, 'APPROVED');
      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-3');
      expect(thumbnail).toHaveAttribute('role', 'button');
      expect(thumbnail).toHaveAttribute('tabIndex', '0');
      expect(thumbnail).toHaveAttribute('aria-label', 'Frame 03: Approved');
    });

    it('should call onClick when Enter is pressed', () => {
      const frame = createMockFrame(0, 'PENDING');
      const onClick = vi.fn();

      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={onClick}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      fireEvent.keyDown(thumbnail, { key: 'Enter' });

      expect(onClick).toHaveBeenCalled();
    });

    it('should call onClick when Space is pressed', () => {
      const frame = createMockFrame(0, 'PENDING');
      const onClick = vi.fn();

      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={onClick}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-0');
      fireEvent.keyDown(thumbnail, { key: ' ' });

      expect(onClick).toHaveBeenCalled();
    });
  });

  describe('Hover and Tooltip', () => {
    it('should have title attribute with status info', () => {
      const frame = createMockFrame(2, 'AUDIT_WARN', {
        auditReport: {
          compositeScore: 0.78,
          flags: ['SF01'],
          passed: false,
        },
      });

      render(
        <FrameThumbnail
          frame={frame}
          isSelected={false}
          onClick={() => {}}
        />
      );

      const thumbnail = screen.getByTestId('frame-thumbnail-2');
      expect(thumbnail).toHaveAttribute('title', 'Frame 02: Needs Review (78%)');
    });
  });
});
