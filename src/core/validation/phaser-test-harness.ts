/**
 * Phaser Test Harness
 * Story 5.7: Implement Phaser Micro-Test Suite
 *
 * Runs Phaser tests in headless Chrome via Puppeteer.
 * Validates exported atlas files have "Engine Truth" compatibility.
 */

import { promises as fs } from 'fs';
import path from 'path';
import puppeteer, { Browser, Page, ConsoleMessage } from 'puppeteer-core';
import http from 'http';
import { Result, SystemError } from '../result.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Individual micro-test result
 */
export interface MicroTestResult {
    test: 'TEST-02' | 'TEST-03' | 'TEST-04';
    name: string;
    passed: boolean;
    details: Record<string, unknown>;
    screenshot?: string;
    duration_ms: number;
    error?: string;
}

/**
 * Summary of all validation tests
 */
export interface ValidationSummary {
    run_id: string;
    atlas_path: string;
    validated_at: string;
    overall_passed: boolean;
    tests: {
        'TEST-02'?: MicroTestResult;
        'TEST-03'?: MicroTestResult;
        'TEST-04'?: MicroTestResult;
    };
    console_logs: string[];
}

/**
 * Test context passed to each micro-test
 */
export interface TestContext {
    atlasJsonPath: string;
    atlasPngPath: string;
    moveId: string;
    frameCount: number;
    outputDir: string;
}

/**
 * Raw test result from Phaser console.log
 */
export interface RawTestResult {
    test: string;
    passed: boolean;
    [key: string]: unknown;
}

// =============================================================================
// Test Harness Class
// =============================================================================

/**
 * Phaser Test Harness
 *
 * Manages Puppeteer browser, static file server, and test execution
 */
export class PhaserTestHarness {
    private browser: Browser | null = null;
    private server: http.Server | null = null;
    private serverPort: number = 0;
    private consoleLogs: string[] = [];

