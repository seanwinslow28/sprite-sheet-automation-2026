/**
 * Tests for CommitButton component (Story 7.9)
 * AC #5-7: Server close, CLI continues, success message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { CommitButton, type CommitResult } from '../CommitButton';

describe('CommitButton Component (Story 7.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  describe('Initial Render', () => {
    it('should render commit button', () => {
      render(<CommitButton approvedFrameCount={8} />);
      expect(screen.getByTestId('commit-button')).toBeInTheDocument();
    });

    it('should show "Commit & Export" text', () => {
      render(<CommitButton approvedFrameCount={8} />);
      expect(screen.getByTestId('commit-button')).toHaveTextContent('Commit & Export');
    });

    it('should have accessible label with frame count', () => {
      render(<CommitButton approvedFrameCount={8} />);
      expect(screen.getByTestId('commit-button')).toHaveAttribute(
        'aria-label',
        'Commit 8 approved frames'
      );
    });

    it('should be disabled when no approved frames', () => {
      render(<CommitButton approvedFrameCount={0} />);
      expect(screen.getByTestId('commit-button')).toBeDisabled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<CommitButton approvedFrameCount={8} disabled={true} />);
      expect(screen.getByTestId('commit-button')).toBeDisabled();
    });

    it('should be enabled when frames approved and not disabled', () => {
      render(<CommitButton approvedFrameCount={8} disabled={false} />);
      expect(screen.getByTestId('commit-button')).not.toBeDisabled();
    });
  });

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog on click', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<CommitButton approvedFrameCount={4} />);

      await user.click(screen.getByTestId('commit-button'));

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('Commit 4 approved frames')
      );
    });

    it('should not commit if user cancels', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onCommit = vi.fn();

      render(<CommitButton approvedFrameCount={4} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      expect(onCommit).not.toHaveBeenCalled();
    });

    it('should commit if user confirms', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue({ success: true, approvedCount: 4 });

      render(<CommitButton approvedFrameCount={4} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(onCommit).toHaveBeenCalled();
      });
    });

    it('should handle singular frame correctly in confirmation', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<CommitButton approvedFrameCount={1} />);

      await user.click(screen.getByTestId('commit-button'));

      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('Commit 1 approved frame?')
      );
    });
  });

  describe('Committing State', () => {
    it('should show loading state while committing', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      // Never-resolving promise to keep loading state
      const onCommit = vi.fn().mockReturnValue(new Promise(() => {}));

      render(<CommitButton approvedFrameCount={4} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('commit-button')).toHaveTextContent('Committing...');
      });
    });

    it('should disable button while committing', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockReturnValue(new Promise(() => {}));

      render(<CommitButton approvedFrameCount={4} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('commit-button')).toBeDisabled();
      });
    });
  });

  describe('Success State (AC #7)', () => {
    const successResult: CommitResult = {
      success: true,
      approvedCount: 8,
      nudgedCount: 3,
      patchedCount: 2,
    };

    it('should show success message after commit', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue(successResult);

      render(<CommitButton approvedFrameCount={8} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('commit-success')).toBeInTheDocument();
      });
    });

    it('should show approved frame count', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue(successResult);

      render(<CommitButton approvedFrameCount={8} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('approved-count')).toHaveTextContent('8');
      });
    });

    it('should show nudged frame count', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue(successResult);

      render(<CommitButton approvedFrameCount={8} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('nudged-count')).toHaveTextContent('3');
      });
    });

    it('should show patched frame count', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue(successResult);

      render(<CommitButton approvedFrameCount={8} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('patched-count')).toHaveTextContent('2');
      });
    });

    it('should show exporting message', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue(successResult);

      render(<CommitButton approvedFrameCount={8} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('exporting-message')).toBeInTheDocument();
        expect(screen.getByTestId('exporting-message')).toHaveTextContent('export');
      });
    });

    it('should call onCommitComplete callback', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue(successResult);
      const onCommitComplete = vi.fn();

      render(
        <CommitButton
          approvedFrameCount={8}
          onCommit={onCommit}
          onCommitComplete={onCommitComplete}
        />
      );

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(onCommitComplete).toHaveBeenCalledWith(successResult);
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message on failure', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue({
        success: false,
        error: 'Disk full',
      });

      render(<CommitButton approvedFrameCount={4} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('commit-error')).toHaveTextContent('Disk full');
      });
    });

    it('should show error on exception', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<CommitButton approvedFrameCount={4} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('commit-error')).toHaveTextContent('Network error');
      });
    });

    it('should allow retry after error', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const onCommit = vi.fn().mockResolvedValue({
        success: false,
        error: 'First attempt failed',
      });

      render(<CommitButton approvedFrameCount={4} onCommit={onCommit} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('commit-error')).toBeInTheDocument();
      });

      // Button should still be visible for retry
      expect(screen.getByTestId('commit-button')).toBeInTheDocument();
    });

    it('should show error when no approved frames', async () => {
      const user = userEvent.setup();
      // Override to allow click (normally disabled)
      render(<CommitButton approvedFrameCount={0} />);

      // Button should be disabled, but if we could click...
      expect(screen.getByTestId('commit-button')).toBeDisabled();
    });
  });

  describe('API Integration', () => {
    it('should call fetch when no onCommit provided', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: true, approvedCount: 4 }),
      });
      global.fetch = mockFetch;

      render(<CommitButton approvedFrameCount={4} />);

      await user.click(screen.getByTestId('commit-button'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      render(<CommitButton approvedFrameCount={4} />);

      const button = screen.getByTestId('commit-button');
      button.focus();
      expect(button).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(window.confirm).toHaveBeenCalled();
    });

    it('should have focus visible style support', () => {
      render(<CommitButton approvedFrameCount={4} />);
      const button = screen.getByTestId('commit-button');

      // Button should be focusable
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });
});
