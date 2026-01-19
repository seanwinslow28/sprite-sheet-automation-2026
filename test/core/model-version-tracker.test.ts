/**
 * Tests for model version tracking and change detection
 * Per Story 6.7: Model version warning system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import {
    loadModelHistory,
    saveModelHistory,
    getLastUsedModelVersion,
    updateModelHistory,
    compareVersionStrings,
    detectModelVersionChange,
    checkModelDeprecation,
    generateModelWarnings,
    getModelHistoryPath,
    type ModelInfo,
    type ModelHistory,
} from '../../src/core/model-version-tracker.js';

describe('Model Version Tracker', () => {
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(tmpdir(), `model-version-test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('getModelHistoryPath', () => {
        it('should return correct path', () => {
            const historyPath = getModelHistoryPath('/test/dir');
            expect(historyPath).toBe(path.join('/test/dir', '.sprite-pipeline', 'model-history.json'));
        });
    });

    describe('loadModelHistory', () => {
        it('should return empty history when file does not exist', async () => {
            const history = await loadModelHistory(testDir);

            expect(history.characters).toEqual({});
            expect(history.lastUpdated).toBeDefined();
        });

        it('should load existing history file', async () => {
            const historyDir = path.join(testDir, '.sprite-pipeline');
            await fs.mkdir(historyDir, { recursive: true });

            const existingHistory: ModelHistory = {
                lastUpdated: '2026-01-18T10:00:00.000Z',
                characters: {
                    'BLAZE': {
                        'idle': {
                            modelId: 'gemini-2.0-flash-exp',
                            versionString: '2024.01.15',
                            lastUsed: '2026-01-17T10:00:00.000Z',
                        },
                    },
                },
            };

            await fs.writeFile(
                path.join(historyDir, 'model-history.json'),
                JSON.stringify(existingHistory),
                'utf-8'
            );

            const history = await loadModelHistory(testDir);

            expect(history.characters['BLAZE']).toBeDefined();
            expect(history.characters['BLAZE']['idle'].modelId).toBe('gemini-2.0-flash-exp');
        });

        it('should return empty history on invalid JSON', async () => {
            const historyDir = path.join(testDir, '.sprite-pipeline');
            await fs.mkdir(historyDir, { recursive: true });

            await fs.writeFile(
                path.join(historyDir, 'model-history.json'),
                'invalid json',
                'utf-8'
            );

            const history = await loadModelHistory(testDir);
            expect(history.characters).toEqual({});
        });
    });

    describe('saveModelHistory', () => {
        it('should create directory and save history', async () => {
            const history: ModelHistory = {
                lastUpdated: '2026-01-18T10:00:00.000Z',
                characters: {
                    'NOVA': {
                        'attack': {
                            modelId: 'gemini-2.0-flash-exp',
                        },
                    },
                },
            };

            await saveModelHistory(history, testDir);

            const historyPath = getModelHistoryPath(testDir);
            const exists = await fs.access(historyPath).then(() => true).catch(() => false);
            expect(exists).toBe(true);

            const saved = JSON.parse(await fs.readFile(historyPath, 'utf-8'));
            expect(saved.characters['NOVA']['attack'].modelId).toBe('gemini-2.0-flash-exp');
        });

        it('should update lastUpdated timestamp', async () => {
            const history: ModelHistory = {
                lastUpdated: '2020-01-01T00:00:00.000Z',
                characters: {},
            };

            await saveModelHistory(history, testDir);

            const historyPath = getModelHistoryPath(testDir);
            const saved = JSON.parse(await fs.readFile(historyPath, 'utf-8'));

            expect(saved.lastUpdated).not.toBe('2020-01-01T00:00:00.000Z');
        });
    });

    describe('getLastUsedModelVersion', () => {
        it('should return null for unknown character/move', async () => {
            const result = await getLastUsedModelVersion('UNKNOWN', 'idle', testDir);
            expect(result).toBeNull();
        });

        it('should return model info for known character/move', async () => {
            const history: ModelHistory = {
                lastUpdated: '2026-01-18T10:00:00.000Z',
                characters: {
                    'BLAZE': {
                        'walk': {
                            modelId: 'gemini-2.0-flash-exp',
                            versionString: '2024.01.20',
                        },
                    },
                },
            };

            const historyDir = path.join(testDir, '.sprite-pipeline');
            await fs.mkdir(historyDir, { recursive: true });
            await fs.writeFile(
                path.join(historyDir, 'model-history.json'),
                JSON.stringify(history),
                'utf-8'
            );

            const result = await getLastUsedModelVersion('BLAZE', 'walk', testDir);

            expect(result).not.toBeNull();
            expect(result!.modelId).toBe('gemini-2.0-flash-exp');
            expect(result!.versionString).toBe('2024.01.20');
        });
    });

    describe('updateModelHistory', () => {
        it('should create entry for new character/move', async () => {
            const modelInfo: ModelInfo = {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.20',
            };

            await updateModelHistory('NOVA', 'attack', modelInfo, 'run-123', testDir);

            const history = await loadModelHistory(testDir);
            expect(history.characters['NOVA']['attack']).toBeDefined();
            expect(history.characters['NOVA']['attack'].modelId).toBe('gemini-2.0-flash-exp');
            expect(history.characters['NOVA']['attack'].runId).toBe('run-123');
        });

        it('should update existing entry', async () => {
            // Create initial entry
            await updateModelHistory('BLAZE', 'idle', {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.15',
            }, 'run-001', testDir);

            // Update entry
            await updateModelHistory('BLAZE', 'idle', {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.20',
            }, 'run-002', testDir);

            const history = await loadModelHistory(testDir);
            expect(history.characters['BLAZE']['idle'].versionString).toBe('2024.01.20');
            expect(history.characters['BLAZE']['idle'].runId).toBe('run-002');
        });

        it('should update global last model', async () => {
            await updateModelHistory('NOVA', 'attack', {
                modelId: 'gemini-2.5-flash',
                versionString: '2024.02.01',
            }, 'run-123', testDir);

            const history = await loadModelHistory(testDir);
            expect(history.globalLastModel).toBeDefined();
            expect(history.globalLastModel!.modelId).toBe('gemini-2.5-flash');
        });
    });

    describe('compareVersionStrings', () => {
        it('should detect major version change', () => {
            expect(compareVersionStrings('1.0.0', '2.0.0')).toBe('major');
            expect(compareVersionStrings('2024.01.15', '2025.01.15')).toBe('major');
        });

        it('should detect minor version change', () => {
            expect(compareVersionStrings('1.0.0', '1.1.0')).toBe('minor');
            expect(compareVersionStrings('2024.01.15', '2024.02.15')).toBe('minor');
        });

        it('should detect patch version change', () => {
            expect(compareVersionStrings('1.0.0', '1.0.1')).toBe('patch');
            expect(compareVersionStrings('2024.01.15', '2024.01.20')).toBe('patch');
        });

        it('should return unknown for different formats', () => {
            expect(compareVersionStrings('1.0.0', 'v2')).toBe('unknown');
            expect(compareVersionStrings('abc', 'def')).toBe('major'); // String comparison falls through
        });
    });

    describe('detectModelVersionChange', () => {
        it('should detect no change for first run', async () => {
            const currentModel: ModelInfo = {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.20',
            };

            const result = await detectModelVersionChange(currentModel, 'NEW_CHAR', 'idle', testDir);

            expect(result.changed).toBe(false);
            expect(result.previousVersion).toBeUndefined();
        });

        it('should detect no change when version matches', async () => {
            // Set up history
            await updateModelHistory('BLAZE', 'idle', {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.20',
            }, 'run-001', testDir);

            const currentModel: ModelInfo = {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.20',
            };

            const result = await detectModelVersionChange(currentModel, 'BLAZE', 'idle', testDir);

            expect(result.changed).toBe(false);
        });

        it('should detect model switch', async () => {
            // Set up history with old model
            await updateModelHistory('BLAZE', 'idle', {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.15',
            }, 'run-001', testDir);

            const currentModel: ModelInfo = {
                modelId: 'gemini-2.5-flash',
                versionString: '2024.02.01',
            };

            const result = await detectModelVersionChange(currentModel, 'BLAZE', 'idle', testDir);

            expect(result.changed).toBe(true);
            expect(result.changeType).toBe('model_switch');
            expect(result.previousVersion?.modelId).toBe('gemini-2.0-flash-exp');
        });

        it('should detect version change within same model', async () => {
            // Set up history
            await updateModelHistory('BLAZE', 'idle', {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.15',
            }, 'run-001', testDir);

            const currentModel: ModelInfo = {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.20',
            };

            const result = await detectModelVersionChange(currentModel, 'BLAZE', 'idle', testDir);

            expect(result.changed).toBe(true);
            expect(result.changeType).toBe('patch');
        });
    });

    describe('checkModelDeprecation', () => {
        it('should detect deprecated model', async () => {
            const deprecation = await checkModelDeprecation('gemini-pro-vision');

            expect(deprecation.isDeprecated).toBe(true);
            expect(deprecation.deprecationDate).toBeDefined();
            expect(deprecation.suggestedAlternative).toBe('gemini-1.5-flash');
        });

        it('should return not deprecated for current models', async () => {
            const deprecation = await checkModelDeprecation('gemini-2.0-flash-exp');

            expect(deprecation.isDeprecated).toBe(false);
            expect(deprecation.deprecationDate).toBeUndefined();
        });
    });

    describe('generateModelWarnings', () => {
        it('should generate first use warning', async () => {
            const warnings = await generateModelWarnings({
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.20',
            }, 'NEW_CHAR', 'idle', testDir);

            expect(warnings.length).toBe(1);
            expect(warnings[0].type).toBe('first_use');
            expect(warnings[0].severity).toBe('info');
        });

        it('should generate version change warning', async () => {
            // Set up history
            await updateModelHistory('BLAZE', 'idle', {
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.15',
            }, 'run-001', testDir);

            const warnings = await generateModelWarnings({
                modelId: 'gemini-2.0-flash-exp',
                versionString: '2024.01.20',
            }, 'BLAZE', 'idle', testDir);

            const versionWarning = warnings.find(w => w.type === 'version_change');
            expect(versionWarning).toBeDefined();
            expect(versionWarning!.severity).toBe('info');
        });

        it('should generate model switch warning with higher severity', async () => {
            // Set up history
            await updateModelHistory('BLAZE', 'idle', {
                modelId: 'gemini-2.0-flash-exp',
            }, 'run-001', testDir);

            const warnings = await generateModelWarnings({
                modelId: 'gemini-2.5-flash',
            }, 'BLAZE', 'idle', testDir);

            const switchWarning = warnings.find(w => w.type === 'version_change');
            expect(switchWarning).toBeDefined();
            expect(switchWarning!.severity).toBe('warning');
        });

        it('should generate deprecation warning', async () => {
            const warnings = await generateModelWarnings({
                modelId: 'gemini-pro-vision',
            }, 'NEW_CHAR', 'idle', testDir);

            const deprecationWarning = warnings.find(w => w.type === 'deprecation');
            expect(deprecationWarning).toBeDefined();
            expect(deprecationWarning!.severity).toBe('warning');
            expect(deprecationWarning!.details?.suggestedAlternative).toBe('gemini-1.5-flash');
        });

        it('should generate multiple warnings', async () => {
            // Use deprecated model with version change
            await updateModelHistory('BLAZE', 'idle', {
                modelId: 'gemini-1.0-pro-vision',
                versionString: '2023.12.01',
            }, 'run-001', testDir);

            const warnings = await generateModelWarnings({
                modelId: 'gemini-pro-vision',
                versionString: '2024.01.01',
            }, 'BLAZE', 'idle', testDir);

            expect(warnings.length).toBeGreaterThanOrEqual(2);
            expect(warnings.some(w => w.type === 'version_change')).toBe(true);
            expect(warnings.some(w => w.type === 'deprecation')).toBe(true);
        });
    });
});
