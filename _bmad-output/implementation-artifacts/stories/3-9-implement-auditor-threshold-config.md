# Story 3.9: Implement Auditor Threshold Configuration

Status: ready-for-dev

---

## Story

**As an** operator,
**I want** to configure auditor thresholds in the manifest,
**So that** I can tune quality gates for different characters or moves.

---

## Acceptance Criteria

### Configuration Reading

1. **Threshold reading** - System reads thresholds from `auditor.thresholds` section in manifest
2. **Supported thresholds** - Reads: `identity_min`, `palette_min`, `alpha_artifact_max`, `baseline_drift_max`, `composite_min`
3. **Default fallback** - Missing thresholds fall back to sensible defaults
4. **Threshold logging** - Effective thresholds are logged at run start
5. **Schema validation** - Threshold values are validated by Zod schema (Story 2.1)

---

## Tasks / Subtasks

- [ ] **Task 1: Define threshold schema** (AC: #2, #5)
  - [ ] 1.1: Add `AuditorThresholdsSchema` to `src/domain/schemas/manifest.ts`
  - [ ] 1.2: Define Zod schema for each threshold with type and range constraints
  - [ ] 1.3: All fields optional (for default fallback)
  - [ ] 1.4: Validate ranges: min 0.0, max 1.0 for percentages; positive integers for pixels

- [ ] **Task 2: Define default values** (AC: #3)
  - [ ] 2.1: Create `src/domain/defaults/auditor-defaults.ts`
  - [ ] 2.2: Define `DEFAULT_AUDITOR_THRESHOLDS` constant
  - [ ] 2.3: Document rationale for each default value
  - [ ] 2.4: Export for use in other modules

- [ ] **Task 3: Implement threshold resolver** (AC: #1, #3)
  - [ ] 3.1: Create `src/core/auditor-config.ts`
  - [ ] 3.2: Implement `resolveThresholds(manifestThresholds?: Partial<AuditorThresholds>): AuditorThresholds`
  - [ ] 3.3: Merge manifest values with defaults
  - [ ] 3.4: Return complete threshold object

- [ ] **Task 4: Implement validation** (AC: #5)
  - [ ] 4.1: Validate identity_min is between 0.0 and 1.0
  - [ ] 4.2: Validate palette_min is between 0.0 and 1.0
  - [ ] 4.3: Validate alpha_artifact_max is between 0.0 and 1.0
  - [ ] 4.4: Validate baseline_drift_max is positive integer (0-100)
  - [ ] 4.5: Validate composite_min is between 0.0 and 1.0
  - [ ] 4.6: Return validation errors with field path

- [ ] **Task 5: Implement logging** (AC: #4)
  - [ ] 5.1: Log effective thresholds at run start
  - [ ] 5.2: Include source of each value (manifest or default)
  - [ ] 5.3: Format as structured JSON for Pino
  - [ ] 5.4: Include in `manifest.lock.json`

- [ ] **Task 6: Write tests** (AC: all)
  - [ ] 6.1: Test reading thresholds from manifest
  - [ ] 6.2: Test default fallback for missing thresholds
  - [ ] 6.3: Test partial manifest overrides
  - [ ] 6.4: Test validation rejects invalid values
  - [ ] 6.5: Test logging output format

---

## Dev Notes

### Manifest Thresholds Section

```yaml
auditor:
  thresholds:
    identity_min: 0.85       # Minimum SSIM score
    palette_min: 0.90        # Minimum palette fidelity
    alpha_artifact_max: 0.20 # Maximum alpha artifact severity
    baseline_drift_max: 4    # Maximum baseline drift in pixels
    composite_min: 0.70      # Minimum composite quality score
```

### AuditorThresholds Interface

```typescript
interface AuditorThresholds {
  identity_min: number;       // 0.0 - 1.0, default 0.85
  palette_min: number;        // 0.0 - 1.0, default 0.90
  alpha_artifact_max: number; // 0.0 - 1.0, default 0.20
  baseline_drift_max: number; // pixels, default 4
  composite_min: number;      // 0.0 - 1.0, default 0.70
}
```

### Default Values with Rationale

```typescript
const DEFAULT_AUDITOR_THRESHOLDS: AuditorThresholds = {
  // SSIM: 0.85 allows for pose variation while catching identity drift
  identity_min: 0.85,

  // Palette: 90% allows for lighting variation, catches color substitution
  palette_min: 0.90,

  // Alpha: 20% allows minor edge artifacts, catches severe halos
  alpha_artifact_max: 0.20,

  // Baseline: 4px at 128px scale (3%) allows for crouch/jump stance
  baseline_drift_max: 4,

  // Composite: 70% overall quality bar for retry decision
  composite_min: 0.70,
};
```

### Zod Schema Definition

```typescript
import { z } from 'zod';

const AuditorThresholdsSchema = z.object({
  identity_min: z.number()
    .min(0.0, "identity_min must be >= 0.0")
    .max(1.0, "identity_min must be <= 1.0")
    .optional(),

  palette_min: z.number()
    .min(0.0, "palette_min must be >= 0.0")
    .max(1.0, "palette_min must be <= 1.0")
    .optional(),

  alpha_artifact_max: z.number()
    .min(0.0, "alpha_artifact_max must be >= 0.0")
    .max(1.0, "alpha_artifact_max must be <= 1.0")
    .optional(),

  baseline_drift_max: z.number()
    .int("baseline_drift_max must be an integer")
    .min(0, "baseline_drift_max must be >= 0")
    .max(100, "baseline_drift_max must be <= 100")
    .optional(),

  composite_min: z.number()
    .min(0.0, "composite_min must be >= 0.0")
    .max(1.0, "composite_min must be <= 1.0")
    .optional(),
}).optional();
```

### Threshold Resolution Logic

```typescript
function resolveThresholds(
  manifestThresholds?: Partial<AuditorThresholds>
): ResolvedThresholds {
  const resolved: ResolvedThresholds = {
    identity_min: {
      value: manifestThresholds?.identity_min ?? DEFAULT_AUDITOR_THRESHOLDS.identity_min,
      source: manifestThresholds?.identity_min !== undefined ? 'manifest' : 'default',
    },
    palette_min: {
      value: manifestThresholds?.palette_min ?? DEFAULT_AUDITOR_THRESHOLDS.palette_min,
      source: manifestThresholds?.palette_min !== undefined ? 'manifest' : 'default',
    },
    // ... repeat for other thresholds
  };

  return resolved;
}

interface ResolvedThresholds {
  [key: string]: {
    value: number;
    source: 'manifest' | 'default';
  };
}
```

### Logging Output Example

```json
{
  "level": "info",
  "msg": "Auditor thresholds resolved",
  "thresholds": {
    "identity_min": { "value": 0.85, "source": "default" },
    "palette_min": { "value": 0.95, "source": "manifest" },
    "alpha_artifact_max": { "value": 0.20, "source": "default" },
    "baseline_drift_max": { "value": 4, "source": "default" },
    "composite_min": { "value": 0.75, "source": "manifest" }
  }
}
```

### Tuning Guidelines for Operators

| Threshold | Lower = | Higher = |
|-----------|---------|----------|
| identity_min | More lenient, allows variation | Stricter, requires exact match |
| palette_min | Allows off-palette colors | Requires strict palette adherence |
| alpha_artifact_max | Stricter, rejects more halos | More lenient with edge artifacts |
| baseline_drift_max | Stricter positioning | Allows more vertical drift |
| composite_min | More frames pass | Higher quality bar |

### Use Cases for Custom Thresholds

1. **Stylized characters:** Lower `identity_min` for exaggerated poses
2. **Limited palette:** Higher `palette_min` for strict color control
3. **Fast animations:** Higher `baseline_drift_max` for dynamic poses
4. **Debug mode:** Lower `composite_min` to see more candidates

### Project Structure Notes

- Threshold schema: `src/domain/schemas/manifest.ts`
- Default values: `src/domain/defaults/auditor-defaults.ts`
- Resolver: `src/core/auditor-config.ts`
- Integration: Used by all metric evaluators in `src/core/metrics/`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.9]
- [Source: _bmad-output/project-context.md#Configuration & Artifacts]

---

## Dev Agent Record

### Agent Model Used

**Codex-CLI**

**Rationale:** Configuration reading and defaults is straightforward. Zod schema definition follows clear patterns. No architectural decisions or complex logic.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

*(To be filled during implementation)*

### File List

*(To be filled during implementation)*
