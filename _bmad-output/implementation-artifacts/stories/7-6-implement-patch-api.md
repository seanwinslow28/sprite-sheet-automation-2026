# Story 7.6: Implement Patch API for Corrective Inpainting

Status: review

---

## Story

**As an** operator,
**I want** masked regions sent to the AI for targeted correction,
**So that** I can fix specific details without affecting the rest of the frame.

---

## Acceptance Criteria

### Inpainting Functionality

1. **API payload** - System sends to Gemini Inpaint endpoint: original image (base64), mask image (base64), and prompt
2. **Prompt format** - Prompt structured as: "TASK: Inpaint the masked area. Integrate seamlessly with existing pixel art style. DETAIL: {user_prompt}"
3. **Response handling** - API returns corrected image which replaces current frame
4. **Override tracking** - `directorOverrides.isPatched` set to true after successful patch
5. **History preservation** - Original pre-patch image preserved in patch history
6. **Error handling** - Failure shows error message without losing the mask

---

## Tasks / Subtasks

- [x] **Task 1: Create Patch API endpoint** (AC: #1)
  - [x] 1.1: Create `POST /api/patch` Express route
  - [x] 1.2: Accept frameId, maskBase64, prompt in request body
  - [x] 1.3: Load original image from session state
  - [x] 1.4: Validate all inputs before API call

- [x] **Task 2: Implement Gemini Inpaint call** (AC: #1, #2)
  - [x] 2.1: Create `src/adapters/gemini-inpaint-adapter.ts`
  - [x] 2.2: Format request with image + mask + prompt
  - [x] 2.3: Use Gemini edit mode with mask parameter
  - [x] 2.4: Handle API response and extract image

- [x] **Task 3: Implement prompt formatting** (AC: #2)
  - [x] 3.1: Create inpainting prompt template
  - [x] 3.2: Prepend standard inpainting instructions
  - [x] 3.3: Append user's correction prompt
  - [x] 3.4: Add pixel art style consistency reminder

- [x] **Task 4: Implement response processing** (AC: #3)
  - [x] 4.1: Extract patched image from API response
  - [x] 4.2: Convert to base64 for UI
  - [x] 4.3: Save patched image to candidates folder
  - [x] 4.4: Update session frame state with new image

- [x] **Task 5: Implement history preservation** (AC: #5)
  - [x] 5.1: Save original image path before patch
  - [x] 5.2: Create PatchHistoryEntry with original, patched, mask, prompt
  - [x] 5.3: Add to directorOverrides.patchHistory array
  - [x] 5.4: Support multiple patches per frame

- [x] **Task 6: Update override tracking** (AC: #4)
  - [x] 6.1: Set isPatched = true on successful patch
  - [x] 6.2: Update frame status to APPROVED
  - [x] 6.3: Persist session state immediately
  - [x] 6.4: Notify UI of update

- [x] **Task 7: Implement error handling** (AC: #6)
  - [x] 7.1: Catch API errors gracefully
  - [x] 7.2: Return error message to UI
  - [x] 7.3: Preserve mask state on failure
  - [x] 7.4: Allow retry with modified prompt

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test successful patch flow
  - [x] 8.2: Test history is preserved
  - [x] 8.3: Test error handling preserves mask
  - [x] 8.4: Test multiple patches accumulate history

---

## Dev Notes

### Patch API Endpoint

```typescript
// src/server/routes/patch.ts
import { Router } from 'express';
import { GeminiInpaintAdapter } from '../../adapters/gemini-inpaint-adapter';
import { DirectorSessionManager } from '../../core/director-session-manager';

const router = Router();

interface PatchRequest {
  frameId: string;
  maskBase64: string;
  prompt: string;
}

interface PatchResponse {
  success: boolean;
  patchedImageBase64?: string;
  error?: string;
}

router.post('/patch', async (req, res) => {
  const { frameId, maskBase64, prompt } = req.body as PatchRequest;

  try {
    // Validate inputs
    if (!frameId || !maskBase64 || !prompt) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: frameId, maskBase64, prompt'
      });
    }

    // Get session and frame
    const session = await DirectorSessionManager.getActive();
    const frame = session.getFrame(frameId);
    if (!frame) {
      return res.status(404).json({
        success: false,
        error: `Frame not found: ${frameId}`
      });
    }

    // Call Gemini Inpaint
    const adapter = new GeminiInpaintAdapter();
    const result = await adapter.inpaint({
      originalImage: frame.imageBase64,
      mask: maskBase64,
      prompt: formatInpaintPrompt(prompt)
    });

    if (!result.success) {
      return res.json({
        success: false,
        error: result.error
      });
    }

    // Save patched image
    const patchedPath = await savePatchedImage(session.runPath, frameId, result.imageBase64);

    // Update session state
    await session.updateFrameWithPatch(frameId, {
      originalPath: frame.imagePath,
      patchedPath,
      maskPath: await saveMask(session.runPath, frameId, maskBase64),
      prompt,
      timestamp: new Date().toISOString()
    });

    return res.json({
      success: true,
      patchedImageBase64: result.imageBase64
    });

  } catch (error) {
    logger.error({ event: 'patch_error', frameId, error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

function formatInpaintPrompt(userPrompt: string): string {
  return `TASK: Inpaint the masked area. Integrate seamlessly with existing pixel art style.
STYLE: Maintain exact color palette, pixel density, and shading style of surrounding pixels.
DO NOT: Introduce new colors, change art style, or affect areas outside the mask.
DETAIL: ${userPrompt}`;
}
```

### Gemini Inpaint Adapter

```typescript
// src/adapters/gemini-inpaint-adapter.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Result, ok, err } from '../core/result';

interface InpaintRequest {
  originalImage: string;  // Base64
  mask: string;           // Base64 (black/white)
  prompt: string;
}

interface InpaintResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
}

export class GeminiInpaintAdapter {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
    });
  }

  async inpaint(request: InpaintRequest): Promise<InpaintResult> {
    try {
      // Construct the edit request with mask
      const result = await this.model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: request.originalImage
                }
              },
              {
                inlineData: {
                  mimeType: 'image/png',
                  data: request.mask
                }
              },
              {
                text: request.prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 1.0,  // Deep Think Lock
          topP: 0.95,
          topK: 40,
          responseModalities: ['image']
        }
      });

      // Extract image from response
      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate?.content?.parts) {
        return {
          success: false,
          error: 'No image in response'
        };
      }

      const imagePart = candidate.content.parts.find(
        (p: any) => p.inlineData?.mimeType?.startsWith('image/')
      );

      if (!imagePart?.inlineData?.data) {
        return {
          success: false,
          error: 'No image data in response'
        };
      }

      return {
        success: true,
        imageBase64: imagePart.inlineData.data
      };

    } catch (error) {
      logger.error({ event: 'gemini_inpaint_error', error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API call failed'
      };
    }
  }
}
```

### Patch History Entry

```typescript
interface PatchHistoryEntry {
  originalPath: string;    // Path to pre-patch image
  patchedPath: string;     // Path to patched image
  maskPath: string;        // Path to mask used
  prompt: string;          // User's correction prompt
  timestamp: string;       // ISO timestamp
}

interface DirectorOverrides {
  alignment?: HumanAlignmentDelta;
  isPatched: boolean;
  patchHistory: PatchHistoryEntry[];
  notes?: string;
}
```

### File Storage

```typescript
async function savePatchedImage(
  runPath: string,
  frameId: string,
  imageBase64: string
): Promise<string> {
  const candidatesDir = path.join(runPath, 'candidates');
  const timestamp = Date.now();
  const filename = `${frameId}_patched_${timestamp}.png`;
  const filepath = path.join(candidatesDir, filename);

  const buffer = Buffer.from(imageBase64, 'base64');
  await fs.writeFile(filepath, buffer);

  return filepath;
}

async function saveMask(
  runPath: string,
  frameId: string,
  maskBase64: string
): Promise<string> {
  const auditDir = path.join(runPath, 'audit');
  const timestamp = Date.now();
  const filename = `${frameId}_mask_${timestamp}.png`;
  const filepath = path.join(auditDir, filename);

  const buffer = Buffer.from(maskBase64, 'base64');
  await fs.writeFile(filepath, buffer);

  return filepath;
}
```

### Frontend Integration

```typescript
// ui/src/services/patchService.ts
export async function patchFrame(
  frameId: string,
  maskBase64: string,
  prompt: string
): Promise<{ success: boolean; patchedImageBase64?: string; error?: string }> {
  const response = await fetch('/api/patch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frameId, maskBase64, prompt })
  });

  return response.json();
}
```

### Error Recovery UI

```tsx
// In MaskPenTool after failed patch
{patchError && (
  <div className={styles.errorMessage}>
    <span>⚠️ Patch failed: {patchError}</span>
    <button onClick={() => setPatchError(null)}>
      Dismiss
    </button>
    <button onClick={handleRetryPatch}>
      Retry
    </button>
  </div>
)}
```

### Project Structure Notes

- New: `src/server/routes/patch.ts`
- New: `src/adapters/gemini-inpaint-adapter.ts`
- Modify: `src/core/director-session-manager.ts` (add updateFrameWithPatch)
- Modify: `src/server/index.ts` (add patch route)
- Tests: `test/adapters/gemini-inpaint-adapter.test.ts`
- Tests: `test/server/routes/patch.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.6]
- [Source: _bmad-output/project-context.md#Generator Adapter]

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Backend API with Gemini integration requiring careful prompt engineering and error handling. Complex state management for patch history. Core architectural component needing deep understanding of session state.

### Debug Log References

*(To be filled during implementation)*

### Completion Notes List

- Created `GeminiInpaintAdapter` class with deferred initialization for testability
- Used `Result` type from `config-resolver.js` for consistent error handling
- Prompt format follows AC #2 with TASK/STYLE/DO NOT/DETAIL structure
- `PatchService` coordinates adapter calls, file saves, and session updates
- Files saved with timestamp for uniqueness: `{frameId}_patched_{timestamp}.png`
- Mask saved to audit folder, patched image to candidates folder
- Patch history accumulates across multiple patches per frame
- Tests verify input validation, session state updates, history preservation
- 35 new tests added (17 adapter + 18 service tests)

### File List

- `src/adapters/gemini-inpaint-adapter.ts` (NEW) - Gemini inpaint API adapter
- `src/core/patch-service.ts` (NEW) - Patch workflow service
- `test/adapters/gemini-inpaint-adapter.test.ts` (NEW) - 17 tests
- `test/core/patch-service.test.ts` (NEW) - 18 tests
- `vitest.config.ts` (NEW) - Root vitest config to separate backend/UI tests
