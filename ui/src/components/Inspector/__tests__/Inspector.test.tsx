/**
 * Tests for Inspector components (Story 7.7)
 * AC #1-6: Score display, flags, metrics, prompt, history, flag descriptions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

import { Inspector, type InspectorFrameData } from '../Inspector';
import { ScoreDisplay } from '../ScoreDisplay';
import { FlagsList } from '../FlagsList';
import { MetricsBreakdown, type AuditMetrics } from '../MetricsBreakdown';
import { PromptDisplay } from '../PromptDisplay';
import { AttemptHistory, type AttemptEntry } from '../AttemptHistory';

describe('Inspector Component (Story 7.7)', () => {
  const mockFrame: InspectorFrameData = {
    frameIndex: 1,
    frameId: 'frame_0001',
    auditReport: {
      compositeScore: 0.75,
      flags: ['SF01', 'HF03'],
      passed: false,
      metrics: {
        ssim: 0.78,
        paletteFidelity: 0.82,
        baselineDrift: 4,
        orphanPixels: 8,
      },
      promptUsed: 'Generate idle pose frame 1 with character facing right',
    },
    attemptHistory: [
      { attemptNumber: 1, score: 0.65, status: 'rejected', reasonCode: 'SF01' },
      { attemptNumber: 2, score: 0.75, status: 'pending' },
    ],
  };

  describe('Main Inspector', () => {
    it('should render placeholder when no frame selected', () => {
      render(<Inspector frame={null} />);
      expect(screen.getByTestId('inspector-placeholder')).toBeInTheDocument();
      expect(screen.getByText(/select a frame/i)).toBeInTheDocument();
    });

    it('should render frame details when frame is selected', () => {
      render(<Inspector frame={mockFrame} />);
      expect(screen.getByText(/Frame 01 Inspector/)).toBeInTheDocument();
    });

    it('should display all sections', () => {
      render(<Inspector frame={mockFrame} />);
      expect(screen.getByText(/Audit Score/)).toBeInTheDocument();
      expect(screen.getByText(/Flags \(2\)/)).toBeInTheDocument();
      expect(screen.getByText(/Metrics Breakdown/)).toBeInTheDocument();
      expect(screen.getByText(/Generation Prompt/)).toBeInTheDocument();
      expect(screen.getByText(/Attempt History \(2\)/)).toBeInTheDocument();
    });

    it('should handle frame with missing audit report', () => {
      const frameNoAudit: InspectorFrameData = {
        frameIndex: 0,
        frameId: 'frame_0000',
      };
      render(<Inspector frame={frameNoAudit} />);
      expect(screen.getByTestId('score-display')).toBeInTheDocument();
      expect(screen.getByTestId('no-flags')).toBeInTheDocument();
    });
  });

  describe('ScoreDisplay (AC #1)', () => {
    it('should display score as percentage', () => {
      render(<ScoreDisplay score={0.85} />);
      expect(screen.getByTestId('score-value')).toHaveTextContent('85%');
    });

    it('should show green for good score (>=0.8)', () => {
      render(<ScoreDisplay score={0.85} />);
      const value = screen.getByTestId('score-value');
      expect(value).toHaveStyle({ color: '#44cc44' });
      expect(screen.getByTestId('score-label')).toHaveTextContent('Good');
    });

    it('should show yellow for marginal score (>=0.6, <0.8)', () => {
      render(<ScoreDisplay score={0.7} />);
      const value = screen.getByTestId('score-value');
      expect(value).toHaveStyle({ color: '#ffcc00' });
      expect(screen.getByTestId('score-label')).toHaveTextContent('Marginal');
    });

    it('should show red for poor score (<0.6)', () => {
      render(<ScoreDisplay score={0.5} />);
      const value = screen.getByTestId('score-value');
      expect(value).toHaveStyle({ color: '#ff4444' });
      expect(screen.getByTestId('score-label')).toHaveTextContent('Poor');
    });

    it('should render score bar with correct width', () => {
      render(<ScoreDisplay score={0.75} />);
      const fill = screen.getByTestId('score-fill');
      expect(fill).toHaveStyle({ width: '75%' });
    });

    it('should round percentage to nearest integer', () => {
      render(<ScoreDisplay score={0.834} />);
      expect(screen.getByTestId('score-value')).toHaveTextContent('83%');
    });
  });

  describe('FlagsList (AC #2, #6)', () => {
    it('should show "no flags" message when empty', () => {
      render(<FlagsList flags={[]} />);
      expect(screen.getByTestId('no-flags')).toBeInTheDocument();
      expect(screen.getByText(/all checks passed/i)).toBeInTheDocument();
    });

    it('should render all flags as buttons', () => {
      render(<FlagsList flags={['SF01', 'HF03', 'SF02']} />);
      expect(screen.getByTestId('flag-SF01')).toBeInTheDocument();
      expect(screen.getByTestId('flag-HF03')).toBeInTheDocument();
      expect(screen.getByTestId('flag-SF02')).toBeInTheDocument();
    });

    it('should style hard fails differently from soft fails', () => {
      render(<FlagsList flags={['SF01', 'HF03']} />);
      const softFlag = screen.getByTestId('flag-SF01');
      const hardFlag = screen.getByTestId('flag-HF03');
      expect(softFlag.className).toMatch(/soft/i);
      expect(hardFlag.className).toMatch(/hard/i);
    });

    it('should show flag detail on click', async () => {
      const user = userEvent.setup();
      render(<FlagsList flags={['SF01']} />);

      await user.click(screen.getByTestId('flag-SF01'));

      expect(screen.getByTestId('flag-detail')).toBeInTheDocument();
      expect(screen.getByText(/Identity Drift/)).toBeInTheDocument();
      expect(screen.getByText(/SSIM score below/)).toBeInTheDocument();
    });

    it('should show solution for selected flag', async () => {
      const user = userEvent.setup();
      render(<FlagsList flags={['HF03']} />);

      await user.click(screen.getByTestId('flag-HF03'));

      expect(screen.getByText(/Solution:/)).toBeInTheDocument();
      expect(screen.getByText(/Use Nudge tool/)).toBeInTheDocument();
    });

    it('should toggle flag detail off when clicking same flag', async () => {
      const user = userEvent.setup();
      render(<FlagsList flags={['SF01']} />);

      await user.click(screen.getByTestId('flag-SF01'));
      expect(screen.getByTestId('flag-detail')).toBeInTheDocument();

      await user.click(screen.getByTestId('flag-SF01'));
      expect(screen.queryByTestId('flag-detail')).not.toBeInTheDocument();
    });

    it('should switch detail when clicking different flag', async () => {
      const user = userEvent.setup();
      render(<FlagsList flags={['SF01', 'SF02']} />);

      await user.click(screen.getByTestId('flag-SF01'));
      expect(screen.getByText(/Identity Drift/)).toBeInTheDocument();

      await user.click(screen.getByTestId('flag-SF02'));
      expect(screen.getByText(/Palette Drift/)).toBeInTheDocument();
    });

    it('should handle unknown flag codes gracefully', async () => {
      const user = userEvent.setup();
      render(<FlagsList flags={['UNKNOWN_CODE']} />);

      await user.click(screen.getByTestId('flag-UNKNOWN_CODE'));
      expect(screen.getByText(/Unknown Flag/)).toBeInTheDocument();
    });
  });

  describe('MetricsBreakdown (AC #3)', () => {
    const metrics: AuditMetrics = {
      ssim: 0.85,
      paletteFidelity: 0.9,
      baselineDrift: 2,
      orphanPixels: 10,
    };

    it('should show "no metrics" when undefined', () => {
      render(<MetricsBreakdown metrics={undefined} />);
      expect(screen.getByTestId('no-metrics')).toBeInTheDocument();
    });

    it('should display SSIM value', () => {
      render(<MetricsBreakdown metrics={metrics} />);
      expect(screen.getByText('0.850')).toBeInTheDocument();
    });

    it('should display Palette Fidelity as percentage', () => {
      render(<MetricsBreakdown metrics={metrics} />);
      expect(screen.getByText('90.0%')).toBeInTheDocument();
    });

    it('should display Baseline Drift in pixels', () => {
      render(<MetricsBreakdown metrics={metrics} />);
      expect(screen.getByText('2px')).toBeInTheDocument();
    });

    it('should display Orphan Pixel count', () => {
      render(<MetricsBreakdown metrics={metrics} />);
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('should show passing values in green', () => {
      const goodMetrics: AuditMetrics = {
        ssim: 0.9,
        paletteFidelity: 0.85,
        baselineDrift: 1,
        orphanPixels: 5,
      };
      render(<MetricsBreakdown metrics={goodMetrics} />);
      const values = screen.getAllByText(/\d/);
      // All values should be passing with these metrics
      expect(screen.getByText('0.900').className).toMatch(/pass/);
    });

    it('should show failing values in red', () => {
      const badMetrics: AuditMetrics = {
        ssim: 0.5,
        paletteFidelity: 0.5,
        baselineDrift: 10,
        orphanPixels: 50,
      };
      render(<MetricsBreakdown metrics={badMetrics} />);
      expect(screen.getByText('0.500').className).toMatch(/fail/);
    });

    it('should show threshold indicators', () => {
      render(<MetricsBreakdown metrics={metrics} />);
      expect(screen.getByText(/(threshold: ≥0.800)/)).toBeInTheDocument();
      expect(screen.getByText(/(threshold: ≤3px)/)).toBeInTheDocument();
    });
  });

  describe('PromptDisplay (AC #4)', () => {
    it('should show "no prompt" message for empty prompt', () => {
      render(<PromptDisplay prompt="No prompt recorded" />);
      expect(screen.getByTestId('no-prompt')).toBeInTheDocument();
    });

    it('should display short prompt fully', () => {
      const shortPrompt = 'Generate frame';
      render(<PromptDisplay prompt={shortPrompt} />);
      expect(screen.getByTestId('prompt-text')).toHaveTextContent(shortPrompt);
    });

    it('should truncate long prompts', () => {
      const longPrompt = 'A'.repeat(300);
      render(<PromptDisplay prompt={longPrompt} />);
      const text = screen.getByTestId('prompt-text').textContent;
      expect(text?.length).toBeLessThan(longPrompt.length);
      expect(text).toContain('...');
    });

    it('should show expand button for long prompts', () => {
      const longPrompt = 'A'.repeat(300);
      render(<PromptDisplay prompt={longPrompt} />);
      expect(screen.getByTestId('expand-button')).toBeInTheDocument();
    });

    it('should expand prompt when clicking "Show more"', async () => {
      const user = userEvent.setup();
      const longPrompt = 'A'.repeat(300);
      render(<PromptDisplay prompt={longPrompt} />);

      await user.click(screen.getByTestId('expand-button'));

      const text = screen.getByTestId('prompt-text').textContent;
      expect(text).not.toContain('...');
      expect(screen.getByText(/Show less/)).toBeInTheDocument();
    });

    it('should have a copy button', () => {
      render(<PromptDisplay prompt="Test prompt" />);
      expect(screen.getByTestId('copy-button')).toBeInTheDocument();
    });

    it('should copy prompt to clipboard on copy click', async () => {
      const user = userEvent.setup();
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(mockWriteText);

      const prompt = 'Test prompt text';
      render(<PromptDisplay prompt={prompt} />);

      await user.click(screen.getByTestId('copy-button'));

      expect(mockWriteText).toHaveBeenCalledWith(prompt);
    });

    it('should show "Copied!" feedback after copy', async () => {
      const user = userEvent.setup();
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      render(<PromptDisplay prompt="Test" />);

      await user.click(screen.getByTestId('copy-button'));

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  describe('AttemptHistory (AC #5)', () => {
    const attempts: AttemptEntry[] = [
      { attemptNumber: 1, score: 0.65, status: 'rejected', reasonCode: 'SF01' },
      { attemptNumber: 2, score: 0.75, status: 'approved' },
    ];

    it('should show "no attempts" when empty', () => {
      render(<AttemptHistory attempts={[]} />);
      expect(screen.getByTestId('no-attempts')).toBeInTheDocument();
    });

    it('should render all attempts', () => {
      render(<AttemptHistory attempts={attempts} />);
      expect(screen.getByTestId('attempt-1')).toBeInTheDocument();
      expect(screen.getByTestId('attempt-2')).toBeInTheDocument();
    });

    it('should display attempt scores as percentages', () => {
      render(<AttemptHistory attempts={attempts} />);
      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should show attempt status', () => {
      render(<AttemptHistory attempts={attempts} />);
      expect(screen.getByText('rejected')).toBeInTheDocument();
      expect(screen.getByText('approved')).toBeInTheDocument();
    });

    it('should show attempt detail on click', async () => {
      const user = userEvent.setup();
      render(<AttemptHistory attempts={attempts} />);

      await user.click(screen.getByTestId('attempt-1'));

      expect(screen.getByTestId('attempt-detail')).toBeInTheDocument();
      expect(screen.getByText('SF01')).toBeInTheDocument();
    });

    it('should toggle detail off when clicking same attempt', async () => {
      const user = userEvent.setup();
      render(<AttemptHistory attempts={attempts} />);

      await user.click(screen.getByTestId('attempt-1'));
      expect(screen.getByTestId('attempt-detail')).toBeInTheDocument();

      await user.click(screen.getByTestId('attempt-1'));
      expect(screen.queryByTestId('attempt-detail')).not.toBeInTheDocument();
    });

    it('should style rejected attempts differently', () => {
      render(<AttemptHistory attempts={attempts} />);
      const rejected = screen.getByTestId('attempt-1');
      expect(rejected.className).toMatch(/rejected/i);
    });

    it('should style approved attempts differently', () => {
      render(<AttemptHistory attempts={attempts} />);
      const approved = screen.getByTestId('attempt-2');
      expect(approved.className).toMatch(/approved/i);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on flag buttons', () => {
      render(<FlagsList flags={['SF01']} />);
      const button = screen.getByTestId('flag-SF01');
      expect(button).toHaveAttribute('aria-label', 'SF01: Identity Drift');
    });

    it('should have proper ARIA on score bar', () => {
      render(<ScoreDisplay score={0.75} />);
      const bar = screen.getByRole('progressbar');
      expect(bar).toHaveAttribute('aria-valuenow', '75');
    });

    it('should have keyboard accessible flag buttons', async () => {
      const user = userEvent.setup();
      render(<FlagsList flags={['SF01']} />);

      const button = screen.getByTestId('flag-SF01');
      button.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByTestId('flag-detail')).toBeInTheDocument();
    });

    it('should indicate expanded state on expand button', async () => {
      const user = userEvent.setup();
      const longPrompt = 'A'.repeat(300);
      render(<PromptDisplay prompt={longPrompt} />);

      const expandButton = screen.getByTestId('expand-button');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      await user.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
