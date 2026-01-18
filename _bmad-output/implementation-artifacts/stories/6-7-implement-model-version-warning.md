# Story 6.7: Implement Model Version Warning System

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to be warned when the generator model version changes or is deprecated,
**So that** I can prepare for potential output changes.

---

## Acceptance Criteria

### Version Change Detection

1. **Version tracking** - When model ID/version differs from last recorded run, log warning
2. **Run summary note** - Version change noted in run summary
3. **Deprecation detection** - When model marked as deprecated by API, log warning
4. **Proceed with flags** - Run proceeds but flags are set for operator attention

---

## Tasks / Subtasks

- [ ] **Task 1: Implement version storage** (AC: #1)
  - [ ] 1.1: Store model version in `manifest.lock.json`
  - [ ] 1.2: Create `getLastUsedModelVersion(character, move): string | null`
  - [ ] 1.3: Store in per-character tracking file or global history
  - [ ] 1.4: Include model ID, version string, last used timestamp

- [ ] **Task 2: Implement version comparison** (AC: #1)
  - [ ] 2.1: Create `detectModelVersionChange(current, previous): VersionChangeInfo`
  - [ ] 2.2: Compare model ID and version string
  - [ ] 2.3: Identify if major, minor, or patch change
  - [ ] 2.4: Return change details

- [ ] **Task 3: Implement version change warning** (AC: #1, #2)
  - [ ] 3.1: Log warning at run start if version changed
  - [ ] 3.2: Include previous and current version
  - [ ] 3.3: Add note to run summary
  - [ ] 3.4: Suggest reviewing output quality

- [ ] **Task 4: Implement deprecation detection** (AC: #3)
  - [ ] 4.1: Check model status from API response
  - [ ] 4.2: Detect "deprecated" or "end-of-life" markers
  - [ ] 4.3: Log warning with deprecation date if available
  - [ ] 4.4: Suggest alternative model if provided

- [ ] **Task 5: Implement attention flags** (AC: #4)
  - [ ] 5.1: Add `model_warnings` array to run state
  - [ ] 5.2: Set flags for version change and deprecation
  - [ ] 5.3: Include in run summary
  - [ ] 5.4: Display prominently in inspect command

- [ ] **Task 6: Integrate with doctor command** (AC: #3, #4)
  - [ ] 6.1: Check model status in `pipeline doctor`
  - [ ] 6.2: Report version and deprecation status
  - [ ] 6.3: Warn if using deprecated model
  - [ ] 6.4: Show available alternative models

- [ ] **Task 7: Write tests** (AC: all)
  - [ ] 7.1: Test version change detection
  - [ ] 7.2: Test warning is logged
  - [ ] 7.3: Test run summary includes note
  - [ ] 7.4: Test deprecation detection

---

## Dev Notes

### VersionChangeInfo Interface

```typescript
interface VersionChangeInfo {
  changed: boolean;
  previousVersion?: {
    modelId: string;
    versionString: string;
    lastUsed: string;
  };
  currentVersion: {
    modelId: string;
    versionString: string;
  };
  changeType?: 'model_switch' | 'major' | 'minor' | 'patch';
  deprecation?: {
    isDeprecated: boolean;
    deprecationDate?: string;
    suggestedAlternative?: string;
  };
}
```

### Version History Storage

```json
// .sprite-pipeline/model-history.json
{
  "lastUpdated": "2026-01-18T12:00:00.000Z",
  "characters": {
    "BLAZE": {
      "idle_standard": {
        "modelId": "gemini-2.0-flash-exp",
        "versionString": "2024.01.15",
        "lastUsed": "2026-01-17T10:00:00.000Z",
        "runId": "20260117_blaze_idle_abc123"
      }
    }
  },
  "globalLastModel": {
    "modelId": "gemini-2.0-flash-exp",
    "versionString": "2024.01.15"
  }
}
```

### Version Change Detection

```typescript
async function detectModelVersionChange(
  currentModel: ModelInfo,
  character: string,
  move: string
): Promise<VersionChangeInfo> {
  const history = await loadModelHistory();
  const previous = history.characters[character]?.[move];

  if (!previous) {
    // First run for this character/move
    return {
      changed: false,
      currentVersion: currentModel
    };
  }

  const changed = previous.modelId !== currentModel.modelId ||
                  previous.versionString !== currentModel.versionString;

  if (!changed) {
    return { changed: false, currentVersion: currentModel };
  }

  // Determine change type
  let changeType: VersionChangeInfo['changeType'];
  if (previous.modelId !== currentModel.modelId) {
    changeType = 'model_switch';
  } else {
    // Compare version strings (assume semver-like)
    changeType = compareVersionStrings(previous.versionString, currentModel.versionString);
  }

  return {
    changed: true,
    previousVersion: previous,
    currentVersion: currentModel,
    changeType
  };
}
```

### Warning Messages

```typescript
// Version change warning
logger.warn({
  event: 'model_version_change',
  message: 'Model version changed since last run',
  previous: {
    model: previous.modelId,
    version: previous.versionString,
    lastUsed: previous.lastUsed
  },
  current: {
    model: currentModel.modelId,
    version: currentModel.versionString
  },
  impact: 'Output quality may differ. Consider reviewing results carefully.',
  changeType: 'minor'
});

// Deprecation warning
logger.warn({
  event: 'model_deprecated',
  message: 'Model is marked as deprecated',
  model: currentModel.modelId,
  deprecationDate: '2026-03-01',
  suggestedAlternative: 'gemini-2.5-flash',
  action: 'Consider updating manifest to use newer model'
});
```

### CLI Output

```
⚠️ Model Version Change Detected
═══════════════════════════════════════════════════════

Previous: gemini-2.0-flash-exp (v2024.01.15)
  Last used: 2026-01-17 for BLAZE/idle_standard

Current:  gemini-2.0-flash-exp (v2024.01.20)

Change Type: Minor version update

Impact: Output quality may differ slightly. Consider:
  • Reviewing generated frames carefully
  • Comparing with previous run output
  • Adjusting thresholds if needed

The run will proceed. This information is logged for reference.
═══════════════════════════════════════════════════════
```

### Deprecation Warning Output

```
⚠️ Model Deprecation Warning
═══════════════════════════════════════════════════════

Model: gemini-2.0-flash-exp

Status: DEPRECATED
Sunset Date: 2026-03-01

Suggested Alternative: gemini-2.5-flash

Action Required:
  1. Update manifest generator.model to use new model
  2. Test with sample animation before production runs
  3. Review quality metrics for any differences

The run will proceed with the current model.
═══════════════════════════════════════════════════════
```

### Run Summary Addition

```json
{
  "run_id": "abc123",
  "model_warnings": [
    {
      "type": "version_change",
      "message": "Model version changed from v2024.01.15 to v2024.01.20",
      "severity": "info"
    }
  ],
  "model_info": {
    "id": "gemini-2.0-flash-exp",
    "version": "v2024.01.20",
    "deprecated": false
  }
}
```

### Project Structure Notes

- New: `src/core/model-version-tracker.ts`
- New: `.sprite-pipeline/model-history.json` (gitignored)
- Modify: `src/adapters/gemini-generator-adapter.ts` (extract version info)
- Modify: `src/commands/pipeline/doctor.ts` (add model status check)
- Tests: `test/core/model-version-tracker.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.7]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR14, NFR15]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Version comparison and warning logic is straightforward. File-based history tracking. No complex decision trees.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
