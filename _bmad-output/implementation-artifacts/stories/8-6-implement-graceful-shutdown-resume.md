# Story 8.6: Implement Graceful Shutdown and Resume

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** the CLI to handle interruptions gracefully,
**So that** I don't lose work if I need to stop mid-run.

---

## Acceptance Criteria

### Graceful Shutdown

1. **Shutdown log** - On SIGINT/SIGTERM, logs "Graceful shutdown initiated..."
2. **Frame completion** - Completes current frame if possible
3. **State persistence** - Persists all in-progress state
4. **Connection cleanup** - Closes API connections cleanly
5. **Clean exit** - Exits with code 0

### Resume Capability

6. **State detection** - Running same command detects existing run state
7. **Resume prompt** - Prompts "Resume from Frame N? (Y/n)"
8. **Skip approved** - Skips already-approved frames
9. **Checkpoint continue** - Continues from last checkpoint

---

## Tasks / Subtasks

- [ ] **Task 1: Implement signal handlers** (AC: #1-5)
  - [ ] 1.1: Register SIGINT handler
  - [ ] 1.2: Register SIGTERM handler
  - [ ] 1.3: Set shutdown flag to prevent new operations
  - [ ] 1.4: Log shutdown initiation

- [ ] **Task 2: Implement current operation completion** (AC: #2)
  - [ ] 2.1: Track current operation (generation, audit, etc.)
  - [ ] 2.2: Allow current operation to complete
  - [ ] 2.3: Set timeout for stuck operations (30s)
  - [ ] 2.4: Force shutdown on second signal

- [ ] **Task 3: Implement state persistence on shutdown** (AC: #3)
  - [ ] 3.1: Save current frame progress
  - [ ] 3.2: Save all completed work
  - [ ] 3.3: Mark run as "interrupted"
  - [ ] 3.4: Use atomic writes

- [ ] **Task 4: Implement connection cleanup** (AC: #4)
  - [ ] 4.1: Close Gemini API connections
  - [ ] 4.2: Close Director server if running
  - [ ] 4.3: Close any file handles
  - [ ] 4.4: Cancel pending HTTP requests

- [ ] **Task 5: Implement resume detection** (AC: #6)
  - [ ] 5.1: Check for existing state.json on startup
  - [ ] 5.2: Verify run is resumable (not complete/stopped)
  - [ ] 5.3: Load previous state
  - [ ] 5.4: Handle corrupted state

- [ ] **Task 6: Implement resume prompt** (AC: #7)
  - [ ] 6.1: Create inquirer prompt
  - [ ] 6.2: Show resume option with frame count
  - [ ] 6.3: Allow fresh start option
  - [ ] 6.4: Handle --no-resume flag

- [ ] **Task 7: Implement resume logic** (AC: #8, #9)
  - [ ] 7.1: Skip already-approved frames
  - [ ] 7.2: Restore orchestrator state
  - [ ] 7.3: Continue from checkpoint
  - [ ] 7.4: Log resume information

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test graceful shutdown saves state
  - [ ] 8.2: Test resume detects previous run
  - [ ] 8.3: Test resume skips approved frames
  - [ ] 8.4: Test force shutdown on double signal

---

## Dev Notes

### Signal Handler Implementation

```typescript
// src/core/shutdown-handler.ts
import { PipelineOrchestrator } from './pipeline-orchestrator';
import { logger } from './logger';

let isShuttingDown = false;
let forceShutdownTimeout: NodeJS.Timeout | null = null;

export function registerShutdownHandlers(
  orchestrator: PipelineOrchestrator
): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      // Second signal = force shutdown
      console.log('\n⚠️ Force shutdown requested. Exiting immediately.');
      process.exit(1);
    }

    isShuttingDown = true;
    console.log(`\n🛑 Graceful shutdown initiated (${signal})...`);

    // Set force shutdown timeout
    forceShutdownTimeout = setTimeout(() => {
      console.log('\n⚠️ Shutdown timeout. Forcing exit.');
      process.exit(1);
    }, 30000);

    try {
      // Complete current operation
      console.log('   Completing current frame...');
      await orchestrator.completeCurrentOperation();

      // Persist state
      console.log('   Saving state...');
      await orchestrator.saveShutdownState('interrupted');

      // Cleanup
      console.log('   Closing connections...');
      await orchestrator.cleanup();

      console.log('✔ Shutdown complete. Run can be resumed.');
      clearTimeout(forceShutdownTimeout);
      process.exit(0);

    } catch (error) {
      logger.error({ event: 'shutdown_error', error });
      console.error('⚠️ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export function isShutdownInProgress(): boolean {
  return isShuttingDown;
}
```

### Resume Detection

```typescript
// src/core/resume-detector.ts
import fs from 'fs-extra';
import path from 'path';
import inquirer from 'inquirer';

interface ResumeInfo {
  runId: string;
  runPath: string;
  lastFrame: number;
  approvedCount: number;
  totalFrames: number;
}

export async function detectResumableRun(
  character: string,
  move: string
): Promise<ResumeInfo | null> {
  const runsDir = 'runs';

  // Find matching runs
  const entries = await fs.readdir(runsDir, { withFileTypes: true });

  for (const entry of entries.reverse()) { // Most recent first
    if (!entry.isDirectory()) continue;

    const runPath = path.join(runsDir, entry.name);
    const statePath = path.join(runPath, 'state.json');

    if (!(await fs.pathExists(statePath))) continue;

    try {
      const state = await fs.readJson(statePath);

      // Check if this run matches and is resumable
      if (state.phase === 'COMPLETE' || state.phase === 'STOPPED') continue;

      // Check if it matches our character/move
      const lockPath = path.join(runPath, 'manifest.lock.json');
      if (await fs.pathExists(lockPath)) {
        const lock = await fs.readJson(lockPath);
        if (lock.identity?.character?.toLowerCase() !== character.toLowerCase()) continue;
        if (!entry.name.includes(move.replace(/_/g, '-'))) continue;
      }

      return {
        runId: entry.name,
        runPath,
        lastFrame: state.currentFrameIndex,
        approvedCount: state.approvedFrames?.length ?? 0,
        totalFrames: state.totalFrames ?? 8
      };
    } catch {
      // Corrupted state, skip
      continue;
    }
  }

  return null;
}

export async function promptResume(info: ResumeInfo): Promise<boolean> {
  console.log('');
  console.log('📂 Found existing run:');
  console.log(`   Run ID: ${info.runId}`);
  console.log(`   Progress: ${info.approvedCount}/${info.totalFrames} frames approved`);
  console.log(`   Last active: Frame ${info.lastFrame}`);
  console.log('');

  const { resume } = await inquirer.prompt([{
    type: 'confirm',
    name: 'resume',
    message: `Resume from Frame ${info.lastFrame}?`,
    default: true
  }]);

  return resume;
}
```

### Orchestrator Resume Methods

```typescript
// In PipelineOrchestrator class
async resumeFrom(state: PipelineState): Promise<void> {
  this.state = state;
  this.runPath = path.join('runs', state.runId);

  // Reload dependencies
  this.stateManager = new StateManager(this.runPath);

  // Load anchor analysis
  const analysisPath = path.join(this.runPath, 'anchor_analysis.json');
  this.anchorAnalysis = await fs.readJson(analysisPath);

  logger.info({
    event: 'pipeline_resumed',
    runId: state.runId,
    fromFrame: state.currentFrameIndex,
    approvedFrames: state.approvedFrames.length
  });
}

async completeCurrentOperation(): Promise<void> {
  if (this.currentOperation) {
    try {
      // Wait for current operation with timeout
      await Promise.race([
        this.currentOperation,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), 10000)
        )
      ]);
    } catch {
      // Log but continue shutdown
      logger.warn({ event: 'operation_abandoned_on_shutdown' });
    }
  }
}

async saveShutdownState(reason: string): Promise<void> {
  this.state.shutdownReason = reason;
  this.state.shutdownTime = new Date().toISOString();
  await this.saveState();
}

async cleanup(): Promise<void> {
  // Close generator adapter (cancels pending API calls)
  await this.generator.close();

  // Close any open file handles
  // (handled by fs-extra automatically on process exit)
}
```

### Command Integration

```typescript
// In gen command
async function executeGen(options: GenOptions): Promise<void> {
  // Check for resumable run
  const resumeInfo = await detectResumableRun(
    manifest.identity.character,
    options.move
  );

  let orchestrator: PipelineOrchestrator;

  if (resumeInfo && !options.noResume) {
    const shouldResume = await promptResume(resumeInfo);

    if (shouldResume) {
      orchestrator = new PipelineOrchestrator(manifest, options.move);
      await orchestrator.resumeFrom(resumeInfo);
      console.log(`\n✔ Resuming run from frame ${resumeInfo.lastFrame}...\n`);
    } else {
      // Start fresh
      orchestrator = new PipelineOrchestrator(manifest, options.move);
      await orchestrator.initialize();
    }
  } else {
    orchestrator = new PipelineOrchestrator(manifest, options.move);
    await orchestrator.initialize();
  }

  // Register shutdown handlers
  registerShutdownHandlers(orchestrator);

  // Continue with generation...
}
```

### Console Output

**Shutdown:**
```
^C
🛑 Graceful shutdown initiated (SIGINT)...
   Completing current frame...
   Saving state...
   Closing connections...
✔ Shutdown complete. Run can be resumed.
```

**Resume prompt:**
```
📂 Found existing run:
   Run ID: 20260118_blaze_idle_abc123
   Progress: 4/8 frames approved
   Last active: Frame 5

? Resume from Frame 5? (Y/n)
```

### Project Structure Notes

- New: `src/core/shutdown-handler.ts`
- New: `src/core/resume-detector.ts`
- Modify: `src/core/pipeline-orchestrator.ts` (add resume methods)
- Modify: `src/commands/gen.ts` (add resume detection)
- Dependencies: inquirer
- Tests: `test/core/shutdown-handler.test.ts`
- Tests: `test/core/resume-detector.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.6]
- [Source: _bmad-output/project-context.md#NFR6-11] (Reliability)

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Signal handling, process lifecycle, and state recovery logic. Complex async flow with timeouts and graceful degradation. Requires deep understanding of Node.js process model.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
