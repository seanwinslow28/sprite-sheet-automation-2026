# Story 5.2: Implement TexturePacker Integration with Locked Settings

Status: done

---

## Story

**As an** operator,
**I want** TexturePacker invoked with locked CLI flags,
**So that** atlas output is deterministic and game-compatible.

---

## Acceptance Criteria

### TexturePacker Integration

1. **Locked CLI flags** - CLI called with exact flags: `--format phaser --trim-mode Trim --extrude 1 --shape-padding 2 --border-padding 2 --disable-rotation --alpha-handling ReduceBorderArtifacts --max-size 2048 --trim-sprite-names --prepend-folder-name`
2. **Execa execution** - Command executed via Execa with cross-platform safety
3. **Upstream preservation** - TexturePacker failure does not invalidate approved frames (NFR23)
4. **Log capture** - stdout/stderr captured to run logs

### Error Handling

5. **Exit code handling** - Non-zero exit code triggers error with captured output
6. **Timeout handling** - Long-running packs have timeout protection
7. **Missing binary** - Clear error if TexturePacker not installed

---

## Tasks / Subtasks

- [x] **Task 1: Create TexturePacker adapter** (AC: #1, #2)
  - [x] 1.1: Create `src/adapters/texturepacker-adapter.ts`
  - [x] 1.2: Define `LOCKED_FLAGS` constant with all required flags
  - [x] 1.3: Implement `packAtlas(inputDir: string, outputPath: string): Promise<Result<PackResult, SystemError>>`
  - [x] 1.4: Use Execa with `{ shell: false }` for safety

- [x] **Task 2: Implement CLI flag construction** (AC: #1)
  - [x] 2.1: Build flag array: `['--format', 'phaser', '--trim-mode', 'Trim', ...]`
  - [x] 2.2: Add input directory as last positional argument
  - [x] 2.3: Add output path with `--data` and `--sheet` flags
  - [x] 2.4: Log full command for debugging (redact sensitive paths if needed)

- [x] **Task 3: Implement output capture** (AC: #4)
  - [x] 3.1: Capture stdout and stderr from Execa
  - [x] 3.2: Write to `runs/{run_id}/logs/texturepacker.log`
  - [x] 3.3: Include timestamp and command in log
  - [x] 3.4: Parse output for warnings/errors

- [x] **Task 4: Implement error handling** (AC: #3, #5)
  - [x] 4.1: Check exit code: 0 = success, non-zero = error
  - [x] 4.2: On error, create `DEP_TEXTUREPACKER_FAIL` SystemError
  - [x] 4.3: Include captured stderr in error message
  - [x] 4.4: Ensure approved frames remain intact (do not delete)

- [x] **Task 5: Implement timeout protection** (AC: #6)
  - [x] 5.1: Set Execa timeout to 120 seconds (configurable)
  - [x] 5.2: On timeout, kill process and return error
  - [x] 5.3: Log timeout with duration and file count
  - [x] 5.4: Suggest splitting into multiple packs if timeout

- [x] **Task 6: Implement binary detection** (AC: #7)
  - [x] 6.1: Check if `TexturePacker` exists in PATH
  - [x] 6.2: Run `TexturePacker --version` to verify
  - [x] 6.3: On missing, return clear error with install instructions
  - [x] 6.4: Integrate with `pipeline doctor` (Story 1.2)

- [x] **Task 7: Implement cross-platform support** (AC: #2)
  - [x] 7.1: Handle path separators (Windows vs Unix)
  - [x] 7.2: Use `path.join()` for all path construction
  - [x] 7.3: Test on Windows, macOS, Linux
  - [x] 7.4: Handle spaces in paths with proper quoting

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test successful pack with sample frames
  - [x] 8.2: Test error handling on invalid input
  - [x] 8.3: Test timeout triggers correctly
  - [x] 8.4: Test missing binary detection
  - [x] 8.5: Mock Execa for unit tests

---

## Dev Notes

### Locked CLI Flags

```typescript
const LOCKED_FLAGS: string[] = [
  '--format', 'phaser',
  '--trim-mode', 'Trim',
  '--extrude', '1',
  '--shape-padding', '2',
  '--border-padding', '2',
  '--disable-rotation',
  '--alpha-handling', 'ReduceBorderArtifacts',
  '--max-size', '2048',
  '--trim-sprite-names',
  '--prepend-folder-name',
];
```

### TexturePacker Adapter Interface

```typescript
interface TexturePackerAdapter {
  packAtlas(
    inputDir: string,
    outputPath: string,
    options?: PackOptions
  ): Promise<Result<PackResult, SystemError>>;

  verifyInstallation(): Promise<Result<VersionInfo, SystemError>>;
}

interface PackResult {
  atlasPath: string;    // Path to .json
  sheetPath: string;    // Path to .png
  frameCount: number;
  sheetCount: number;   // >1 for multipack
  duration_ms: number;
}

interface PackOptions {
  timeout_ms?: number;  // Default: 120000
  maxSize?: number;     // Override max-size (not recommended)
}
```

### Full Command Construction

```typescript
async function packAtlas(
  inputDir: string,
  outputPath: string
): Promise<Result<PackResult, SystemError>> {
  const jsonPath = outputPath.replace('.png', '.json');
  const pngPath = outputPath;

  const args = [
    ...LOCKED_FLAGS,
    '--data', jsonPath,
    '--sheet', pngPath,
    inputDir
  ];

  logger.debug({
    event: 'texturepacker_invoke',
    command: 'TexturePacker',
    args: args.join(' ')
  });

  try {
    const result = await execa('TexturePacker', args, {
      timeout: 120000,
      shell: false,
      reject: false
    });

    if (result.exitCode !== 0) {
      return Result.err({
        code: 'DEP_TEXTUREPACKER_FAIL',
        message: `TexturePacker failed with exit code ${result.exitCode}`,
        details: result.stderr
      });
    }

    return Result.ok({
      atlasPath: jsonPath,
      sheetPath: pngPath,
      frameCount: countFrames(inputDir),
      sheetCount: countSheets(pngPath),
      duration_ms: result.duration
    });
  } catch (error) {
    if (error.timedOut) {
      return Result.err({
        code: 'DEP_TEXTUREPACKER_TIMEOUT',
        message: 'TexturePacker timed out after 120 seconds'
      });
    }
    throw error;
  }
}
```

### TexturePacker Log Format

```
================================================================================
TexturePacker Execution Log
================================================================================
Timestamp: 2026-01-18T14:30:00.000Z
Run ID: abc123
Input: runs/abc123/export_staging/
Output: runs/abc123/export/blaze_idle

Command:
TexturePacker --format phaser --trim-mode Trim --extrude 1 --shape-padding 2 \
  --border-padding 2 --disable-rotation --alpha-handling ReduceBorderArtifacts \
  --max-size 2048 --trim-sprite-names --prepend-folder-name \
  --data runs/abc123/export/blaze_idle.json \
  --sheet runs/abc123/export/blaze_idle.png \
  runs/abc123/export_staging/

================================================================================
stdout:
================================================================================
Loading sprites from: runs/abc123/export_staging/
Processing 8 sprites...
Creating texture atlas: runs/abc123/export/blaze_idle.png (256x128)
Writing JSON: runs/abc123/export/blaze_idle.json
Done in 1.23 seconds.

================================================================================
stderr:
================================================================================
(empty)

================================================================================
Exit Code: 0
Duration: 1234ms
================================================================================
```

### Error Recovery Pattern

```typescript
// On TexturePacker failure:
// 1. Log the error
// 2. Keep approved frames intact (NFR23)
// 3. Return error to CLI
// 4. Operator can fix issue and re-run export only

if (packResult.isErr()) {
  logger.error({
    event: 'texturepacker_failed',
    error: packResult.error.message,
    details: packResult.error.details
  });

  // DO NOT delete approved frames
  // They are still valid and can be packed again

  return Result.err(packResult.error);
}
```

### Project Structure Notes

- New: `src/adapters/texturepacker-adapter.ts`
- New: `src/domain/interfaces/texturepacker.ts`
- Integrates with: Story 5.1 (frame naming), Story 5.3 (atlas output)
- Tests: `test/adapters/texturepacker-adapter.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2]
- [Source: Agentic-Sprite-Sheet-Deep-Research/Phaser3_Export_Compliance_Kit.md#TexturePacker CLI]
- [Source: _bmad-output/project-context.md#Subprocess Execution Rules]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Execa subprocess with locked CLI flags is a clear, well-defined contract. Cross-platform path handling follows established patterns. No complex decision logic.

### Debug Log References

- Code review completed 2026-01-19
- Fixed ExecaError.code access pattern for Execa v9+ compatibility

### Completion Notes List

- All 8 tasks completed
- isENOENT() helper for cross-version error detection
- LOCKED_TEXTUREPACKER_FLAGS constant with all required flags
- packAtlasWithLogging() for full run folder integration
- Multipack support enabled by default with {n} placeholder
- 19 tests passing

### File List

- `src/adapters/texturepacker-adapter.ts` - TexturePacker CLI wrapper
- `test/adapters/texturepacker-adapter.test.ts` - Unit tests

### Completion Date

2026-01-19
