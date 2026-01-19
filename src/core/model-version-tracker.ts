/**
 * Model version tracking and change detection
 * Per Story 6.7: Warn when generator model version changes or is deprecated
 */

import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { pathExists, writeJsonAtomic } from '../utils/fs-helpers.js';
import chalk from 'chalk';

/**
 * Model info schema
 */
export const ModelInfoSchema = z.object({
    modelId: z.string(),
    versionString: z.string().optional(),
    lastUsed: z.string().optional(),
    runId: z.string().optional(),
});

export type ModelInfo = z.infer<typeof ModelInfoSchema>;

/**
 * Character/move version history schema
 */
export const CharacterMoveHistorySchema = z.record(z.string(), ModelInfoSchema);

/**
 * Model history schema
 */
export const ModelHistorySchema = z.object({
    lastUpdated: z.string(),
    characters: z.record(z.string(), CharacterMoveHistorySchema),
    globalLastModel: ModelInfoSchema.optional(),
});

export type ModelHistory = z.infer<typeof ModelHistorySchema>;

/**
 * Version change types
 */
export type VersionChangeType = 'model_switch' | 'major' | 'minor' | 'patch' | 'unknown';

/**
 * Deprecation info
 */
export interface DeprecationInfo {
    isDeprecated: boolean;
    deprecationDate?: string;
    suggestedAlternative?: string;
}

/**
 * Version change info
 */
export interface VersionChangeInfo {
    changed: boolean;
    previousVersion?: ModelInfo;
    currentVersion: ModelInfo;
    changeType?: VersionChangeType;
    deprecation?: DeprecationInfo;
}

/**
 * Model warning for run summary
 */
export interface ModelWarning {
    type: 'version_change' | 'deprecation' | 'first_use';
    message: string;
    severity: 'info' | 'warning' | 'error';
    details?: Record<string, unknown>;
}

// Default model history file location
const MODEL_HISTORY_DIR = '.sprite-pipeline';
const MODEL_HISTORY_FILE = 'model-history.json';

/**
 * Get the model history file path
 */
export function getModelHistoryPath(baseDir: string = process.cwd()): string {
    return path.join(baseDir, MODEL_HISTORY_DIR, MODEL_HISTORY_FILE);
}

/**
 * Load model history from file
 */
export async function loadModelHistory(baseDir: string = process.cwd()): Promise<ModelHistory> {
    const historyPath = getModelHistoryPath(baseDir);

    if (!(await pathExists(historyPath))) {
        return {
            lastUpdated: new Date().toISOString(),
            characters: {},
        };
    }

    try {
        const content = await fs.readFile(historyPath, 'utf-8');
        const parsed = JSON.parse(content);
        return ModelHistorySchema.parse(parsed);
    } catch (error) {
        logger.warn({
            error: error instanceof Error ? error.message : 'Unknown error',
            path: historyPath,
        }, 'Failed to load model history, starting fresh');

        return {
            lastUpdated: new Date().toISOString(),
            characters: {},
        };
    }
}

/**
 * Save model history to file
 */
export async function saveModelHistory(
    history: ModelHistory,
    baseDir: string = process.cwd()
): Promise<void> {
    const historyPath = getModelHistoryPath(baseDir);

    history.lastUpdated = new Date().toISOString();

    // Use atomic write (temp-then-rename) per project-context rule 17
    await writeJsonAtomic(historyPath, history);

    logger.debug({
        path: historyPath,
    }, 'Model history saved');
}

/**
 * Get the last used model version for a character/move
 */
export async function getLastUsedModelVersion(
    character: string,
    move: string,
    baseDir: string = process.cwd()
): Promise<ModelInfo | null> {
    const history = await loadModelHistory(baseDir);
    return history.characters[character]?.[move] ?? null;
}

/**
 * Update model history after a run
 */
export async function updateModelHistory(
    character: string,
    move: string,
    modelInfo: ModelInfo,
    runId: string,
    baseDir: string = process.cwd()
): Promise<void> {
    const history = await loadModelHistory(baseDir);

    // Initialize character entry if needed
    if (!history.characters[character]) {
        history.characters[character] = {};
    }

    // Update the character/move entry
    history.characters[character][move] = {
        ...modelInfo,
        lastUsed: new Date().toISOString(),
        runId,
    };

    // Update global last model
    history.globalLastModel = {
        modelId: modelInfo.modelId,
        versionString: modelInfo.versionString,
    };

    await saveModelHistory(history, baseDir);

    logger.debug({
        character,
        move,
        modelId: modelInfo.modelId,
        runId,
    }, 'Model history updated');
}

