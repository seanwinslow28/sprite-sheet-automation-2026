/**
 * Director Server Bridge - HTTP server for Director Mode UI
 * Per Story 8.4: Implement Director Server Bridge
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { EventEmitter } from 'events';
import { join } from 'path';
import { promises as fs } from 'fs';
import { existsSync, createReadStream } from 'fs';
import { logger } from '../utils/logger.js';
import { DirectorSessionManager } from './director-session-manager.js';
import { PatchService, type PatchRequest } from './patch-service.js';
import { CommitService } from './commit-service.js';
import type { DirectorSession } from '../domain/types/director-session.js';

/**
 * MIME types for static files
 */
const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.map': 'application/json',
};

/**
 * API response type
 */
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Director Server for serving UI and handling API requests
 */
export class DirectorServer extends EventEmitter {
    private server: Server | null = null;
    private port: number;
    private runPath: string;
    private runId: string;
    private uiBuildPath: string;
    private sessionManager: DirectorSessionManager;
    private patchService: PatchService;
    private commitService: CommitService;

    constructor(runPath: string, runId: string, port: number = 3000) {
        super();

        // Set max listeners to prevent memory leak warnings
        // Events: 'commit', 'close', 'error' (from server), plus headroom
        this.setMaxListeners(10);

        this.runPath = runPath;
        this.runId = runId;
        this.port = port;

        // UI build path (relative to dist/core)
        this.uiBuildPath = join(process.cwd(), 'ui', 'build');

        // Initialize services
        this.sessionManager = new DirectorSessionManager(runId, runPath);
        this.patchService = new PatchService();
        this.commitService = new CommitService();
    }

