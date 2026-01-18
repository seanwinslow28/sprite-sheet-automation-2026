# Story 7.7: Implement Inspector Pane with Audit Details

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to see why the Auditor flagged a frame,
**So that** I can make informed decisions about fixes.

---

## Acceptance Criteria

### Inspector Display

1. **Audit score** - Displays composite quality score (0.0-1.0)
2. **Flags list** - Shows list of triggered codes (SF01, HF03, etc.)
3. **Metrics breakdown** - Shows SSIM, Palette %, Baseline Drift, Orphan Count
4. **Prompt display** - Shows exact prompt that generated this frame
5. **Attempt history** - Shows previous attempts with their scores
6. **Flag descriptions** - Clicking a flag shows its description from Reason Code reference

---

## Tasks / Subtasks

- [ ] **Task 1: Create Inspector component structure** (AC: #1-5)
  - [ ] 1.1: Create `ui/src/components/Inspector/Inspector.tsx`
  - [ ] 1.2: Create sidebar layout (right side of Director UI)
  - [ ] 1.3: Add collapsible sections for each data type
  - [ ] 1.4: Style with dark theme consistent with Director

- [ ] **Task 2: Implement Audit Score section** (AC: #1)
  - [ ] 2.1: Create `ScoreDisplay` component
  - [ ] 2.2: Show composite score as percentage
  - [ ] 2.3: Add color coding (green ≥0.8, yellow ≥0.6, red <0.6)
  - [ ] 2.4: Show score bar visualization

- [ ] **Task 3: Implement Flags section** (AC: #2, #6)
  - [ ] 3.1: Create `FlagsList` component
  - [ ] 3.2: Display each flag as a clickable chip
  - [ ] 3.3: Color code by severity (hard=red, soft=yellow)
  - [ ] 3.4: Show flag description on click/hover

- [ ] **Task 4: Implement Metrics Breakdown section** (AC: #3)
  - [ ] 4.1: Create `MetricsBreakdown` component
  - [ ] 4.2: Display SSIM with threshold indicator
  - [ ] 4.3: Display Palette Fidelity percentage
  - [ ] 4.4: Display Baseline Drift in pixels
  - [ ] 4.5: Display Orphan Pixel count

- [ ] **Task 5: Implement Prompt section** (AC: #4)
  - [ ] 5.1: Create `PromptDisplay` component
  - [ ] 5.2: Show full prompt text in scrollable area
  - [ ] 5.3: Add copy-to-clipboard button
  - [ ] 5.4: Truncate with "Show more" toggle

- [ ] **Task 6: Implement Attempt History section** (AC: #5)
  - [ ] 6.1: Create `AttemptHistory` component
  - [ ] 6.2: List all attempts chronologically
  - [ ] 6.3: Show score and status for each attempt
  - [ ] 6.4: Allow clicking to view attempt details

- [ ] **Task 7: Create Reason Code reference** (AC: #6)
  - [ ] 7.1: Create `reasonCodes.ts` with all codes and descriptions
  - [ ] 7.2: Create tooltip/modal for code details
  - [ ] 7.3: Include solution suggestions
  - [ ] 7.4: Link to operator guide

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test Inspector renders with frame data
  - [ ] 8.2: Test flags are clickable
  - [ ] 8.3: Test metrics display correctly
  - [ ] 8.4: Test attempt history navigation

---

## Dev Notes

### Inspector Component

```tsx
// ui/src/components/Inspector/Inspector.tsx
import React, { useState } from 'react';
import { DirectorFrameState } from '../../types/director-session';
import { ScoreDisplay } from './ScoreDisplay';
import { FlagsList } from './FlagsList';
import { MetricsBreakdown } from './MetricsBreakdown';
import { PromptDisplay } from './PromptDisplay';
import { AttemptHistory } from './AttemptHistory';
import styles from './Inspector.module.css';

interface InspectorProps {
  frame: DirectorFrameState | null;
}

export const Inspector: React.FC<InspectorProps> = ({ frame }) => {
  if (!frame) {
    return (
      <div className={styles.inspector}>
        <div className={styles.placeholder}>
          Select a frame to view details
        </div>
      </div>
    );
  }

  const { auditReport, attemptHistory } = frame;

  return (
    <div className={styles.inspector}>
      <h2 className={styles.header}>
        Frame {String(frame.frameIndex).padStart(2, '0')} Inspector
      </h2>

      <section className={styles.section}>
        <h3>Audit Score</h3>
        <ScoreDisplay score={auditReport?.composite_score ?? 0} />
      </section>

      <section className={styles.section}>
        <h3>Flags ({auditReport?.flags?.length ?? 0})</h3>
        <FlagsList flags={auditReport?.flags ?? []} />
      </section>

      <section className={styles.section}>
        <h3>Metrics Breakdown</h3>
        <MetricsBreakdown metrics={auditReport?.metrics} />
      </section>

      <section className={styles.section}>
        <h3>Generation Prompt</h3>
        <PromptDisplay prompt={auditReport?.prompt_used ?? 'No prompt recorded'} />
      </section>

      <section className={styles.section}>
        <h3>Attempt History ({attemptHistory?.length ?? 0})</h3>
        <AttemptHistory attempts={attemptHistory ?? []} />
      </section>
    </div>
  );
};
```

### ScoreDisplay Component

```tsx
// ui/src/components/Inspector/ScoreDisplay.tsx
import React from 'react';
import styles from './ScoreDisplay.module.css';

interface ScoreDisplayProps {
  score: number;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score }) => {
  const percentage = Math.round(score * 100);
  const color = score >= 0.8 ? '#44cc44' : score >= 0.6 ? '#ffcc00' : '#ff4444';

  return (
    <div className={styles.container}>
      <div className={styles.scoreValue} style={{ color }}>
        {percentage}%
      </div>
      <div className={styles.scoreBar}>
        <div
          className={styles.scoreFill}
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <div className={styles.label}>
        {score >= 0.8 ? 'Good' : score >= 0.6 ? 'Marginal' : 'Poor'}
      </div>
    </div>
  );
};
```

### FlagsList Component

```tsx
// ui/src/components/Inspector/FlagsList.tsx
import React, { useState } from 'react';
import { REASON_CODES, ReasonCode } from '../../data/reasonCodes';
import styles from './FlagsList.module.css';

interface FlagsListProps {
  flags: string[];
}

export const FlagsList: React.FC<FlagsListProps> = ({ flags }) => {
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);

  if (flags.length === 0) {
    return <div className={styles.noFlags}>No flags - all checks passed</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.flagsGrid}>
        {flags.map((flag) => {
          const codeInfo = REASON_CODES[flag as ReasonCode];
          const isHard = flag.startsWith('HF');

          return (
            <button
              key={flag}
              className={`${styles.flag} ${isHard ? styles.hard : styles.soft}`}
              onClick={() => setSelectedFlag(selectedFlag === flag ? null : flag)}
            >
              {flag}
            </button>
          );
        })}
      </div>

      {selectedFlag && (
        <div className={styles.flagDetail}>
          <h4>{selectedFlag}</h4>
          <p className={styles.name}>
            {REASON_CODES[selectedFlag as ReasonCode]?.name ?? 'Unknown'}
          </p>
          <p className={styles.description}>
            {REASON_CODES[selectedFlag as ReasonCode]?.description}
          </p>
          <p className={styles.solution}>
            <strong>Solution:</strong> {REASON_CODES[selectedFlag as ReasonCode]?.solution}
          </p>
        </div>
      )}
    </div>
  );
};
```

### MetricsBreakdown Component

```tsx
// ui/src/components/Inspector/MetricsBreakdown.tsx
import React from 'react';
import styles from './MetricsBreakdown.module.css';

interface Metrics {
  ssim?: number;
  palette_fidelity?: number;
  baseline_drift?: number;
  orphan_pixels?: number;
}

interface MetricsBreakdownProps {
  metrics?: Metrics;
}

export const MetricsBreakdown: React.FC<MetricsBreakdownProps> = ({ metrics }) => {
  if (!metrics) {
    return <div className={styles.noMetrics}>No metrics available</div>;
  }

  const rows = [
    {
      label: 'SSIM (Identity)',
      value: metrics.ssim,
      threshold: 0.80,
      format: (v: number) => v.toFixed(3),
    },
    {
      label: 'Palette Fidelity',
      value: metrics.palette_fidelity,
      threshold: 0.75,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    {
      label: 'Baseline Drift',
      value: metrics.baseline_drift,
      threshold: 3,
      format: (v: number) => `${v}px`,
      inverse: true, // Lower is better
    },
    {
      label: 'Orphan Pixels',
      value: metrics.orphan_pixels,
      threshold: 15,
      format: (v: number) => String(v),
      inverse: true,
    },
  ];

  return (
    <div className={styles.container}>
      {rows.map((row) => {
        const value = row.value ?? 0;
        const passing = row.inverse
          ? value <= row.threshold
          : value >= row.threshold;

        return (
          <div key={row.label} className={styles.row}>
            <span className={styles.label}>{row.label}</span>
            <span className={`${styles.value} ${passing ? styles.pass : styles.fail}`}>
              {row.format(value)}
            </span>
            <span className={styles.threshold}>
              (threshold: {row.inverse ? '≤' : '≥'}{row.format(row.threshold)})
            </span>
          </div>
        );
      })}
    </div>
  );
};
```

### Reason Codes Reference

```typescript
// ui/src/data/reasonCodes.ts
export type ReasonCode =
  | 'HF01' | 'HF02' | 'HF03' | 'HF04' | 'HF05' | 'HF_IDENTITY_COLLAPSE'
  | 'SF01' | 'SF02' | 'SF03' | 'SF04' | 'SF_ALPHA_HALO' | 'SF_PIXEL_NOISE';

interface ReasonCodeInfo {
  name: string;
  severity: 'hard' | 'soft';
  description: string;
  solution: string;
}

export const REASON_CODES: Record<ReasonCode, ReasonCodeInfo> = {
  HF01: {
    name: 'Dimension Mismatch',
    severity: 'hard',
    description: 'Frame size does not match target canvas size specified in manifest.',
    solution: 'Check canvas.target_size in manifest. Regenerate frame.'
  },
  HF02: {
    name: 'Alpha Missing',
    severity: 'hard',
    description: 'Image lacks an alpha channel for transparency.',
    solution: 'Ensure generator produces PNG with transparency.'
  },
  HF03: {
    name: 'Baseline Drift',
    severity: 'hard',
    description: 'Frame baseline differs from anchor by more than threshold.',
    solution: 'Use Nudge tool to align or regenerate with pose rescue.'
  },
  HF04: {
    name: 'Color Depth',
    severity: 'hard',
    description: 'Image is not 32-bit RGBA format.',
    solution: 'Check generator settings and post-processing.'
  },
  HF05: {
    name: 'File Size',
    severity: 'hard',
    description: 'File size outside expected bounds (too small or too large).',
    solution: 'Investigate for corruption or empty frames.'
  },
  HF_IDENTITY_COLLAPSE: {
    name: 'Identity Collapse',
    severity: 'hard',
    description: 'Two consecutive re-anchor attempts failed. Character identity lost.',
    solution: 'Improve anchor quality or adjust identity threshold.'
  },
  SF01: {
    name: 'Identity Drift',
    severity: 'soft',
    description: 'SSIM score below identity threshold. Character looks different.',
    solution: 'Use identity rescue prompt or re-anchor.'
  },
  SF02: {
    name: 'Palette Drift',
    severity: 'soft',
    description: 'Colors deviate from character palette.',
    solution: 'Use Patch tool to fix colors or tighten negative prompt.'
  },
  SF03: {
    name: 'Baseline Drift (Soft)',
    severity: 'soft',
    description: 'Minor baseline drift detected but within soft limit.',
    solution: 'Review alignment or use Nudge tool.'
  },
  SF04: {
    name: 'Temporal Flicker',
    severity: 'soft',
    description: 'Frame differs too much from adjacent frames for move type.',
    solution: 'Regenerate with tighter prompts or adjust thresholds.'
  },
  SF_ALPHA_HALO: {
    name: 'Alpha Halo',
    severity: 'soft',
    description: 'Fringe or halo artifacts detected around sprite edges.',
    solution: 'Apply post-process cleanup or use Patch tool.'
  },
  SF_PIXEL_NOISE: {
    name: 'Orphan Pixels',
    severity: 'soft',
    description: 'More than 15 isolated pixels detected.',
    solution: 'Regenerate at higher resolution or clean up manually.'
  }
};
```

### CSS Styles

```css
/* Inspector.module.css */
.inspector {
  width: 320px;
  background: #1a1a1a;
  border-left: 1px solid #333;
  overflow-y: auto;
  padding: 16px;
}

.header {
  font-size: 16px;
  color: #fff;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}

.section {
  margin-bottom: 20px;
}

.section h3 {
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  margin: 0 0 8px 0;
}

.placeholder {
  color: #666;
  text-align: center;
  padding: 40px 20px;
  font-style: italic;
}

/* FlagsList.module.css */
.flagsGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.flag {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
  cursor: pointer;
  border: 1px solid;
}

.flag.hard {
  background: rgba(255, 68, 68, 0.2);
  border-color: #ff4444;
  color: #ff6666;
}

.flag.soft {
  background: rgba(255, 204, 0, 0.2);
  border-color: #ffcc00;
  color: #ffdd00;
}

.flagDetail {
  margin-top: 12px;
  padding: 12px;
  background: #222;
  border-radius: 4px;
}

.flagDetail h4 {
  margin: 0 0 4px 0;
  color: #fff;
}

.name {
  color: #aaa;
  margin: 0 0 8px 0;
}

.description {
  color: #888;
  font-size: 13px;
  margin: 0 0 8px 0;
}

.solution {
  color: #44cc44;
  font-size: 13px;
  margin: 0;
}
```

### Project Structure Notes

- New: `ui/src/components/Inspector/Inspector.tsx`
- New: `ui/src/components/Inspector/ScoreDisplay.tsx`
- New: `ui/src/components/Inspector/FlagsList.tsx`
- New: `ui/src/components/Inspector/MetricsBreakdown.tsx`
- New: `ui/src/components/Inspector/PromptDisplay.tsx`
- New: `ui/src/components/Inspector/AttemptHistory.tsx`
- New: `ui/src/data/reasonCodes.ts`
- New: `ui/src/components/Inspector/*.module.css`
- Tests: `ui/src/components/Inspector/__tests__/*.test.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.7]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.6] (Reason codes)

---

## Dev Agent Record

### Agent Model Used

**Cursor**

**Rationale:** UI component for data display with multiple sub-components. Cursor excels at creating well-structured React components with proper styling and layout.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
