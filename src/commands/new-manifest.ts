/**
 * New manifest command - creates manifest files from templates
 * Per Story 6.5: Quick manifest generation for new characters/moves
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { pathExists } from '../utils/fs-helpers.js';
import { manifestSchema } from '../domain/schemas/manifest.js';
import { parse as parseYaml } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Preset configurations for different character types
 */
export const MANIFEST_PRESETS = {
    champion: {
        target_size: 128,
        frame_count: 8,
        identity_min: 0.80,
        description: 'Standard player character',
    },
    boss: {
        target_size: 256,
        frame_count: 12,
        identity_min: 0.75, // Slightly relaxed for larger sprites
        description: 'Boss characters with more detail',
    },
    npc: {
        target_size: 128,
        frame_count: 4,
        identity_min: 0.85, // Stricter for simpler designs
        description: 'Simple NPCs with fewer frames',
    },
} as const;

export type PresetType = keyof typeof MANIFEST_PRESETS;

/**
 * Validate character/move names
 */
export function validateName(name: string, field: string): string | null {
    if (!name || name.trim().length === 0) {
        return `${field} name cannot be empty`;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
        return `${field} name must start with a letter and contain only letters, numbers, underscores, or hyphens`;
    }
    if (name.length > 32) {
        return `${field} name must be 32 characters or less`;
    }
    return null;
}

/**
 * Sanitize name for use in paths (lowercase, replace hyphens with underscores)
 */
export function sanitizeName(name: string): string {
    return name.toLowerCase().replace(/-/g, '_');
}

/**
 * Generate output path from character and move names
 */
export function generateOutputPath(
    character: string,
    move: string,
    outputDir: string = 'manifests'
): string {
    const sanitizedChar = sanitizeName(character);
    const sanitizedMove = sanitizeName(move);
    return path.join(outputDir, `${sanitizedChar}-${sanitizedMove}.yaml`);
}

/**
 * Load manifest template
 */
export async function loadTemplate(): Promise<string> {
    // Try multiple locations for the template
    const possiblePaths = [
        path.join(__dirname, '../../assets/templates/manifest.yaml.template'),
        path.join(process.cwd(), 'assets/templates/manifest.yaml.template'),
    ];

    for (const templatePath of possiblePaths) {
        if (await pathExists(templatePath)) {
            return fs.readFile(templatePath, 'utf-8');
        }
    }

    throw new Error('Manifest template not found. Expected at: assets/templates/manifest.yaml.template');
}

/**
 * Replace template placeholders with values
 */
export function applyReplacements(
    template: string,
    replacements: Record<string, string>
): string {
    let result = template;
    for (const [placeholder, value] of Object.entries(replacements)) {
        result = result.replaceAll(placeholder, value);
    }
    return result;
}

/**
 * Generate manifest from template
 */
export async function generateManifest(
    character: string,
    move: string,
    preset: PresetType = 'champion'
): Promise<string> {
    const template = await loadTemplate();
    const presetValues = MANIFEST_PRESETS[preset];

    const replacements: Record<string, string> = {
        '{{CHARACTER}}': character.toUpperCase(),
        '{{CHARACTER_LOWER}}': sanitizeName(character),
        '{{MOVE}}': move.toLowerCase(),
        '{{DATE}}': new Date().toISOString().split('T')[0],
        '{{TARGET_SIZE}}': presetValues.target_size.toString(),
        '{{FRAME_COUNT}}': presetValues.frame_count.toString(),
        '{{IDENTITY_MIN}}': presetValues.identity_min.toString(),
    };

    return applyReplacements(template, replacements);
}

/**
 * Validate generated manifest against schema
 */