    /**
     * Initialize the test harness
     */
    async initialize(): Promise<Result<void, SystemError>> {
        try {
            // Launch Puppeteer with WebGL support
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--use-gl=swiftshader',
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--allow-file-access-from-files',
                ],
            });

            return Result.ok(undefined);
        } catch (error) {
            return Result.err({
                code: 'DEP_PUPPETEER_FAIL',
                message: `Failed to initialize Puppeteer: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    }

    /**
     * Start static file server for test page and atlas files
     */
    async startServer(staticDir: string): Promise<Result<number, SystemError>> {
        return new Promise((resolve) => {
            const server = http.createServer(async (req, res) => {
                const url = new URL(req.url || '/', `http://localhost`);
                let filePath = path.join(staticDir, url.pathname);

                // Security: ensure path is within static dir
                if (!filePath.startsWith(staticDir)) {
                    res.writeHead(403);
                    res.end('Forbidden');
                    return;
                }

                // Default to index.html
                if (url.pathname === '/') {
                    filePath = path.join(staticDir, 'test-page.html');
                }

                try {
                    const data = await fs.readFile(filePath);
                    const ext = path.extname(filePath).toLowerCase();
                    const contentTypes: Record<string, string> = {
                        '.html': 'text/html',
                        '.js': 'application/javascript',
                        '.json': 'application/json',
                        '.png': 'image/png',
                    };
                    res.writeHead(200, {
                        'Content-Type': contentTypes[ext] || 'application/octet-stream',
                        'Access-Control-Allow-Origin': '*',
                    });
                    res.end(data);
                } catch {
                    res.writeHead(404);
                    res.end('Not found');
                }
            });

            server.listen(0, '127.0.0.1', () => {
                const addr = server.address();
                if (addr && typeof addr !== 'string') {
                    this.serverPort = addr.port;
                    this.server = server;
                    resolve(Result.ok(this.serverPort));
                } else {
                    resolve(
                        Result.err({
                            code: 'SYS_SERVER_FAIL',
                            message: 'Failed to start static file server',
                        })
                    );
                }
            });
        });
    }

    /**
     * Run a single micro-test
     */
    async runTest(
        testId: 'TEST-02' | 'TEST-03' | 'TEST-04',
        context: TestContext
    ): Promise<Result<MicroTestResult, SystemError>> {
        if (!this.browser) {
            return Result.err({
                code: 'SYS_NOT_INITIALIZED',
                message: 'Test harness not initialized',
            });
        }

        const startTime = Date.now();
        let page: Page | null = null;

        try {
            page = await this.browser.newPage();

            // Set up console log capture
            const testLogs: string[] = [];
            page.on('console', (msg) => {
                const text = msg.text();
                testLogs.push(text);
                this.consoleLogs.push(`[${testId}] ${text}`);
            });

            // Build test URL
            const testUrl = `http://127.0.0.1:${this.serverPort}/test-page.html?test=${testId}&moveId=${context.moveId}&frameCount=${context.frameCount}`;

            // Navigate and wait for test completion
            await page.goto(testUrl, { waitUntil: 'networkidle0', timeout: 30000 });

            // Wait for test result in console
            const result = await this.waitForTestResult(page, testId, 15000);

            // Take screenshot
            const screenshotPath = path.join(
                context.outputDir,
                `${testId.toLowerCase()}.png`
            );
            await page.screenshot({ path: screenshotPath });

            const duration = Date.now() - startTime;

            if (result.isErr()) {
                return Result.ok({
                    test: testId,
                    name: this.getTestName(testId),
                    passed: false,
                    details: { error: result.unwrapErr().message },
                    screenshot: screenshotPath,
                    duration_ms: duration,
                    error: result.unwrapErr().message,
                });
            }

            const rawResult = result.unwrap();
            return Result.ok({
                test: testId,
                name: this.getTestName(testId),
                passed: rawResult.passed,
                details: rawResult,
                screenshot: screenshotPath,
                duration_ms: duration,
            });
        } catch (error) {
            return Result.err({
                code: 'SYS_TEST_FAILED',
                message: `Test ${testId} failed: ${error instanceof Error ? error.message : String(error)}`,
            });
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    /**
     * Wait for test result from console.log
     */
    private async waitForTestResult(
        page: Page,
        testId: string,
        timeout: number
    ): Promise<Result<RawTestResult, SystemError>> {
        return new Promise((resolve) => {
            const timeoutHandle = setTimeout(() => {
                resolve(
                    Result.err({
                        code: 'SYS_TEST_TIMEOUT',
                        message: `Test ${testId} timed out after ${timeout}ms`,
                    })
                );
            }, timeout);

            const handler = (msg: ConsoleMessage) => {
                const text = msg.text();
                try {
                    const data = JSON.parse(text);
                    if (data.test === testId) {
                        clearTimeout(timeoutHandle);
                        page.off('console', handler);
                        resolve(Result.ok(data as RawTestResult));
                    }
                } catch {
                    // Not JSON, ignore
                }
            };

            page.on('console', handler);
        });
    }

    /**
     * Get human-readable test name
     */
    private getTestName(testId: 'TEST-02' | 'TEST-03' | 'TEST-04'): string {
        const names: Record<string, string> = {
            'TEST-02': 'Pivot Auto-Apply',
            'TEST-03': 'Trim Mode Jitter',
            'TEST-04': 'Suffix Convention',
        };
        return names[testId] || testId;
    }

    /**
     * Get collected console logs
     */
    getConsoleLogs(): string[] {
        return [...this.consoleLogs];
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.consoleLogs = [];
    }
}

// =============================================================================
// Runner Functions
// =============================================================================

/**
 * Run all Phaser micro-tests for a run
 *
 * @param runsDir Base runs directory
 * @param runId Run ID to validate
 * @param atlasJsonPath Path to atlas JSON file
 * @param atlasPngPath Path to atlas PNG file
 * @param moveId Move ID for frame key prefix
 * @param frameCount Number of frames in atlas
 * @returns Validation summary
 */
export async function runPhaserMicroTests(
    runsDir: string,
    runId: string,
    atlasJsonPath: string,
    atlasPngPath: string,
    moveId: string,
    frameCount: number
): Promise<Result<ValidationSummary, SystemError>> {
    const harness = new PhaserTestHarness();

    try {
        // Create validation output directory
        const validationDir = path.join(runsDir, runId, 'validation');
        await fs.mkdir(validationDir, { recursive: true });

        // Copy atlas files to validation dir for serving
        const localAtlasJson = path.join(validationDir, 'atlas.json');
        const localAtlasPng = path.join(validationDir, 'atlas.png');
        await fs.copyFile(atlasJsonPath, localAtlasJson);
        await fs.copyFile(atlasPngPath, localAtlasPng);

        // Create test page
        const testPagePath = path.join(validationDir, 'test-page.html');
        await fs.writeFile(testPagePath, generateTestPageHtml());

        // Initialize harness
        const initResult = await harness.initialize();
        if (initResult.isErr()) {
            return Result.err(initResult.unwrapErr());
        }

        // Start server
        const serverResult = await harness.startServer(validationDir);
        if (serverResult.isErr()) {
            await harness.cleanup();
            return Result.err(serverResult.unwrapErr());
        }

        const context: TestContext = {
            atlasJsonPath: localAtlasJson,
            atlasPngPath: localAtlasPng,
            moveId,
            frameCount,
            outputDir: validationDir,
        };

        // Run each test
        const tests: Array<'TEST-02' | 'TEST-03' | 'TEST-04'> = [
            'TEST-02',
            'TEST-03',
            'TEST-04',
        ];
        const results: ValidationSummary['tests'] = {};

        for (const testId of tests) {
            const testResult = await harness.runTest(testId, context);
            if (testResult.isOk()) {
                results[testId] = testResult.unwrap();
            } else {
                results[testId] = {
                    test: testId,
                    name: testId,
                    passed: false,
                    details: {},
                    duration_ms: 0,
                    error: testResult.unwrapErr().message,
                };
            }
        }

        const summary: ValidationSummary = {
            run_id: runId,
            atlas_path: atlasJsonPath,
            validated_at: new Date().toISOString(),
            overall_passed: Object.values(results).every((r) => r?.passed),
            tests: results,
            console_logs: harness.getConsoleLogs(),
        };

        // Save results
        await fs.writeFile(
            path.join(validationDir, 'test-results.json'),
            JSON.stringify(summary, null, 2)
        );
        await fs.writeFile(
            path.join(validationDir, 'console.log'),
            summary.console_logs.join('\n')
        );

        await harness.cleanup();
        return Result.ok(summary);
    } catch (error) {
        await harness.cleanup();
        return Result.err({
            code: 'SYS_VALIDATION_FAILED',
            message: `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
}

/**
 * Generate the Phaser test page HTML
 */
export function generateTestPageHtml(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Phaser Micro-Tests</title>
    <script src="https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js"></script>
    <style>
        body { margin: 0; padding: 0; background: #333; }
        #game { margin: 0 auto; }
    </style>
</head>
<body>
<div id="game"></div>
<script>
// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const testToRun = urlParams.get('test');
const moveId = urlParams.get('moveId') || 'idle';
const frameCount = parseInt(urlParams.get('frameCount') || '8', 10);

// TEST-02: Pivot Auto-Apply
class TEST02_PivotScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TEST-02' });
    }

    preload() {
        this.load.atlas('atlas', 'atlas.png', 'atlas.json');
    }

    create() {
        try {
            // Load sprite with feet origin (center-bottom)
            const sprite = this.add.sprite(256, 400, 'atlas', moveId + '/0000');
            sprite.setOrigin(0.5, 1);

            const results = [];
            const baselineY = sprite.getBounds().bottom;

            // Step through all frames
            for (let i = 0; i < frameCount; i++) {
                const frameKey = moveId + '/' + i.toString().padStart(4, '0');
                sprite.setFrame(frameKey);
                const currentY = sprite.getBounds().bottom;
                results.push(currentY);
            }

            // Check consistency (1px tolerance)
            const maxDrift = Math.max(...results) - Math.min(...results);
            const passed = maxDrift <= 1;

            console.log(JSON.stringify({
                test: 'TEST-02',
                passed,
                maxDrift,
                baselineY,
                frameResults: results,
                tolerance: 1
            }));
        } catch (e) {
            console.log(JSON.stringify({
                test: 'TEST-02',
                passed: false,
                error: e.message
            }));
        }
    }
}

// TEST-03: Trim Mode Jitter
class TEST03_TrimJitterScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TEST-03' });
    }

    preload() {
        this.load.atlas('atlas', 'atlas.png', 'atlas.json');
    }

    create() {
        try {
            const sprite = this.add.sprite(256, 256, 'atlas', moveId + '/0000');
            const positions = [];

            // Capture center position for each frame
            for (let i = 0; i < frameCount; i++) {
                const frameKey = moveId + '/' + i.toString().padStart(4, '0');
                sprite.setFrame(frameKey);
                const bounds = sprite.getBounds();
                positions.push({
                    x: bounds.centerX,
                    y: bounds.centerY
                });
            }

            // Calculate variance
            const xValues = positions.map(p => p.x);
            const yValues = positions.map(p => p.y);
            const xVariance = Math.max(...xValues) - Math.min(...xValues);
            const yVariance = Math.max(...yValues) - Math.min(...yValues);

            const passed = xVariance <= 2 && yVariance <= 2;  // 2px tolerance

            console.log(JSON.stringify({
                test: 'TEST-03',
                passed,
                xVariance,
                yVariance,
                positions,
                tolerance: 2
            }));
        } catch (e) {
            console.log(JSON.stringify({
                test: 'TEST-03',
                passed: false,
                error: e.message
            }));
        }
    }
}

// TEST-04: Suffix Convention
class TEST04_SuffixScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TEST-04' });
    }

    preload() {
        this.load.atlas('atlas', 'atlas.png', 'atlas.json');
    }

    create() {
        try {
            // Use generateFrameNames with our naming convention
            const frames = this.anims.generateFrameNames('atlas', {
                prefix: moveId + '/',
                start: 0,
                end: frameCount - 1,
                zeroPad: 4
            });

            // Verify all frames resolved
            const atlasTexture = this.textures.get('atlas');
            const frameNames = atlasTexture.getFrameNames();
            const missingFrames = [];

            for (const f of frames) {
                if (!frameNames.includes(f.frame)) {
                    missingFrames.push(f.frame);
                }
            }

            const passed = missingFrames.length === 0;

            console.log(JSON.stringify({
                test: 'TEST-04',
                passed,
                totalFrames: frames.length,
                resolvedFrames: frames.length - missingFrames.length,
                missingFrames,
                availableFrames: frameNames
            }));
        } catch (e) {
            console.log(JSON.stringify({
                test: 'TEST-04',
                passed: false,
                error: e.message
            }));
        }
    }
}

// Game config
const scenes = [];
if (testToRun === 'TEST-02') scenes.push(TEST02_PivotScene);
else if (testToRun === 'TEST-03') scenes.push(TEST03_TrimJitterScene);
else if (testToRun === 'TEST-04') scenes.push(TEST04_SuffixScene);
else scenes.push(TEST02_PivotScene, TEST03_TrimJitterScene, TEST04_SuffixScene);

const config = {
    type: Phaser.WEBGL,
    width: 512,
    height: 512,
    backgroundColor: '#333333',
    parent: 'game',
    scene: scenes
};

new Phaser.Game(config);
</script>
</body>
</html>`;
}

/**
 * Format validation results for CLI output
 */
export function formatValidationResults(summary: ValidationSummary): string {
    const lines: string[] = [];
    const divider = '='.repeat(55);

    lines.push(`Running Phaser Micro-Tests for run ${summary.run_id}...`);
    lines.push(divider);
    lines.push('');

    const testOrder: Array<'TEST-02' | 'TEST-03' | 'TEST-04'> = [
        'TEST-02',
        'TEST-03',
        'TEST-04',
    ];

    for (const testId of testOrder) {
        const result = summary.tests[testId];
        if (!result) continue;

        const icon = result.passed ? '\u2705' : '\u274C';
        const status = result.passed ? 'PASS' : 'FAIL';

        lines.push(`${testId} (${result.name})`);
        lines.push(`  ${icon} ${status}`);

        if (result.details) {
            if (testId === 'TEST-02' && result.details.maxDrift !== undefined) {
                lines.push(`  Max drift: ${result.details.maxDrift}px`);
            }
            if (testId === 'TEST-03') {
                if (result.details.xVariance !== undefined) {
                    lines.push(
                        `  X variance: ${result.details.xVariance}px, Y variance: ${result.details.yVariance}px`
                    );
                }
            }
            if (testId === 'TEST-04') {
                if (result.details.totalFrames !== undefined) {
                    lines.push(
                        `  ${result.details.resolvedFrames}/${result.details.totalFrames} frames resolved`
                    );
                }
            }
        }

        if (result.error) {
            lines.push(`  Error: ${result.error}`);
        }

        if (result.screenshot) {
            lines.push(`  Screenshot: ${path.basename(result.screenshot)}`);
        }

        lines.push('');
    }

    lines.push(divider);
    const passedCount = Object.values(summary.tests).filter((t) => t?.passed).length;
    const totalCount = Object.values(summary.tests).length;
    const overallIcon = summary.overall_passed ? '\u2705' : '\u274C';
    const overallStatus = summary.overall_passed ? 'PASS' : 'FAIL';
    lines.push(
        `OVERALL: ${overallIcon} ${overallStatus} (${passedCount}/${totalCount} tests passed)`
    );

    return lines.join('\n');
}

/**
 * Load validation results from a run
 */
export async function loadValidationResults(
    runsDir: string,
    runId: string
): Promise<Result<ValidationSummary, SystemError>> {
    const resultsPath = path.join(runsDir, runId, 'validation', 'test-results.json');

    try {
        const content = await fs.readFile(resultsPath, 'utf-8');
        const summary = JSON.parse(content) as ValidationSummary;
        return Result.ok(summary);
    } catch {
        return Result.err({
            code: 'SYS_READ_FAILED',
            message: `Failed to load validation results from: ${resultsPath}`,
        });
    }
}
