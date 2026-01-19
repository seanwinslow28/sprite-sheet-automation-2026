# Story 8.3: Implement Interactive Mode Flag

Status: done

---

## Story

**As an** operator,
**I want** to optionally launch Director Mode after generation,
**So that** I can review frames before export.

---

## Acceptance Criteria

### Interactive Flag Behavior

1. **Server launch** - After generation completes with `--interactive`, starts Express server on port 3000
2. **Launch message** - Logs "🚀 Launching Director Mode..." and URL
3. **Process alive** - Keeps process alive until Director commits
4. **Manual browser** - Browser can be opened manually
5. **Auto export** - After commit, export proceeds automatically
6. **Non-interactive** - Without `--interactive`, export proceeds immediately

---

## Tasks / Subtasks

- [x] **Task 1: Add interactive flag to gen command** (AC: #6)
  - [x] 1.1: Add `-i, --interactive` option to command
  - [x] 1.2: Store flag in options object
  - [x] 1.3: Document in help text
  - [x] 1.4: Set default to false

- [x] **Task 2: Implement Director launch logic** (AC: #1, #2)
  - [x] 2.1: Check interactive flag after generation
  - [x] 2.2: Start Director server if enabled
  - [x] 2.3: Log launch message with URL
  - [x] 2.4: Handle server start errors

- [x] **Task 3: Implement process keepalive** (AC: #3)
  - [x] 3.1: Create Promise that resolves on commit
  - [x] 3.2: Listen for commit event from server
  - [x] 3.3: Keep CLI process running
  - [x] 3.4: Handle SIGINT/SIGTERM

- [x] **Task 4: Implement commit detection** (AC: #3, #5)
  - [x] 4.1: Set up event listener for commit
  - [x] 4.2: Resolve keepalive Promise on commit
  - [x] 4.3: Log commit confirmation
  - [x] 4.4: Proceed to export phase

- [x] **Task 5: Implement non-interactive path** (AC: #6)
  - [x] 5.1: Skip Director server if not interactive
  - [x] 5.2: Proceed directly to export
  - [x] 5.3: Log appropriate messages
  - [x] 5.4: Maintain consistent exit behavior

- [x] **Task 6: Implement cancel handling** (AC: #3, #4)
  - [x] 6.1: Listen for SIGINT (Ctrl+C)
  - [x] 6.2: Warn about unsaved changes
  - [x] 6.3: Close server gracefully
  - [x] 6.4: Exit with appropriate code

- [x] **Task 7: Add port configuration** (AC: #1)
  - [x] 7.1: Add --port option (default 3000)
  - [x] 7.2: Pass to Director server
  - [x] 7.3: Handle port-in-use errors
  - [x] 7.4: Suggest alternate port on conflict

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test interactive flag launches server
  - [x] 8.2: Test non-interactive skips server
  - [x] 8.3: Test commit triggers export
  - [x] 8.4: Test SIGINT handling

---

## Dev Notes

### Interactive Mode Implementation

```typescript
// In gen command execution
async function executeGen(options: GenOptions): Promise<void> {
  // ... generation logic ...

  // Generation complete, check for interactive mode
  if (options.interactive) {
    await launchDirectorMode(runId, orchestrator.getRunPath());
  }

  // Continue to export (after Director commits or immediately)
  await runExportPhase(runId, {
    skipValidation: options.skipValidation,
    allowValidationFail: options.allowValidationFail
  });
}

async function launchDirectorMode(runId: string, runPath: string): Promise<void> {
  const port = options.port ?? 3000;

  console.log('\n🎬 Director Mode');
  console.log('═══════════════════════════════════════════════════════');

  const server = await startDirectorServer(runPath, runId, port);

  console.log(chalk.cyan(`🚀 Launching Director Mode...`));
  console.log(chalk.cyan(`👉 Open http://localhost:${port} to review and patch sprites.`));
  console.log(chalk.gray(`   Press Ctrl+C to cancel (changes will be lost).`));
  console.log('═══════════════════════════════════════════════════════\n');

  // Wait for commit or cancel
  await waitForCommitOrCancel(server);

  console.log(chalk.green('\n✅ Director session committed. Continuing to export...\n'));
}
```

### Commit Wait Implementation

```typescript
async function waitForCommitOrCancel(server: DirectorServer): Promise<void> {
  return new Promise((resolve, reject) => {
    // Listen for commit event
    const commitHandler = () => {
      cleanup();
      resolve();
    };

    // Listen for cancel (Ctrl+C)
    const cancelHandler = () => {
      console.log(chalk.yellow('\n⚠️ Director cancelled. Changes were not saved.'));
      cleanup();
      server.close();
      process.exit(0);
    };

    // Listen for error
    const errorHandler = (error: Error) => {
      cleanup();
      reject(error);
    };

    // Register handlers
    process.on('DIRECTOR_COMMIT_COMPLETE', commitHandler);
    process.on('SIGINT', cancelHandler);
    process.on('SIGTERM', cancelHandler);
    server.on('error', errorHandler);

    // Cleanup function
    function cleanup() {
      process.removeListener('DIRECTOR_COMMIT_COMPLETE', commitHandler);
      process.removeListener('SIGINT', cancelHandler);
      process.removeListener('SIGTERM', cancelHandler);
      server.removeListener('error', errorHandler);
    }
  });
}
```

### Director Server Wrapper

```typescript
// src/server/director-server.ts
import express from 'express';
import { EventEmitter } from 'events';
import path from 'path';

export class DirectorServer extends EventEmitter {
  private app: express.Application;
  private server: any;
  private port: number;

  constructor(runPath: string, runId: string, port: number = 3000) {
    super();
    this.port = port;
    this.app = express();

    // Configure middleware
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.static(path.join(__dirname, '../../ui/build')));

    // API routes
    this.app.use('/api', createApiRoutes(runPath, runId, this));
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, () => {
        resolve();
      });

      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use. Try --port <number>`));
        } else {
          reject(error);
        }
      });
    });
  }

  close(): void {
    if (this.server) {
      this.server.close();
    }
  }

  emitCommit(): void {
    process.emit('DIRECTOR_COMMIT_COMPLETE' as any);
  }
}

export async function startDirectorServer(
  runPath: string,
  runId: string,
  port: number
): Promise<DirectorServer> {
  const server = new DirectorServer(runPath, runId, port);
  await server.start();
  return server;
}
```

### Console Output Sequence

```
═══════════════════════════════════════════════════════
Batch Generation Complete
═══════════════════════════════════════════════════════
✔ Approved: 7/8
📊 Retry Rate: 12.5%
📁 Output: runs/20260118_blaze_idle_abc123/
═══════════════════════════════════════════════════════

🎬 Director Mode
═══════════════════════════════════════════════════════
🚀 Launching Director Mode...
👉 Open http://localhost:3000 to review and patch sprites.
   Press Ctrl+C to cancel (changes will be lost).
═══════════════════════════════════════════════════════

[... user reviews in browser ...]

✅ Director session committed. Continuing to export...

⠋ Running TexturePacker...
✔ Atlas exported (blaze_idle.png, blaze_idle.json)
⠋ Running Phaser validation...
✔ Validation passed (3/3 tests)

✅ Export Complete!
```

### Port-in-Use Handling

```typescript
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.log(chalk.red(`\n❌ Port ${port} is already in use.`));
    console.log(chalk.yellow(`   Try: banana gen --move=${move} --interactive --port 3001\n`));
    process.exit(1);
  }
});
```

### Command Options

```typescript
.option('-i, --interactive', 'Launch Director Mode for review', false)
.option('--port <number>', 'Director Mode port', parseInt, 3000)
```

### Project Structure Notes

- Modify: `src/commands/gen.ts` (add interactive logic)
- New: `src/server/director-server.ts`
- New: `src/utils/wait-for-commit.ts`
- Tests: `test/commands/gen-interactive.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.9] (commit flow)

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** CLI/server coordination requiring event handling, process lifecycle management, and graceful shutdown. Complex async flow with multiple exit paths.

### Debug Log References

N/A

### Completion Notes List

- -i/--interactive flag launches Director Mode server after generation
- EventEmitter-based coordination between CLI and server
- waitForDirector() promise resolves on commit or close events
- Port configuration with --port flag (default 3000)
- EADDRINUSE error handling with suggestion

### File List

- `src/commands/gen.ts` - Interactive flag handling
- `src/core/director-server.ts` - Server with event emitter
- `test/core/director-server.test.ts` - Server tests