/**
 * Compare version strings (semver-like)
 */
export function compareVersionStrings(previous: string, current: string): VersionChangeType {
    // Handle simple date-like versions (2024.01.15)
    const prevParts = previous.split(/[.\-_]/);
    const currParts = current.split(/[.\-_]/);

    // If formats are completely different, return unknown
    if (prevParts.length !== currParts.length || prevParts.length === 0) {
        return 'unknown';
    }

    // Compare parts
    for (let i = 0; i < prevParts.length; i++) {
        const prev = parseInt(prevParts[i], 10);
        const curr = parseInt(currParts[i], 10);

        if (isNaN(prev) || isNaN(curr)) {
            // Non-numeric parts, do string comparison
            if (prevParts[i] !== currParts[i]) {
                return i === 0 ? 'major' : i === 1 ? 'minor' : 'patch';
            }
        } else if (prev !== curr) {
            // Numeric parts differ
            return i === 0 ? 'major' : i === 1 ? 'minor' : 'patch';
        }
    }

    return 'unknown';
}

/**
 * Detect model version change
 */
export async function detectModelVersionChange(
    currentModel: ModelInfo,
    character: string,
    move: string,
    baseDir: string = process.cwd()
): Promise<VersionChangeInfo> {
    const previous = await getLastUsedModelVersion(character, move, baseDir);

    // First run for this character/move
    if (!previous) {
        return {
            changed: false,
            currentVersion: currentModel,
        };
    }

    // Check if model ID changed
    const modelIdChanged = previous.modelId !== currentModel.modelId;

    // Check if version string changed
    const versionChanged = previous.versionString !== currentModel.versionString;

    if (!modelIdChanged && !versionChanged) {
        return {
            changed: false,
            currentVersion: currentModel,
        };
    }

    // Determine change type
    let changeType: VersionChangeType;
    if (modelIdChanged) {
        changeType = 'model_switch';
    } else if (previous.versionString && currentModel.versionString) {
        changeType = compareVersionStrings(previous.versionString, currentModel.versionString);
    } else {
        changeType = 'unknown';
    }

    return {
        changed: true,
        previousVersion: previous,
        currentVersion: currentModel,
        changeType,
    };
}

/**
 * Check if a model is deprecated
 * Note: In production, this would query the Gemini API for model status
 */
export async function checkModelDeprecation(modelId: string): Promise<DeprecationInfo> {
    // Known deprecated models (this would be fetched from API in production)
    const deprecatedModels: Record<string, { date: string; alternative: string }> = {
        'gemini-pro-vision': {
            date: '2024-06-01',
            alternative: 'gemini-1.5-flash',
        },
        'gemini-1.0-pro-vision': {
            date: '2024-06-01',
            alternative: 'gemini-1.5-flash',
        },
    };

    const deprecationInfo = deprecatedModels[modelId];

    if (deprecationInfo) {
        return {
            isDeprecated: true,
            deprecationDate: deprecationInfo.date,
            suggestedAlternative: deprecationInfo.alternative,
        };
    }

    return {
        isDeprecated: false,
    };
}

/**
 * Generate model warnings for a run
 */