export function validateManifest(content: string): { valid: boolean; errors: string[] } {
    try {
        const parsed = parseYaml(content);
        const result = manifestSchema.safeParse(parsed);

        if (result.success) {
            return { valid: true, errors: [] };
        }

        const errors = result.error.issues.map(issue =>
            `${issue.path.join('.')}: ${issue.message}`
        );
        return { valid: false, errors };
    } catch (error) {
        return {
            valid: false,
            errors: [error instanceof Error ? error.message : 'Invalid YAML syntax'],
        };
    }
}

/**
 * Register new-manifest command
 */
export function registerNewManifestCommand(program: Command): void {
    program
        .command('new-manifest')
        .description('Create a new manifest file from template')
        .requiredOption('-c, --character <name>', 'Character name (e.g., NOVA)')
        .requiredOption('-m, --move <name>', 'Move name (e.g., idle_standard)')
        .option('-o, --output <path>', 'Custom output path')
        .option('-p, --preset <type>', 'Preset type: champion, boss, npc', 'champion')
        .option('-f, --force', 'Overwrite existing file', false)
        .option('--validate', 'Validate generated manifest against schema', true)
        .option('--manifests-dir <dir>', 'Manifests directory', 'manifests')
        .action(async (options: {
            character: string;
            move: string;
            output?: string;
            preset: string;
            force: boolean;
            validate: boolean;
            manifestsDir: string;
        }) => {
            const { character, move, output, preset, force, validate, manifestsDir } = options;

            // Validate names
            const charError = validateName(character, 'Character');
            if (charError) {
                console.error(chalk.red(`Error: ${charError}`));
                process.exit(1);
            }

            const moveError = validateName(move, 'Move');
            if (moveError) {
                console.error(chalk.red(`Error: ${moveError}`));
                process.exit(1);
            }

            // Validate preset
            if (!Object.keys(MANIFEST_PRESETS).includes(preset)) {
                console.error(chalk.red(`Error: Invalid preset "${preset}". Valid presets: ${Object.keys(MANIFEST_PRESETS).join(', ')}`));
                process.exit(1);
            }

            const presetKey = preset as PresetType;
            const presetConfig = MANIFEST_PRESETS[presetKey];

            // Generate output path
            const outputPath = output || generateOutputPath(character, move, manifestsDir);
            const outputDir = path.dirname(outputPath);

            // Check if file exists
            if (await pathExists(outputPath)) {
                if (!force) {
                    console.error(chalk.red(`Error: File already exists: ${outputPath}`));
                    console.error(chalk.yellow('Use --force to overwrite'));
                    process.exit(1);
                }
                console.log(chalk.yellow(`Overwriting: ${outputPath}`));
            }

            console.log('');
            console.log(chalk.bold(`Creating manifest for ${character.toUpperCase()} - ${move}`));
            console.log('');
            console.log(`Using preset: ${chalk.cyan(preset)} (${presetConfig.target_size}px, ${presetConfig.frame_count} frames)`);
            console.log('');

            try {
                // Generate manifest
                const content = await generateManifest(character, move, presetKey);

                // Validate if requested
                if (validate) {
                    const validation = validateManifest(content);
                    if (!validation.valid) {
                        console.error(chalk.red('Generated manifest failed validation:'));
                        for (const err of validation.errors) {
                            console.error(chalk.red(`  - ${err}`));
                        }
                        console.error('');
                        console.error(chalk.yellow('This is likely a bug in the template. Please report it.'));
                        process.exit(1);
                    }
                }

                // Create directory if needed
                if (!(await pathExists(outputDir))) {
                    await fs.mkdir(outputDir, { recursive: true });
                }

                // Write file
                await fs.writeFile(outputPath, content, 'utf-8');

                console.log(chalk.green(`Generated: ${outputPath}`));
                console.log('');
                console.log(chalk.bold('Next steps:'));
                console.log(`  1. Update asset paths in the manifest`);
                console.log(`  2. Create prompt templates in assets/prompts/${sanitizeName(character)}/`);
                console.log(`  3. Run: ${chalk.cyan(`banana run ${outputPath}`)}`);
            } catch (error) {
                console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });
}
