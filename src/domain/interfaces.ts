/**
 * Domain interfaces for adapter contracts
 */

export interface Context {
    runId?: string;
    frameIndex?: number;
    [key: string]: unknown;
}
