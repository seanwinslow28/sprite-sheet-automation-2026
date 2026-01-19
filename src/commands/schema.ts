/**
 * Schema command - outputs manifest schema and examples
 */

import { Command } from 'commander';
import { manifestSchema } from '../domain/schemas/manifest.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function registerSchemaCommand(program: Command): void {
    program
        .command('schema')
        .description('View manifest schema and examples')
        .option('--format <type>', 'Output format: json or yaml', 'json')
        .option('--example', 'Output example manifest instead of schema')
        .action((options) => {
            if (options.example) {
                // Output example manifest
                const examplePath = join(__dirname, '../../assets/examples/sample-manifest.yaml');
                const example = readFileSync(examplePath, 'utf-8');
                console.log(example);
            } else {
                // Output JSON Schema
                const jsonSchema = zodToJsonSchema(manifestSchema, {
                    $refStrategy: 'none',
                }) as Record<string, unknown>;

                // Add metadata - jsonSchema already has properties at top level
                const schema = {
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    title: 'Sprite Animation Manifest Schema',
                    description: 'Complete schema for sprite animation generation manifests',
                    ...jsonSchema,
                };

                if (options.format === 'yaml') {
                    console.log('YAML output not yet implemented - showing JSON');
                }

                console.log(JSON.stringify(schema, null, 2));
            }
        });
}
