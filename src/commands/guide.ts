/**
 * Guide command - displays operator guide documentation
 * Per Story 6.6: CLI access to operator guide
 */

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { pathExists } from '../utils/fs-helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the operator guide path
 */
export function getGuidePath(): string {
    // Try multiple locations
    const possiblePaths = [
        path.join(__dirname, '../../docs/operator-guide.md'),
        path.join(process.cwd(), 'docs/operator-guide.md'),
    ];

    for (const guidePath of possiblePaths) {
        // Return first path (actual existence checked at runtime)
        return guidePath;
    }

    return possiblePaths[0];
}

/**
 * Load the operator guide content
 */
export async function loadGuide(): Promise<string> {
    const possiblePaths = [
        path.join(__dirname, '../../docs/operator-guide.md'),
        path.join(process.cwd(), 'docs/operator-guide.md'),
    ];

    for (const guidePath of possiblePaths) {
        if (await pathExists(guidePath)) {
            return fs.readFile(guidePath, 'utf-8');
        }
    }

    throw new Error('Operator guide not found. Expected at: docs/operator-guide.md');
}

/**
 * Extract a specific section from the guide
 */
export function extractSection(content: string, sectionName: string): string | null {
    // Split content by major section headers
    const lines = content.split('\n');
    const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const headerPattern = new RegExp(`^## \\d+\\.\\s*${escapedName}`, 'i');
    const nextHeaderPattern = /^## \d+\./;

    let capturing = false;
    let sectionLines: string[] = [];

    for (const line of lines) {
        if (headerPattern.test(line)) {
            capturing = true;
            sectionLines.push(line);
        } else if (capturing) {
            if (nextHeaderPattern.test(line)) {
                break;
            }
            sectionLines.push(line);
        }
    }

    if (sectionLines.length === 0) {
        return null;
    }

    return sectionLines.join('\n').trim();
}

/**
 * Get all section names from the guide
 */
export function getSectionNames(content: string): string[] {
    const sectionPattern = /^## \d+\.\s*(.+)$/gm;
    const sections: string[] = [];
    let match;

    while ((match = sectionPattern.exec(content)) !== null) {
        sections.push(match[1].trim());
    }

    return sections;
}

/**
 * Simple markdown to terminal formatting
 */
export function formatMarkdownForTerminal(content: string): string {
    let formatted = content;

    // Headers
    formatted = formatted.replace(/^# (.+)$/gm, chalk.bold.blue('$1'));
    formatted = formatted.replace(/^## (.+)$/gm, chalk.bold.cyan('\n$1'));
    formatted = formatted.replace(/^### (.+)$/gm, chalk.bold.yellow('$1'));

    // Bold text
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, chalk.bold('$1'));

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, chalk.green('$1'));

    // Code blocks (preserve but highlight)
    formatted = formatted.replace(/```(\w+)?\n([\s\S]+?)```/g, (_, _lang, code) => {
        return chalk.gray('─'.repeat(40)) + '\n' + chalk.dim(code.trim()) + '\n' + chalk.gray('─'.repeat(40));
    });

    // Tables - simplify for terminal
    formatted = formatted.replace(/^\|(.+)\|$/gm, (line) => {
        return chalk.gray(line);
    });

    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\([^)]+\)/g, chalk.underline('$1'));

    return formatted;
}

/**
 * Register the guide command
 */
export function registerGuideCommand(program: Command): void {
    program
        .command('guide')
        .description('Display the operator guide documentation')
        .option('-s, --section <name>', 'Display a specific section')
        .option('-l, --list', 'List all section names')
        .option('-o, --output <path>', 'Save guide to a file instead of displaying')
        .option('--raw', 'Output raw markdown without terminal formatting')
        .action(async (options: {
            section?: string;
            list?: boolean;
            output?: string;
            raw?: boolean;
        }) => {
            try {
                const content = await loadGuide();

                // List sections
                if (options.list) {
                    const sections = getSectionNames(content);
                    console.log(chalk.bold('\nOperator Guide Sections:\n'));
                    sections.forEach((section, index) => {
                        console.log(`  ${chalk.cyan(index + 1)}. ${section}`);
                    });
                    console.log('');
                    console.log(chalk.gray('Use --section <name> to view a specific section'));
                    console.log('');
                    return;
                }

                // Extract specific section
                let outputContent = content;
                if (options.section) {
                    const section = extractSection(content, options.section);
                    if (!section) {
                        const sections = getSectionNames(content);
                        console.error(chalk.red(`Section "${options.section}" not found.`));
                        console.error(chalk.yellow('\nAvailable sections:'));
                        sections.forEach(s => console.error(`  - ${s}`));
                        process.exit(1);
                    }
                    outputContent = section;
                }

                // Save to file
                if (options.output) {
                    await fs.writeFile(options.output, outputContent, 'utf-8');
                    console.log(chalk.green(`Guide saved to: ${options.output}`));
                    return;
                }

                // Display to terminal
                if (options.raw) {
                    console.log(outputContent);
                } else {
                    console.log(formatMarkdownForTerminal(outputContent));
                }

            } catch (error) {
                console.error(chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
                process.exit(1);
            }
        });
}
