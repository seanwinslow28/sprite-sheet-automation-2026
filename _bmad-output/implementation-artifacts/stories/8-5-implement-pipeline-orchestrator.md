# Story 8.5: Implement Pipeline Orchestrator

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** a central orchestrator managing the generate-audit-align loop,
**So that** the pipeline executes reliably with proper state management.

---

## Acceptance Criteria

### Execution Phases

1. **INIT phase** - Load manifest, create lock file, analyze anchor
2. **GENERATION LOOP** - For each frame: Generate, Audit, Auto-align, Decide (Approve/Retry/Reject)
3. **DIRECTOR MODE** - If `--interactive`, serve UI and wait
4. **EXPORT phase** - TexturePacker + Phaser validation
5. **COMPLETE phase** - Write summary, clean up

### State Management

6. **State persistence** - State persisted to `state.json` after each phase
7. **Resume capability** - Orchestrator can resume from any phase

---

## Tasks / Subtasks

- [ ] **Task 1: Create PipelineOrchestrator class** (AC: #1-5)
  - [ ] 1.1: Create `src/core/pipeline-orchestrator.ts`
  - [ ] 1.2: Define phase enum and state interface
  - [ ] 1.3: Implement constructor with manifest and move
  - [ ] 1.4: Create phase execution methods

- [ ] **Task 2: Implement INIT phase** (AC: #1)
  - [ ] 2.1: Validate manifest against schema
  - [ ] 2.2: Create run folder structure
  - [ ] 2.3: Generate manifest.lock.json
  - [ ] 2.4: Analyze anchor image
  - [ ] 2.5: Initialize state.json

- [ ] **Task 3: Implement GENERATION LOOP** (AC: #2)
  - [ ] 3.1: Create frame generation loop
  - [ ] 3.2: Call generator adapter for each frame
  - [ ] 3.3: Run audit on generated frame
  - [ ] 3.4: Check for auto-alignment need
  - [ ] 3.5: Decide approve/retry/reject

- [ ] **Task 4: Implement auto-alignment** (AC: #2)
  - [ ] 4.1: Detect HF03 baseline drift
  - [ ] 4.2: Apply contact patch alignment
  - [ ] 4.3: Mark as auto-aligned in state
  - [ ] 4.4: Continue to approval

- [ ] **Task 5: Implement DIRECTOR MODE phase** (AC: #3)
  - [ ] 5.1: Check for interactive flag
  - [ ] 5.2: Start Director server
  - [ ] 5.3: Wait for commit
  - [ ] 5.4: Handle cancel/timeout

- [ ] **Task 6: Implement EXPORT phase** (AC: #4)
  - [ ] 6.1: Prepare frames for export
  - [ ] 6.2: Run TexturePacker
  - [ ] 6.3: Run Phaser validation
  - [ ] 6.4: Handle validation results

- [ ] **Task 7: Implement state persistence** (AC: #6, #7)
  - [ ] 7.1: Save state after each phase
  - [ ] 7.2: Use atomic writes
  - [ ] 7.3: Include current phase and progress
  - [ ] 7.4: Support resume detection

- [ ] **Task 8: Write tests** (AC: all)
  - [ ] 8.1: Test full pipeline execution
  - [ ] 8.2: Test phase transitions
  - [ ] 8.3: Test state persistence
  - [ ] 8.4: Test resume from checkpoint

---

## Dev Notes

### PipelineOrchestrator Class

```typescript
// src/core/pipeline-orchestrator.ts
import { Manifest } from '../domain/types/manifest';
import { GeminiGeneratorAdapter } from '../adapters/gemini-generator-adapter';
import { AuditorService } from '../core/auditor-service';
import { ContactPatchAligner } from '../core/contact-patch-aligner';
import { StateManager } from '../core/state-manager';
import { AnchorAnalyzer } from '../core/anchor-analyzer';
import { logger } from './logger';

export type PipelinePhase =
  | 'INIT'
  | 'GENERATING'
  | 'DIRECTOR_MODE'
  | 'EXPORTING'
  | 'COMPLETE'
  | 'STOPPED';

interface PipelineState {
  runId: string;
  phase: PipelinePhase;
  currentFrameIndex: number;
  approvedFrames: number[];
  rejectedFrames: number[];
  startTime: string;
  lastUpdate: string;
}

interface FrameResult {
  status: 'approved' | 'retrying' | 'rejected';
  score?: number;
  reason?: string;
  attempt?: number;
  autoAligned?: boolean;
  driftPixels?: number;
}

export class PipelineOrchestrator {
  private manifest: Manifest;
  private moveName: string;
  private state: PipelineState;
  private runPath: string;
  private generator: GeminiGeneratorAdapter;
  private auditor: AuditorService;
  private aligner: ContactPatchAligner;
  private stateManager: StateManager;
  private anchorAnalysis: AnchorAnalysis | null = null;

  constructor(manifest: Manifest, moveName: string) {
    this.manifest = manifest;
    this.moveName = moveName;
    this.generator = new GeminiGeneratorAdapter(manifest);
    this.auditor = new AuditorService(manifest);
    this.aligner = new ContactPatchAligner();
  }

  async initialize(): Promise<string> {
    // Generate run ID
    const runId = this.generateRunId();
    this.runPath = path.join('runs', runId);

    // Create folder structure
    await this.createRunFolders();

    // Create manifest lock
    await this.createManifestLock();

    // Analyze anchor
    this.anchorAnalysis = await this.analyzeAnchor();

    // Initialize state
    this.state = {
      runId,
      phase: 'INIT',
      currentFrameIndex: 0,
      approvedFrames: [],
      rejectedFrames: [],
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };

    this.stateManager = new StateManager(this.runPath);
    await this.saveState();

    logger.info({ event: 'pipeline_initialized', runId });
    return runId;
  }

  async generateFrame(frameIndex: number): Promise<FrameResult> {
    this.state.phase = 'GENERATING';
    this.state.currentFrameIndex = frameIndex;

    const moveConfig = this.manifest.moves[this.moveName];
    const maxAttempts = moveConfig.generator.max_attempts_per_frame;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Generate
      const candidate = await this.generator.generate({
        frameIndex,
        attemptIndex: attempt,
        anchorAnalysis: this.anchorAnalysis!,
        previousFrame: this.getLastApprovedFrame()
      });

      // Audit
      const auditResult = await this.auditor.audit(candidate, {
        anchorAnalysis: this.anchorAnalysis!,
        frameIndex
      });

      // Check hard failures
      if (auditResult.hardFailure) {
        if (attempt === maxAttempts) {
          this.state.rejectedFrames.push(frameIndex);
          await this.saveState();
          return {
            status: 'rejected',
            reason: auditResult.failureCode
          };
        }
        continue; // Retry
      }

      // Check for drift that needs auto-alignment
      if (auditResult.flags.includes('HF03_BASELINE_DRIFT')) {
        const aligned = await this.aligner.align(
          candidate.imagePath,
          this.anchorAnalysis!
        );

        this.state.approvedFrames.push(frameIndex);
        await this.saveState();

        return {
          status: 'approved',
          score: auditResult.compositeScore,
          autoAligned: true,
          driftPixels: aligned.driftCorrection
        };
      }

      // Check soft failures
      if (!auditResult.passed) {
        if (attempt === maxAttempts) {
          // Accept anyway or reject based on threshold
          if (auditResult.compositeScore >= 0.6) {
            this.state.approvedFrames.push(frameIndex);
            await this.saveState();
            return {
              status: 'approved',
              score: auditResult.compositeScore
            };
          }
          this.state.rejectedFrames.push(frameIndex);
          await this.saveState();
          return {
            status: 'rejected',
            reason: auditResult.failureCode
          };
        }
        return {
          status: 'retrying',
          attempt: attempt + 1
        };
      }

      // Passed!
      this.state.approvedFrames.push(frameIndex);
      await this.saveState();

      return {
        status: 'approved',
        score: auditResult.compositeScore
      };
    }

    // Should never reach here
    return { status: 'rejected', reason: 'MAX_ATTEMPTS_EXCEEDED' };
  }

  async launchDirectorMode(): Promise<void> {
    this.state.phase = 'DIRECTOR_MODE';
    await this.saveState();

    // Server launch handled by gen command
    // This just updates state
  }

  async runExport(options: ExportOptions): Promise<void> {
    this.state.phase = 'EXPORTING';
    await this.saveState();

    // Export logic delegated to export service
    const exporter = new ExportService(this.runPath, this.manifest);
    await exporter.run(options);
  }

  async complete(): Promise<void> {
    this.state.phase = 'COMPLETE';
    this.state.lastUpdate = new Date().toISOString();
    await this.saveState();

    // Generate summary
    await this.generateSummary();

    logger.info({
      event: 'pipeline_complete',
      runId: this.state.runId,
      approved: this.state.approvedFrames.length,
      rejected: this.state.rejectedFrames.length
    });
  }

  getRunPath(): string {
    return this.runPath;
  }

  getFrameCount(): number {
    return this.manifest.moves[this.moveName].identity.frame_count;
  }

  setFrameCount(count: number): void {
    this.manifest.moves[this.moveName].identity.frame_count = count;
  }

  private async saveState(): Promise<void> {
    this.state.lastUpdate = new Date().toISOString();
    await this.stateManager.save(this.state);
  }

  private generateRunId(): string {
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const char = this.manifest.identity.character.toLowerCase();
    const move = this.moveName.replace(/_/g, '-');
    const suffix = Math.random().toString(36).substring(2, 8);
    return `${date}_${char}_${move}_${suffix}`;
  }

  private async createRunFolders(): Promise<void> {
    const folders = [
      'approved', 'rejected', 'candidates',
      'audit', 'logs', 'export', 'validation'
    ];
    for (const folder of folders) {
      await fs.ensureDir(path.join(this.runPath, folder));
    }
  }

  private async analyzeAnchor(): Promise<AnchorAnalysis> {
    const analyzer = new AnchorAnalyzer();
    return analyzer.analyze(this.manifest.inputs.anchor);
  }

  private getLastApprovedFrame(): string | null {
    if (this.state.approvedFrames.length === 0) return null;
    const lastIndex = this.state.approvedFrames[this.state.approvedFrames.length - 1];
    return path.join(this.runPath, 'approved', `frame_${String(lastIndex).padStart(4, '0')}.png`);
  }
}
```

### Phase State Machine

```
┌─────────┐
│  INIT   │
└────┬────┘
     │
     ▼
┌──────────────┐
│  GENERATING  │◄──────────┐
└──────┬───────┘           │
       │                   │
       ▼                   │
  [Frame Loop]  ───────────┘
       │
       │ (All frames done)
       ▼
┌──────────────┐    ┌──────────────┐
│ DIRECTOR_MODE│───►│  EXPORTING   │
│ (optional)   │    └──────┬───────┘
└──────────────┘           │
                           ▼
                    ┌─────────────┐
                    │  COMPLETE   │
                    └─────────────┘
```

### State File Format

```json
{
  "runId": "20260118_blaze_idle_abc123",
  "phase": "GENERATING",
  "currentFrameIndex": 3,
  "approvedFrames": [0, 1, 2],
  "rejectedFrames": [],
  "startTime": "2026-01-18T14:00:00.000Z",
  "lastUpdate": "2026-01-18T14:05:30.000Z"
}
```

### Resume Detection

```typescript
async function detectExistingRun(manifest: Manifest, move: string): Promise<PipelineState | null> {
  // Look for existing runs matching manifest
  const runsDir = 'runs';
  const pattern = `*_${manifest.identity.character.toLowerCase()}_${move}_*`;

  const matches = await glob(path.join(runsDir, pattern, 'state.json'));

  for (const stateFile of matches) {
    const state = await fs.readJson(stateFile);
    if (state.phase !== 'COMPLETE' && state.phase !== 'STOPPED') {
      return state;
    }
  }

  return null;
}
```

### Project Structure Notes

- New: `src/core/pipeline-orchestrator.ts`
- Integrates: StateManager (Story 4.8)
- Integrates: GeminiGeneratorAdapter (Story 2.3)
- Integrates: AuditorService (Epic 3)
- Integrates: ContactPatchAligner (Story 2.7)
- Tests: `test/core/pipeline-orchestrator.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.5]
- [Source: _bmad-output/implementation-artifacts/stories/4-8] (State Machine)

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Central orchestration component integrating all pipeline systems. Complex state management, phase transitions, and error handling. Requires deep understanding of entire pipeline architecture.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
