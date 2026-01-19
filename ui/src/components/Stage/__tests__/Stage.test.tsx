/**
 * Tests for Stage component (Story 7.3)
 * AC #1-6: High zoom, onion skinning, anchor overlay, baseline guide, checkerboard, zoom levels
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Stage, type AnchorAnalysis } from '../Stage';
import { StageToolbar, type ZoomLevel } from '../StageToolbar';
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
    imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // 1x1 red PNG
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

// Mock anchor analysis
const mockAnchorAnalysis: AnchorAnalysis = {
  baselineY: 100,
  rootX: 64,
  visibleBounds: {
    top: 10,
    bottom: 120,
    left: 20,
    right: 108,
  },
};

// Mock canvas context
const mockCanvasContext = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  setLineDash: vi.fn(),
  fillText: vi.fn(),
  imageSmoothingEnabled: true,
  globalAlpha: 1,
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  font: '',
};

// Mock Image class
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';

  constructor() {
    // Trigger onload after setting src
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

describe('Stage Component (Story 7.3)', () => {
  beforeEach(() => {
    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCanvasContext) as any;

    // Mock Image constructor
    (global as any).Image = MockImage;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Stage Display (AC #1, #5)', () => {
    it('should render the stage container', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByTestId('stage')).toBeInTheDocument();
    });

    it('should render the canvas element', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByTestId('stage-canvas')).toBeInTheDocument();
    });

    it('should render checkerboard background', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByTestId('stage-checkerboard')).toBeInTheDocument();
    });

    it('should show empty state when no frames', () => {
      render(
        <Stage
          frames={[]}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByText('No frames loaded')).toBeInTheDocument();
    });

    it('should show loading state when current frame missing', () => {
      const frames = createMockFrames(2);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={5} // Invalid index
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByText('Loading frame...')).toBeInTheDocument();
    });
  });

  describe('Zoom Controls (AC #6)', () => {
    it('should render zoom selector with default 4x', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const select = screen.getByRole('combobox', { name: /zoom level/i });
      expect(select).toHaveValue('4');
    });

    it('should change zoom level when selector changes', async () => {
      const frames = createMockFrames(4);
      const user = userEvent.setup();
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const select = screen.getByRole('combobox', { name: /zoom level/i });
      await user.selectOptions(select, '2');
      expect(select).toHaveValue('2');
    });

    it('should have zoom in and zoom out buttons', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument();
    });

    it('should zoom in when + button clicked', async () => {
      const frames = createMockFrames(4);
      const user = userEvent.setup();
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const select = screen.getByRole('combobox', { name: /zoom level/i });
      // Default is 4x
      expect(select).toHaveValue('4');

      await user.click(screen.getByRole('button', { name: /zoom in/i }));
      expect(select).toHaveValue('8');
    });

    it('should zoom out when - button clicked', async () => {
      const frames = createMockFrames(4);
      const user = userEvent.setup();
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const select = screen.getByRole('combobox', { name: /zoom level/i });
      // Default is 4x
      expect(select).toHaveValue('4');

      await user.click(screen.getByRole('button', { name: /zoom out/i }));
      expect(select).toHaveValue('2');
    });

    it('should disable zoom in at max (8x)', async () => {
      const frames = createMockFrames(4);
      const user = userEvent.setup();
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const select = screen.getByRole('combobox', { name: /zoom level/i });
      await user.selectOptions(select, '8');

      expect(screen.getByRole('button', { name: /zoom in/i })).toBeDisabled();
    });

    it('should disable zoom out at min (1x)', async () => {
      const frames = createMockFrames(4);
      const user = userEvent.setup();
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const select = screen.getByRole('combobox', { name: /zoom level/i });
      await user.selectOptions(select, '1');

      expect(screen.getByRole('button', { name: /zoom out/i })).toBeDisabled();
    });
  });

  describe('Onion Skinning Toggle (AC #2)', () => {
    it('should have onion skin toggle button', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={1}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByRole('button', { name: /toggle onion skin/i })).toBeInTheDocument();
    });

    it('should have onion skin enabled by default', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={1}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle onion skin/i });
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should toggle onion skin when button clicked', async () => {
      const frames = createMockFrames(4);
      const user = userEvent.setup();
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={1}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle onion skin/i });
      expect(button).toHaveAttribute('aria-pressed', 'true');

      await user.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Anchor Overlay Toggle (AC #3)', () => {
    it('should have anchor toggle button', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={1}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByRole('button', { name: /toggle anchor overlay/i })).toBeInTheDocument();
    });

    it('should have anchor overlay disabled by default', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={1}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle anchor overlay/i });
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should toggle anchor overlay when button clicked', async () => {
      const frames = createMockFrames(4);
      const user = userEvent.setup();
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={1}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle anchor overlay/i });
      expect(button).toHaveAttribute('aria-pressed', 'false');

      await user.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Baseline Guide Toggle (AC #4)', () => {
    it('should have baseline toggle button', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      expect(screen.getByRole('button', { name: /toggle baseline guide/i })).toBeInTheDocument();
    });

    it('should have baseline guide enabled by default', () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle baseline guide/i });
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should toggle baseline when button clicked', async () => {
      const frames = createMockFrames(4);
      const user = userEvent.setup();
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle baseline guide/i });
      await user.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should zoom in with + key', async () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const select = screen.getByRole('combobox', { name: /zoom level/i });
      expect(select).toHaveValue('4'); // Default

      fireEvent.keyDown(window, { key: '+' });

      await waitFor(() => {
        expect(select).toHaveValue('8');
      });
    });

    it('should zoom out with - key', async () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const select = screen.getByRole('combobox', { name: /zoom level/i });
      expect(select).toHaveValue('4'); // Default

      fireEvent.keyDown(window, { key: '-' });

      await waitFor(() => {
        expect(select).toHaveValue('2');
      });
    });

    it('should toggle onion skin with O key', async () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={1}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle onion skin/i });
      expect(button).toHaveAttribute('aria-pressed', 'true');

      fireEvent.keyDown(window, { key: 'o' });

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-pressed', 'false');
      });
    });

    it('should toggle anchor overlay with A key', async () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={1}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle anchor overlay/i });
      expect(button).toHaveAttribute('aria-pressed', 'false');

      fireEvent.keyDown(window, { key: 'a' });

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-pressed', 'true');
      });
    });

    it('should toggle baseline guide with B key', async () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      const button = screen.getByRole('button', { name: /toggle baseline guide/i });
      expect(button).toHaveAttribute('aria-pressed', 'true');

      fireEvent.keyDown(window, { key: 'b' });

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });

  describe('Canvas Rendering', () => {
    it('should call canvas getContext', async () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      await waitFor(() => {
        expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
      });
    });

    it('should clear canvas before rendering', async () => {
      const frames = createMockFrames(4);
      render(
        <Stage
          frames={frames}
          selectedFrameIndex={0}
          anchorAnalysis={mockAnchorAnalysis}
        />
      );

      await waitFor(() => {
        expect(mockCanvasContext.clearRect).toHaveBeenCalled();
      });
    });
  });
});

describe('StageToolbar Component (Story 7.3)', () => {
  it('should render all zoom options', () => {
    const onZoomChange = vi.fn();
    render(
      <StageToolbar
        zoomLevel={4}
        onZoomChange={onZoomChange}
        showOnionSkin={true}
        onToggleOnionSkin={() => {}}
        showAnchor={false}
        onToggleAnchor={() => {}}
        showBaseline={true}
        onToggleBaseline={() => {}}
      />
    );

    const select = screen.getByRole('combobox', { name: /zoom level/i });
    expect(select).toContainHTML('<option value="1">1x</option>');
    expect(select).toContainHTML('<option value="2">2x</option>');
    expect(select).toContainHTML('<option value="4">4x</option>');
    expect(select).toContainHTML('<option value="8">8x</option>');
  });

  it('should call onZoomChange when zoom selector changes', async () => {
    const onZoomChange = vi.fn();
    const user = userEvent.setup();
    render(
      <StageToolbar
        zoomLevel={4}
        onZoomChange={onZoomChange}
        showOnionSkin={true}
        onToggleOnionSkin={() => {}}
        showAnchor={false}
        onToggleAnchor={() => {}}
        showBaseline={true}
        onToggleBaseline={() => {}}
      />
    );

    const select = screen.getByRole('combobox', { name: /zoom level/i });
    await user.selectOptions(select, '2');
    expect(onZoomChange).toHaveBeenCalledWith(2);
  });

  it('should call toggle callbacks when buttons clicked', async () => {
    const onToggleOnionSkin = vi.fn();
    const onToggleAnchor = vi.fn();
    const onToggleBaseline = vi.fn();
    const user = userEvent.setup();

    render(
      <StageToolbar
        zoomLevel={4}
        onZoomChange={() => {}}
        showOnionSkin={true}
        onToggleOnionSkin={onToggleOnionSkin}
        showAnchor={false}
        onToggleAnchor={onToggleAnchor}
        showBaseline={true}
        onToggleBaseline={onToggleBaseline}
      />
    );

    await user.click(screen.getByRole('button', { name: /toggle onion skin/i }));
    expect(onToggleOnionSkin).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /toggle anchor overlay/i }));
    expect(onToggleAnchor).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /toggle baseline guide/i }));
    expect(onToggleBaseline).toHaveBeenCalled();
  });

  it('should show active state for enabled toggles', () => {
    render(
      <StageToolbar
        zoomLevel={4}
        onZoomChange={() => {}}
        showOnionSkin={true}
        onToggleOnionSkin={() => {}}
        showAnchor={true}
        onToggleAnchor={() => {}}
        showBaseline={false}
        onToggleBaseline={() => {}}
      />
    );

    const onionButton = screen.getByRole('button', { name: /toggle onion skin/i });
    const anchorButton = screen.getByRole('button', { name: /toggle anchor overlay/i });
    const baselineButton = screen.getByRole('button', { name: /toggle baseline guide/i });

    // CSS modules mangle class names, check for partial match
    expect(onionButton.className).toMatch(/active/i);
    expect(anchorButton.className).toMatch(/active/i);
    expect(baselineButton.className).not.toMatch(/active/i);
  });

  it('should have proper ARIA attributes', () => {
    render(
      <StageToolbar
        zoomLevel={4}
        onZoomChange={() => {}}
        showOnionSkin={true}
        onToggleOnionSkin={() => {}}
        showAnchor={false}
        onToggleAnchor={() => {}}
        showBaseline={true}
        onToggleBaseline={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /toggle onion skin/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /toggle anchor overlay/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: /toggle baseline guide/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
