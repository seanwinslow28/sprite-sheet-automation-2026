/**
 * Graceful shutdown handler
 * Per Story 8.6: Implement Graceful Shutdown and Resume
 */

import { logger } from '../utils/logger.js';
import { requestAbort, type OrchestratorContext } from './orchestrator.js';
import type { ProgressReporter } from './progress-reporter.js';

/**
 * Track shutdown state
 */
let isShuttingDown = false;
let forceShutdownTimeout: NodeJS.Timeout | null = null;

/**
 * Force shutdown timeout (30 seconds)
 */
const FORCE_SHUTDOWN_TIMEOUT_MS = 30000;
const SHUTDOWN_POLL_INTERVAL_MS = 250;

/**
 * Wait for orchestrator to reach a terminal or paused state
 */
async function waitForOrchestratorStop(
    orchestratorCtx: OrchestratorContext,
    timeoutMs: number
): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;

            const status = orchestratorCtx.state?.status;
            const state = orchestratorCtx.currentState;
            const isStopped = state === 'STOPPED' ||
                state === 'COMPLETED' ||
                status === 'paused' ||
                status === 'completed';

            if (isStopped) {
                clearInterval(timer);
                resolve(true);
                return;
            }

            if (elapsed >= timeoutMs) {
                clearInterval(timer);
                resolve(false);
            }
        }, SHUTDOWN_POLL_INTERVAL_MS);
    });
}

/**
 * Check if shutdown is in progress
 */
export function isShutdownInProgress(): boolean {
    return isShuttingDown;
}

/**
 * Clear shutdown state (for testing)
 */
export function resetShutdownState(): void {
    isShuttingDown = false;
    if (forceShutdownTimeout) {
        clearTimeout(forceShutdownTimeout);
        forceShutdownTimeout = null;
    }
}

/**
 * Register shutdown handlers for graceful termination
 */
export function registerShutdownHandlers(
    orchestratorCtx: OrchestratorContext,
    reporter?: ProgressReporter
): void {

    const shutdown = async (signal: string): Promise<void> => {
        if (isShuttingDown) {
            // Second signal = force shutdown
            console.log('\n⚠️ Force shutdown requested. Exiting immediately.');
            logger.warn({ signal }, 'Force shutdown requested');
            process.exit(1);
        }

        isShuttingDown = true;
        console.log(`\n🛑 Graceful shutdown initiated (${signal})...`);
        logger.info({ signal }, 'Graceful shutdown initiated');

        // Set force shutdown timeout
        forceShutdownTimeout = setTimeout(() => {
            console.log('\n⚠️ Shutdown timeout. Forcing exit.');
            logger.error('Shutdown timeout - forcing exit');
            process.exit(1);
        }, FORCE_SHUTDOWN_TIMEOUT_MS);

        try {
            // Request orchestrator abort
            console.log('   Requesting abort...');
            requestAbort(orchestratorCtx);

            // Give orchestrator time to complete current operation
            console.log('   Waiting for current operation to complete...');

            // Wait for the orchestrator to reach STOPPED/COMPLETED or time out
            const stopped = await waitForOrchestratorStop(
                orchestratorCtx,
                FORCE_SHUTDOWN_TIMEOUT_MS - 1000
            );

            if (!stopped) {
                console.log('   Shutdown timed out waiting for orchestrator.');
            } else {
                console.log('   State saved.');
            }

            // Stop the reporter spinner if active
            if (reporter) {
                reporter.stop();
            }

            console.log('✔ Shutdown complete. Run can be resumed.');
            logger.info('Graceful shutdown completed');

            clearTimeout(forceShutdownTimeout);
            process.exit(0);

        } catch (error) {
            logger.error({
                event: 'shutdown_error',
                error: error instanceof Error ? error.message : String(error),
            }, 'Error during shutdown');

            console.error('⚠️ Error during shutdown:', error);
            process.exit(1);
        }
    };

    // Register handlers
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
        logger.error({
            event: 'uncaught_exception',
            error: error.message,
            stack: error.stack,
        }, 'Uncaught exception');

        console.error('\n❌ Uncaught exception:', error.message);

        if (!isShuttingDown) {
            // Try graceful shutdown
            shutdown('UNCAUGHT_EXCEPTION');
        } else {
            process.exit(1);
        }
    });

    process.on('unhandledRejection', (reason) => {
        logger.error({
            event: 'unhandled_rejection',
            reason: String(reason),
        }, 'Unhandled rejection');

        console.error('\n❌ Unhandled rejection:', reason);

        // Don't force exit on unhandled rejection, but log it
    });
}

/**
 * Unregister shutdown handlers (for testing)
 */
export function unregisterShutdownHandlers(): void {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    resetShutdownState();
}
