/**
 * Orchestrator state machine types
 * Per Story 4.8: Implement Orchestrator State Machine
 */

/**
 * Orchestrator state values
 *
 * State Machine Flow:
 *
 *                     ┌─────────┐
 *                     │  INIT   │
 *                     └────┬────┘
 *                          │
 *                          ▼
 *               ┌──────────────────┐
 *               │    GENERATING    │◄────────────┐
 *               └────────┬─────────┘             │
 *                        │                       │
 *                        ▼                       │
 *               ┌──────────────────┐             │
 *               │    AUDITING      │             │
 *               └────────┬─────────┘             │
 *                        │                       │
 *             ┌──────────┴──────────┐            │
 *             │                     │            │
 *             ▼                     ▼            │
 *    ┌─────────────────┐   ┌─────────────────┐   │
 *    │    APPROVING    │   │ RETRY_DECIDING  │───┘
 *    └────────┬────────┘   └────────┬────────┘
 *             │                     │
 *             │                     ▼
 *             │            ┌─────────────────┐
 *             └───────────►│   NEXT_FRAME    │
 *                          └────────┬────────┘
 *                                   │
 *                     ┌─────────────┴─────────────┐
 *                     │                           │
 *                     ▼                           ▼
 *            ┌─────────────────┐         ┌─────────────────┐
 *            │    COMPLETED    │         │     STOPPED     │
 *            └─────────────────┘         └─────────────────┘
 */
export type OrchestratorState =
    | 'INIT'            // Validate manifest, create lock file, analyze anchor
    | 'GENERATING'      // Call generator adapter to produce frame
    | 'AUDITING'        // Run hard gates then soft metrics
    | 'RETRY_DECIDING'  // Consult retry ladder for next action
    | 'APPROVING'       // Move frame to approved folder
    | 'NEXT_FRAME'      // Increment frame index, check completion
    | 'COMPLETED'       // All frames approved
    | 'STOPPED';        // Halt condition triggered

/**
 * State transition record
 */
export interface StateTransition {
    from: OrchestratorState;
    to: OrchestratorState;
    timestamp: string;
    reason?: string;
    frameIndex?: number;
    attemptIndex?: number;
    durationMs?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Valid state transitions
 */
export const VALID_TRANSITIONS: Record<OrchestratorState, OrchestratorState[]> = {
    'INIT': ['GENERATING', 'STOPPED'],
    'GENERATING': ['AUDITING', 'STOPPED'],
    'AUDITING': ['APPROVING', 'RETRY_DECIDING'],
    'RETRY_DECIDING': ['GENERATING', 'NEXT_FRAME'],
    'APPROVING': ['NEXT_FRAME'],
    'NEXT_FRAME': ['GENERATING', 'COMPLETED', 'STOPPED'],
    'COMPLETED': [],
    'STOPPED': [],
};

/**
 * Check if a transition is valid
 */
export function isValidTransition(
    from: OrchestratorState,
    to: OrchestratorState
): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * State descriptions for logging
 */
export const STATE_DESCRIPTIONS: Record<OrchestratorState, string> = {
    'INIT': 'Initializing run (validating manifest, analyzing anchor)',
    'GENERATING': 'Generating frame via AI',
    'AUDITING': 'Auditing frame (hard gates + soft metrics)',
    'RETRY_DECIDING': 'Consulting retry ladder for next action',
    'APPROVING': 'Approving frame and saving to approved folder',
    'NEXT_FRAME': 'Moving to next frame',
    'COMPLETED': 'Run completed successfully',
    'STOPPED': 'Run stopped (stop condition triggered)',
};

/**
 * Check if state is terminal
 */
export function isTerminalState(state: OrchestratorState): boolean {
    return state === 'COMPLETED' || state === 'STOPPED';
}

/**
 * Get human-readable state description
 */
export function getStateDescription(state: OrchestratorState): string {
    return STATE_DESCRIPTIONS[state];
}
