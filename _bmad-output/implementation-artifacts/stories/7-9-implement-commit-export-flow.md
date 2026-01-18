# Story 7.9: Implement Commit and Export Flow

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to finalize my review and save all changes,
**So that** the approved frames proceed to atlas export.

---

## Acceptance Criteria

### Commit Functionality

1. **Delta application** - All Human Alignment Deltas applied to pixel data
2. **Patched frames** - Patched frames use their corrected versions
3. **Approved folder** - Final images written to `runs/{run_id}/approved/`
4. **Session marked** - `director_session.json` marked as committed
5. **Server close** - Director Server closes after commit
6. **CLI continues** - CLI continues to export phase
7. **Success message** - Shows count of approved frames

---

## Tasks / Subtasks

- [ ] **Task 1: Create Commit API endpoint** (AC: #1, #2, #3)
  - [ ] 1.1: Create `POST /api/commit` Express route
  - [ ] 1.2: Load session state
  - [ ] 1.3: Process all frames with overrides
  - [ ] 1.4: Return success/failure response

- [ ] **Task 2: Implement alignment delta application** (AC: #1)
  - [ ] 2.1: For each frame with alignment delta, apply offset
  - [ ] 2.2: Use Sharp to translate image
  - [ ] 2.3: Handle edge cases (clipping at boundaries)
  - [ ] 2.4: Maintain transparency

- [ ] **Task 3: Implement patched frame handling** (AC: #2)
  - [ ] 3.1: Check isPatched flag for each frame
  - [ ] 3.2: Use latest patched version from patchHistory
  - [ ] 3.3: Verify patched file exists
  - [ ] 3.4: Handle missing patched files gracefully

- [ ] **Task 4: Write final frames to approved/** (AC: #3)
  - [ ] 4.1: Create/verify approved folder exists
  - [ ] 4.2: Write each processed frame with correct naming
  - [ ] 4.3: Use 4-digit padding (frame_0000.png)
  - [ ] 4.4: Verify write success for each file

- [ ] **Task 5: Update session status** (AC: #4)
  - [ ] 5.1: Set session.status = 'committed'
  - [ ] 5.2: Record commit timestamp
  - [ ] 5.3: Record frame counts (approved, patched, nudged)
  - [ ] 5.4: Save session atomically

- [ ] **Task 6: Implement server shutdown** (AC: #5)
  - [ ] 6.1: Send shutdown signal after commit
  - [ ] 6.2: Close all connections gracefully
  - [ ] 6.3: Wait for pending writes to complete
  - [ ] 6.4: Release port

- [ ] **Task 7: Implement CLI continuation** (AC: #6)
  - [ ] 7.1: Detect commit completion in CLI
  - [ ] 7.2: Signal export phase to begin
  - [ ] 7.3: Pass run ID to exporter
  - [ ] 7.4: Handle commit failure gracefully

- [ ] **Task 8: Implement success UI** (AC: #7)
  - [ ] 8.1: Create CommitSuccess component
  - [ ] 8.2: Show approved frame count
  - [ ] 8.3: Show summary (nudged, patched counts)
  - [ ] 8.4: Show "Exporting..." message before close

- [ ] **Task 9: Write tests** (AC: all)
  - [ ] 9.1: Test alignment deltas applied correctly
  - [ ] 9.2: Test patched frames used
  - [ ] 9.3: Test files written to approved/
  - [ ] 9.4: Test session marked committed

---

## Dev Notes

### Commit API Endpoint

```typescript
// src/server/routes/commit.ts
import { Router } from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs-extra';
import { DirectorSessionManager } from '../../core/director-session-manager';
import { logger } from '../../core/logger';

const router = Router();

interface CommitResponse {
  success: boolean;
  approvedCount?: number;
  nudgedCount?: number;
  patchedCount?: number;
  error?: string;
}

router.post('/commit', async (req, res) => {
  try {
    const session = await DirectorSessionManager.getActive();
    if (!session) {
      return res.status(400).json({
        success: false,
        error: 'No active Director session'
      });
    }

    const approvedDir = path.join(session.runPath, 'approved');
    await fs.ensureDir(approvedDir);

    let approvedCount = 0;
    let nudgedCount = 0;
    let patchedCount = 0;

    // Process each frame
    for (const [frameIndex, frame] of session.frames) {
      const finalPath = path.join(
        approvedDir,
        `frame_${String(frameIndex).padStart(4, '0')}.png`
      );

      let imageBuffer: Buffer;

      // Determine source image
      if (frame.directorOverrides.isPatched) {
        // Use latest patched version
        const latestPatch = frame.directorOverrides.patchHistory.at(-1);
        if (!latestPatch) {
          throw new Error(`Frame ${frameIndex} marked as patched but no patch history`);
        }
        imageBuffer = await fs.readFile(latestPatch.patchedPath);
        patchedCount++;
      } else {
        // Use session image
        imageBuffer = Buffer.from(frame.imageBase64!, 'base64');
      }

      // Apply alignment delta if present
      if (frame.directorOverrides.alignment) {
        imageBuffer = await applyAlignmentDelta(
          imageBuffer,
          frame.directorOverrides.alignment
        );
        nudgedCount++;
      }

      // Write to approved folder
      await fs.writeFile(finalPath, imageBuffer);
      approvedCount++;

      logger.info({
        event: 'frame_committed',
        frameIndex,
        path: finalPath,
        nudged: !!frame.directorOverrides.alignment,
        patched: frame.directorOverrides.isPatched
      });
    }

    // Update session status
    await session.markCommitted({
      approvedCount,
      nudgedCount,
      patchedCount,
      timestamp: new Date().toISOString()
    });

    // Schedule server shutdown
    setTimeout(() => {
      process.emit('DIRECTOR_COMMIT_COMPLETE' as any);
    }, 1000);

    return res.json({
      success: true,
      approvedCount,
      nudgedCount,
      patchedCount
    });

  } catch (error) {
    logger.error({ event: 'commit_error', error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Commit failed'
    });
  }
});

async function applyAlignmentDelta(
  imageBuffer: Buffer,
  delta: HumanAlignmentDelta
): Promise<Buffer> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Cannot read image dimensions');
  }

  // Create canvas with translated image
  const offsetX = delta.userOverrideX;
  const offsetY = delta.userOverrideY;

  return sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{
      input: imageBuffer,
      left: Math.max(0, offsetX),
      top: Math.max(0, offsetY),
      blend: 'over'
    }])
    .png()
    .toBuffer();
}

export default router;
```

### CommitButton Component

```tsx
// ui/src/components/CommitButton/CommitButton.tsx
import React, { useState } from 'react';
import { useDirectorSession } from '../../hooks/useDirectorSession';
import styles from './CommitButton.module.css';

export const CommitButton: React.FC = () => {
  const { frames, hasUncommittedChanges } = useDirectorSession();
  const [isCommitting, setIsCommitting] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);

  const handleCommit = async () => {
    // Count approved frames
    const approvedFrames = Array.from(frames.values()).filter(
      f => f.status === 'APPROVED'
    );

    if (approvedFrames.length === 0) {
      alert('No approved frames to commit');
      return;
    }

    // Confirm
    const confirmed = confirm(
      `Commit ${approvedFrames.length} approved frames?\n\n` +
      `This will finalize your changes and proceed to atlas export.`
    );

    if (!confirmed) return;

    setIsCommitting(true);

    try {
      const response = await fetch('/api/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        // UI will close after delay
      } else {
        alert(`Commit failed: ${data.error}`);
      }
    } catch (error) {
      alert(`Commit error: ${error}`);
    } finally {
      setIsCommitting(false);
    }
  };

  if (result) {
    return (
      <div className={styles.success}>
        <h2>✅ Commit Complete!</h2>
        <ul>
          <li>Approved frames: {result.approvedCount}</li>
          <li>Nudged: {result.nudgedCount}</li>
          <li>Patched: {result.patchedCount}</li>
        </ul>
        <p className={styles.exporting}>
          🚀 Proceeding to atlas export...
        </p>
      </div>
    );
  }

  return (
    <button
      className={styles.commitButton}
      onClick={handleCommit}
      disabled={isCommitting}
    >
      {isCommitting ? (
        <>⏳ Committing...</>
      ) : (
        <>✓ Commit & Export</>
      )}
    </button>
  );
};
```

### CLI Integration

```typescript
// src/commands/pipeline/gen.ts (interactive mode section)
if (options.interactive) {
  logger.info({ event: 'launching_director', runId });

  const server = await startDirectorServer(runPath, runId);

  console.log('\n🎬 Director Mode');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`👉 Open http://localhost:${server.port} to review and patch sprites.`);
  console.log('   Press Ctrl+C to cancel (changes will be lost).');
  console.log('═══════════════════════════════════════════════════════\n');

  // Wait for commit signal
  await new Promise<void>((resolve) => {
    process.on('DIRECTOR_COMMIT_COMPLETE', () => {
      logger.info({ event: 'director_committed', runId });
      server.close();
      resolve();
    });

    process.on('SIGINT', () => {
      console.log('\n⚠️ Director cancelled. Changes were not saved.');
      server.close();
      process.exit(0);
    });
  });

  console.log('\n✅ Director session committed. Continuing to export...\n');
}

// Continue to export phase
await runExportPhase(runId, options);
```

### Session Commit Status

```typescript
interface DirectorSession {
  // ... existing fields
  status: 'active' | 'committed' | 'discarded';
  commitInfo?: {
    approvedCount: number;
    nudgedCount: number;
    patchedCount: number;
    timestamp: string;
  };
}

// In DirectorSessionManager
async markCommitted(info: CommitInfo): Promise<void> {
  this.session.status = 'committed';
  this.session.commitInfo = info;
  this.session.lastModified = new Date().toISOString();

  await this.saveSession();
}
```

### CSS Styles

```css
/* CommitButton.module.css */
.commitButton {
  position: fixed;
  bottom: 120px;  /* Above timeline */
  right: 20px;
  background: linear-gradient(135deg, #44cc44, #33aa33);
  color: #fff;
  border: none;
  padding: 16px 32px;
  border-radius: 8px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(68, 204, 68, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}

.commitButton:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(68, 204, 68, 0.4);
}

.commitButton:disabled {
  background: #666;
  cursor: not-allowed;
}

.success {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #1a1a1a;
  border: 2px solid #44cc44;
  border-radius: 12px;
  padding: 32px 48px;
  text-align: center;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.success h2 {
  color: #44cc44;
  margin: 0 0 16px 0;
}

.success ul {
  list-style: none;
  padding: 0;
  margin: 0 0 16px 0;
  text-align: left;
}

.success li {
  color: #aaa;
  margin: 8px 0;
}

.exporting {
  color: #4488ff;
  font-size: 14px;
  animation: pulse 1s ease infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Project Structure Notes

- New: `src/server/routes/commit.ts`
- New: `ui/src/components/CommitButton/CommitButton.tsx`
- New: `ui/src/components/CommitButton/CommitButton.module.css`
- Modify: `src/core/director-session-manager.ts` (add markCommitted)
- Modify: `src/server/index.ts` (add commit route)
- Modify: `src/commands/pipeline/gen.ts` (handle commit signal)
- Tests: `test/server/routes/commit.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.9]
- [Source: _bmad-output/project-context.md#Atomic Writes]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Backend commit logic with Sharp image manipulation, session state updates, CLI integration, and server shutdown coordination. Complex multi-system integration requiring careful orchestration.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