    /**
     * Start the server
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = createServer((req, res) => {
                this.handleRequest(req, res).catch((error) => {
                    logger.error({
                        event: 'request_error',
                        error: error instanceof Error ? error.message : String(error),
                    }, 'Request handling error');

                    this.sendJson(res, 500, {
                        success: false,
                        error: 'Internal server error',
                    });
                });
            });

            this.server.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.port} is already in use. Try --port <number>`));
                } else {
                    reject(error);
                }
            });

            this.server.listen(this.port, '127.0.0.1', () => {
                logger.info({
                    event: 'director_server_started',
                    port: this.port,
                    runId: this.runId,
                }, 'Director server started');
                resolve();
            });
        });
    }

    /**
     * Close the server
     */
    close(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            logger.info({
                event: 'director_server_closed',
                runId: this.runId,
            }, 'Director server closed');
        }
    }

    /**
     * Get the server port
     */
    getPort(): number {
        return this.port;
    }

    /**
     * Handle incoming HTTP requests
     */
    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const url = new URL(req.url || '/', `http://localhost:${this.port}`);
        const urlPath = url.pathname;
        const method = req.method || 'GET';

        logger.debug({
            event: 'http_request',
            method,
            path: urlPath,
        }, `${method} ${urlPath}`);

        // CORS headers for local development (restricted to localhost only)
        const allowedOrigin = `http://localhost:${this.port}`;
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle preflight
        if (method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // API routes
        if (urlPath.startsWith('/api/')) {
            await this.handleApiRequest(req, res, urlPath, method);
            return;
        }

        // Static file serving
        await this.serveStatic(res, urlPath);
    }

    /**
     * Handle API requests
     */
    private async handleApiRequest(
        req: IncomingMessage,
        res: ServerResponse,
        urlPath: string,
        method: string
    ): Promise<void> {
        try {
            // GET /api/session
            if (urlPath === '/api/session' && method === 'GET') {
                await this.handleGetSession(res);
                return;
            }

            // GET /api/frame/:id
            if (urlPath.startsWith('/api/frame/') && method === 'GET') {
                const frameId = urlPath.substring('/api/frame/'.length);
                await this.handleGetFrame(res, frameId);
                return;
            }

            // POST /api/patch
            if (urlPath === '/api/patch' && method === 'POST') {
                await this.handlePatch(req, res);
                return;
            }

            // POST /api/commit
            if (urlPath === '/api/commit' && method === 'POST') {
                await this.handleCommit(res);
                return;
            }

            // POST /api/nudge
            if (urlPath === '/api/nudge' && method === 'POST') {
                await this.handleNudge(req, res);
                return;
            }

            // 404 for unknown API routes
            this.sendJson(res, 404, {
                success: false,
                error: `Unknown API endpoint: ${method} ${urlPath}`,
            });

        } catch (error) {
            logger.error({
                event: 'api_error',
                path: urlPath,
                error: error instanceof Error ? error.message : String(error),
            }, 'API error');

            this.sendJson(res, 500, {
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    }

    /**
     * GET /api/session - Return current session state
     */
    private async handleGetSession(res: ServerResponse): Promise<void> {
        // Try to load existing session first
        let session: DirectorSession | null = null;

        const loadResult = await this.sessionManager.loadSession();
        if (loadResult.isOk()) {
            session = loadResult.unwrap();
        } else if (loadResult.unwrapErr().code === 'SESSION_NOT_FOUND') {
            // Try to create one
            const stateResult = await this.loadRunState();
            if (!stateResult) {
                this.sendJson(res, 500, {
                    success: false,
                    error: 'Could not load run state',
                });
                return;
            }

            const createResult = await this.sessionManager.initializeOrResume({
                moveId: 'unknown',
                totalFrames: stateResult.total_frames,
            });

            if (createResult.isErr()) {
                this.sendJson(res, 500, {
                    success: false,
                    error: createResult.unwrapErr().message,
                });
                return;
            }

            session = createResult.unwrap();
        }

        if (!session) {
            this.sendJson(res, 500, {
                success: false,
                error: 'Failed to load or create session',
            });
            return;
        }

        // Convert frames Record to array
        const framesArray = Object.entries(session.frames).map(([index, frame]) => ({
            index: parseInt(index, 10),
            id: frame.id,
            status: frame.status,
            hasAuditReport: !!frame.auditReport,
            hasOverrides: !!frame.directorOverrides,
        }));

        this.sendJson(res, 200, {
            success: true,
            data: {
                sessionId: session.sessionId,
                runId: session.runId,
                moveId: session.moveId,
                status: session.status,
                frameCount: Object.keys(session.frames).length,
                frames: framesArray,
            },
        });
    }

    /**
     * Load run state from state.json
     */
    private async loadRunState(): Promise<{ total_frames: number } | null> {
        try {
            const statePath = join(this.runPath, 'state.json');
            const content = await fs.readFile(statePath, 'utf-8');
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    /**
     * GET /api/frame/:id - Return specific frame data
     */
    private async handleGetFrame(res: ServerResponse, frameId: string): Promise<void> {
        const loadResult = await this.sessionManager.loadSession();

        if (loadResult.isErr()) {
            this.sendJson(res, 500, {
                success: false,
                error: loadResult.unwrapErr().message,
            });
            return;
        }

        const session = loadResult.unwrap();

        // Parse frame index from ID (frame_0001 -> 1)
        const frameIndex = parseInt(frameId.replace('frame_', ''), 10);
        const frame = session.frames[String(frameIndex)];

        if (!frame) {
            this.sendJson(res, 404, {
                success: false,
                error: `Frame not found: ${frameId}`,
            });
            return;
        }

        // Load image as base64 if not already loaded
        let imageBase64: string | undefined = frame.imageBase64;
        if (!imageBase64 && frame.imagePath && existsSync(frame.imagePath)) {
            const buffer = await fs.readFile(frame.imagePath);
            imageBase64 = buffer.toString('base64');
        }

        this.sendJson(res, 200, {
            success: true,
            data: {
                id: frame.id,
                frameIndex: frame.frameIndex,
                status: frame.status,
                imageBase64,
                auditReport: frame.auditReport,
                directorOverrides: frame.directorOverrides,
                attemptHistory: frame.attemptHistory,
            },
        });
    }

    /**
     * POST /api/patch - Trigger inpainting
     */
    private async handlePatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await this.parseJsonBody(req);

        if (!body) {
            this.sendJson(res, 400, {
                success: false,
                error: 'Invalid JSON body',
            });
            return;
        }

        const { frameId, maskBase64, prompt } = body as {
            frameId?: string;
            maskBase64?: string;
            prompt?: string;
        };

        if (!frameId || !maskBase64 || !prompt) {
            this.sendJson(res, 400, {
                success: false,
                error: 'Missing required fields: frameId, maskBase64, prompt',
            });
            return;
        }

        // Execute patch
        const frameIndex = parseInt(frameId.replace('frame_', ''), 10);

        const patchRequest: PatchRequest = {
            frameId,
            frameIndex,
            maskBase64,
            prompt,
        };

        const patchResult = await this.patchService.patchFrame(patchRequest, this.sessionManager);

        if (!patchResult.ok) {
            this.sendJson(res, 500, {
                success: false,
                error: patchResult.error.message,
            });
            return;
        }

        const response = patchResult.value;
        this.sendJson(res, 200, {
            success: true,
            data: {
                patchedImageBase64: response.patchedImageBase64,
                frameId,
            },
        });
    }

    /**
     * POST /api/nudge - Apply nudge delta
     */
    private async handleNudge(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await this.parseJsonBody(req);

        if (!body) {
            this.sendJson(res, 400, {
                success: false,
                error: 'Invalid JSON body',
            });
            return;
        }

        const { frameId, deltaX, deltaY } = body as {
            frameId?: string;
            deltaX?: number;
            deltaY?: number;
        };

        if (!frameId || deltaX === undefined || deltaY === undefined) {
            this.sendJson(res, 400, {
                success: false,
                error: 'Missing required fields: frameId, deltaX, deltaY',
            });
            return;
        }

        const frameIndex = parseInt(frameId.replace('frame_', ''), 10);

        // Update session with nudge delta using setAlignmentDelta
        const updateResult = await this.sessionManager.setAlignmentDelta(frameIndex, {
            userOverrideX: deltaX,
            userOverrideY: deltaY,
        });

        if (updateResult.isErr()) {
            this.sendJson(res, 500, {
                success: false,
                error: updateResult.unwrapErr().message,
            });
            return;
        }

        this.sendJson(res, 200, {
            success: true,
            data: {
                frameId,
                deltaX,
                deltaY,
            },
        });
    }

    /**
     * POST /api/commit - Save all changes and close server
     */
    private async handleCommit(res: ServerResponse): Promise<void> {
        // Commit changes
        const commitResult = await this.commitService.commitSession(this.sessionManager);

        if (!commitResult.ok) {
            this.sendJson(res, 500, {
                success: false,
                error: commitResult.error.message,
            });
            return;
        }

        const result = commitResult.value;

        // Send success response
        this.sendJson(res, 200, {
            success: true,
            data: {
                framesCommitted: result.approvedCount,
                nudgesApplied: result.nudgedCount,
                patchesApplied: result.patchedCount,
            },
        });

        // Emit commit event
        this.emit('commit');

        // Close server after response
        setTimeout(() => {
            this.close();
        }, 100);
    }

    /**
     * Serve static files
     */
    private async serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
        // Normalize path
        let filePath = urlPath === '/' ? '/index.html' : urlPath;

        // Security: prevent path traversal
        if (filePath.includes('..')) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        const fullPath = join(this.uiBuildPath, filePath);

        // Check if file exists
        if (!existsSync(fullPath)) {
            // SPA fallback: serve index.html for client-side routing
            const indexPath = join(this.uiBuildPath, 'index.html');
            if (existsSync(indexPath)) {
                await this.serveFile(res, indexPath);
            } else {
                // No UI build found, serve a placeholder
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Director Mode</title>
    <style>
        body { font-family: system-ui; padding: 40px; text-align: center; }
        h1 { color: #333; }
        p { color: #666; }
        .api-link { margin-top: 20px; }
        a { color: #0066cc; }
    </style>
</head>
<body>
    <h1>Director Mode</h1>
    <p>Run ID: ${this.runId}</p>
    <p>The Director UI is not built yet.</p>
    <div class="api-link">
        <p>API is available at:</p>
        <a href="/api/session">/api/session</a>
    </div>
</body>
</html>
                `);
            }
            return;
        }

        await this.serveFile(res, fullPath);
    }

    /**
     * Serve a file from disk
     */
    private async serveFile(res: ServerResponse, filePath: string): Promise<void> {
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = createReadStream(filePath);
        stream.pipe(res);
    }

    /**
     * Parse JSON body from request
     */
    private async parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
        return new Promise((resolve) => {
            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch {
                    resolve(null);
                }
            });

            req.on('error', () => {
                resolve(null);
            });
        });
    }

    /**
     * Send JSON response
     */
    private sendJson(res: ServerResponse, statusCode: number, data: ApiResponse): void {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }
}

/**
 * Start a Director server
 */
export async function startDirectorServer(
    runPath: string,
    runId: string,
    port: number = 3000
): Promise<DirectorServer> {
    const server = new DirectorServer(runPath, runId, port);
    await server.start();
    return server;
}
