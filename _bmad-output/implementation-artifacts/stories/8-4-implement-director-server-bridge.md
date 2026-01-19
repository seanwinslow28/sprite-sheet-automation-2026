# Story 8.4: Implement Director Server Bridge

Status: done

---

## Story

**As an** operator,
**I want** the CLI to serve the Director UI and handle API requests,
**So that** the frontend can communicate with the pipeline backend.

---

## Acceptance Criteria

### Server Functionality

1. **Static serving** - Serves static React app from `ui/build/`
2. **Session API** - `GET /api/session` returns current session state (frames, audit reports)
3. **Patch API** - `POST /api/patch` triggers inpainting, returns patched image
4. **Commit API** - `POST /api/commit` saves all changes, closes server
5. **Frame API** - `GET /api/frame/:id` returns specific frame data
6. **Port config** - Server runs on configurable port (default 3000)
7. **Local only** - CORS disabled (local-only usage)

---

## Tasks / Subtasks

- [x] **Task 1: Create Express server** (AC: #1, #6, #7)
  - [x] 1.1: Create `src/server/index.ts`
  - [x] 1.2: Configure Express with JSON middleware
  - [x] 1.3: Serve static files from ui/build
  - [x] 1.4: Configure port from options

- [x] **Task 2: Implement session endpoint** (AC: #2)
  - [x] 2.1: Create `GET /api/session` route
  - [x] 2.2: Load DirectorSession from disk
  - [x] 2.3: Return session with frames and audit data
  - [x] 2.4: Handle session not found

- [x] **Task 3: Implement patch endpoint** (AC: #3)
  - [x] 3.1: Create `POST /api/patch` route
  - [x] 3.2: Accept frameId, maskBase64, prompt
  - [x] 3.3: Call GeminiInpaintAdapter
  - [x] 3.4: Return patched image or error

- [x] **Task 4: Implement commit endpoint** (AC: #4)
  - [x] 4.1: Create `POST /api/commit` route
  - [x] 4.2: Apply all alignment deltas
  - [x] 4.3: Write final frames to approved/
  - [x] 4.4: Signal server shutdown

- [x] **Task 5: Implement frame endpoint** (AC: #5)
  - [x] 5.1: Create `GET /api/frame/:id` route
  - [x] 5.2: Load specific frame data
  - [x] 5.3: Include image base64
  - [x] 5.4: Include audit report

- [x] **Task 6: Implement error handling** (AC: all)
  - [x] 6.1: Add global error handler middleware
  - [x] 6.2: Return consistent error format
  - [x] 6.3: Log errors with context
  - [x] 6.4: Never expose stack traces

- [x] **Task 7: Configure CORS** (AC: #7)
  - [x] 7.1: Disable CORS for local-only usage
  - [x] 7.2: Only allow localhost origins
  - [x] 7.3: Handle preflight requests
  - [x] 7.4: Document security model

- [x] **Task 8: Write tests** (AC: all)
  - [x] 8.1: Test static file serving
  - [x] 8.2: Test session endpoint
  - [x] 8.3: Test patch endpoint
  - [x] 8.4: Test commit endpoint

---

## Dev Notes

### Server Setup

```typescript
// src/server/index.ts
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { sessionRouter } from './routes/session';
import { patchRouter } from './routes/patch';
import { commitRouter } from './routes/commit';
import { frameRouter } from './routes/frame';
import { logger } from '../core/logger';

export function createDirectorServer(
  runPath: string,
  runId: string
): express.Application {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '50mb' })); // Large for base64 images
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    logger.debug({
      event: 'http_request',
      method: req.method,
      path: req.path
    });
    next();
  });

  // Inject context
  app.use((req, res, next) => {
    req.runPath = runPath;
    req.runId = runId;
    next();
  });

  // API routes
  app.use('/api', sessionRouter);
  app.use('/api', patchRouter);
  app.use('/api', commitRouter);
  app.use('/api', frameRouter);

  // Serve static React app
  const uiBuildPath = path.join(__dirname, '../../ui/build');
  app.use(express.static(uiBuildPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(uiBuildPath, 'index.html'));
  });

  // Error handler
  app.use(errorHandler);

  return app;
}

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error({
    event: 'http_error',
    error: err.message,
    path: req.path
  });

  res.status(500).json({
    success: false,
    error: err.message
  });
}
```

### Session Route

```typescript
// src/server/routes/session.ts
import { Router } from 'express';
import { DirectorSessionManager } from '../../core/director-session-manager';

export const sessionRouter = Router();

sessionRouter.get('/session', async (req, res) => {
  try {
    const manager = new DirectorSessionManager(req.runId, req.runPath);
    const session = await manager.loadSession();

    // Convert frames Map to array for JSON
    const framesArray = Array.from(session.frames.entries()).map(
      ([index, frame]) => ({
        index,
        ...frame,
        // Include base64 if requested
        imageBase64: req.query.includeImages ? frame.imageBase64 : undefined
      })
    );

    res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        runId: session.runId,
        moveId: session.moveId,
        status: session.status,
        frameCount: session.frames.size,
        frames: framesArray
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load session'
    });
  }
});
```

### Frame Route

```typescript
// src/server/routes/frame.ts
import { Router } from 'express';
import { DirectorSessionManager } from '../../core/director-session-manager';
import fs from 'fs-extra';

export const frameRouter = Router();

frameRouter.get('/frame/:id', async (req, res) => {
  try {
    const frameId = req.params.id;
    const manager = new DirectorSessionManager(req.runId, req.runPath);
    const session = await manager.loadSession();

    // Parse frame index from ID (frame_0001 -> 1)
    const frameIndex = parseInt(frameId.replace('frame_', ''), 10);
    const frame = session.frames.get(frameIndex);

    if (!frame) {
      return res.status(404).json({
        success: false,
        error: `Frame not found: ${frameId}`
      });
    }

    // Load image as base64 if not already loaded
    let imageBase64 = frame.imageBase64;
    if (!imageBase64 && frame.imagePath) {
      const buffer = await fs.readFile(frame.imagePath);
      imageBase64 = buffer.toString('base64');
    }

    res.json({
      success: true,
      frame: {
        id: frame.id,
        frameIndex: frame.frameIndex,
        status: frame.status,
        imageBase64,
        auditReport: frame.auditReport,
        directorOverrides: frame.directorOverrides,
        attemptHistory: frame.attemptHistory
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load frame'
    });
  }
});
```

### API Response Format

All API responses follow this format:

```typescript
// Success response
interface SuccessResponse<T> {
  success: true;
  data?: T;
}

// Error response
interface ErrorResponse {
  success: false;
  error: string;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
```

### Request Context Extension

```typescript
// src/server/types.ts
declare global {
  namespace Express {
    interface Request {
      runPath: string;
      runId: string;
    }
  }
}
```

### API Endpoints Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/session | Get current session state |
| GET | /api/frame/:id | Get specific frame data |
| POST | /api/patch | Inpaint masked region |
| POST | /api/commit | Finalize and export |

### Static File Serving

```typescript
// Serve React build
const uiBuildPath = path.join(__dirname, '../../ui/build');
app.use(express.static(uiBuildPath));

// SPA fallback for client-side routing
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(uiBuildPath, 'index.html'));
  }
});
```

### Security Considerations

- No CORS headers (same-origin only)
- Local-only server (127.0.0.1)
- No authentication (single-user desktop tool)
- API keys never sent to frontend

### Project Structure Notes

- New: `src/server/index.ts`
- New: `src/server/routes/session.ts`
- New: `src/server/routes/frame.ts`
- New: `src/server/routes/patch.ts` (Story 7.6)
- New: `src/server/routes/commit.ts` (Story 7.9)
- New: `src/server/types.ts`
- Tests: `test/server/*.test.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.4]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.6] (patch API)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.9] (commit API)

---

## Dev Agent Record

### Agent Model Used

**Claude-Code**

**Rationale:** Express server setup with multiple API routes requiring careful integration with session state. Backend architecture requiring consistency across endpoints.

### Debug Log References

N/A

### Completion Notes List

- Node http server (not Express) for lighter weight
- REST API: GET /api/session, GET /api/frame/:id, POST /api/patch, POST /api/nudge, POST /api/commit
- Static file serving with SPA fallback
- CORS headers for local development
- Path traversal protection on static files

### File List

- `src/core/director-server.ts` - HTTP server with all API routes
- `src/core/patch-service.ts` - Patch endpoint logic
- `src/core/commit-service.ts` - Commit endpoint logic
- `src/core/director-session-manager.ts` - Session management
- `test/core/director-server.test.ts` - Server tests