export async function generateModelWarnings(
    currentModel: ModelInfo,
    character: string,
    move: string,
    baseDir: string = process.cwd()
): Promise<ModelWarning[]> {
    const warnings: ModelWarning[] = [];

    // Check for version change
    const versionChange = await detectModelVersionChange(currentModel, character, move, baseDir);

    if (versionChange.changed && versionChange.previousVersion) {
        const changeDescription = versionChange.changeType === 'model_switch'
            ? `Model switched from ${versionChange.previousVersion.modelId} to ${currentModel.modelId}`
            : `Model version changed from ${versionChange.previousVersion.versionString || 'unknown'} to ${currentModel.versionString || 'unknown'}`;

        warnings.push({
            type: 'version_change',
            message: changeDescription,
            severity: versionChange.changeType === 'model_switch' ? 'warning' : 'info',
            details: {
                previousModel: versionChange.previousVersion.modelId,
                previousVersion: versionChange.previousVersion.versionString,
                previousLastUsed: versionChange.previousVersion.lastUsed,
                currentModel: currentModel.modelId,
                currentVersion: currentModel.versionString,
                changeType: versionChange.changeType,
            },
        });
    } else if (!versionChange.previousVersion) {
        warnings.push({
            type: 'first_use',
            message: `First run for ${character}/${move} with model ${currentModel.modelId}`,
            severity: 'info',
            details: {
                model: currentModel.modelId,
                version: currentModel.versionString,
            },
        });
    }

    // Check for deprecation
    const deprecation = await checkModelDeprecation(currentModel.modelId);

    if (deprecation.isDeprecated) {
        warnings.push({
            type: 'deprecation',
            message: `Model ${currentModel.modelId} is deprecated`,
            severity: 'warning',
            details: {
                deprecationDate: deprecation.deprecationDate,
                suggestedAlternative: deprecation.suggestedAlternative,
            },
        });
    }

    return warnings;
}

/**
 * Log version change warning to console with formatting
 */
export function logVersionChangeWarning(changeInfo: VersionChangeInfo): void {
    if (!changeInfo.changed || !changeInfo.previousVersion) {
        return;
    }

    const previous = changeInfo.previousVersion;
    const current = changeInfo.currentVersion;

    console.log('');
    console.log(chalk.yellow('⚠️  Model Version Change Detected'));
    console.log(chalk.gray('═'.repeat(55)));
    console.log('');
    console.log(chalk.gray('Previous:'), `${previous.modelId} (${previous.versionString || 'unknown'})`);
    if (previous.lastUsed) {
        console.log(chalk.gray('  Last used:'), previous.lastUsed);
    }
    console.log('');
    console.log(chalk.gray('Current: '), `${current.modelId} (${current.versionString || 'unknown'})`);
    console.log('');
    console.log(chalk.gray('Change Type:'), changeInfo.changeType || 'unknown');
    console.log('');
    console.log(chalk.yellow('Impact:'), 'Output quality may differ slightly. Consider:');
    console.log(chalk.gray('  • Reviewing generated frames carefully'));
    console.log(chalk.gray('  • Comparing with previous run output'));
    console.log(chalk.gray('  • Adjusting thresholds if needed'));
    console.log('');
    console.log(chalk.gray('The run will proceed. This information is logged for reference.'));
    console.log(chalk.gray('═'.repeat(55)));
    console.log('');

    logger.warn({
        event: 'model_version_change',
        previousModel: previous.modelId,
        previousVersion: previous.versionString,
        previousLastUsed: previous.lastUsed,
        currentModel: current.modelId,
        currentVersion: current.versionString,
        changeType: changeInfo.changeType,
    }, 'Model version changed since last run');
}

/**
 * Log deprecation warning to console with formatting
 */
export function logDeprecationWarning(modelId: string, deprecation: DeprecationInfo): void {
    if (!deprecation.isDeprecated) {
        return;
    }

    console.log('');
    console.log(chalk.red('⚠️  Model Deprecation Warning'));
    console.log(chalk.gray('═'.repeat(55)));
    console.log('');
    console.log(chalk.gray('Model:'), modelId);
    console.log('');
    console.log(chalk.red('Status:'), 'DEPRECATED');
    if (deprecation.deprecationDate) {
        console.log(chalk.gray('Sunset Date:'), deprecation.deprecationDate);
    }
    console.log('');
    if (deprecation.suggestedAlternative) {
        console.log(chalk.gray('Suggested Alternative:'), chalk.green(deprecation.suggestedAlternative));
    }
    console.log('');
    console.log(chalk.yellow('Action Required:'));
    console.log(chalk.gray('  1. Update manifest generator.model to use new model'));
    console.log(chalk.gray('  2. Test with sample animation before production runs'));
    console.log(chalk.gray('  3. Review quality metrics for any differences'));
    console.log('');
    console.log(chalk.gray('The run will proceed with the current model.'));
    console.log(chalk.gray('═'.repeat(55)));
    console.log('');

    logger.warn({
        event: 'model_deprecated',
        modelId,
        deprecationDate: deprecation.deprecationDate,
        suggestedAlternative: deprecation.suggestedAlternative,
    }, 'Model is marked as deprecated');
}
