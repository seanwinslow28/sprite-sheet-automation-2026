/**
 * Configuration resolver - merges manifest > defaults > env
 * Handles config hierarchy per NFR47 and validation error formatting per NFR18
 */

import { ZodError, ZodIssue } from 'zod';
import { manifestSchema, type Manifest } from '../domain/schemas/manifest.js';

// Result type for functional error handling
export type Result<T, E> =
    | { ok: true; value: T }
    | { ok: false; error: E };

export const Result = {
    ok: <T>(value: T): Result<T, never> => ({ ok: true, value }),
    err: <E>(error: E): Result<never, E> => ({ ok: false, error }),
};

// Validation error with actionable information
export interface ValidationError {
    code: 'VALIDATION_ERROR';
    field: string;
    expected: string;
    received: string;
    fix: string;
}

// System error for non-validation failures
export interface SystemError {
    code: string;
    message: string;
    cause?: unknown;
}

/**
 * Format a Zod error into a user-friendly ValidationError
 */
export function formatZodError(error: ZodError): ValidationError[] {
    return error.issues.map((issue: ZodIssue): ValidationError => {
        const field = issue.path.join('.');
        const expected = getExpectedType(issue);
        const received = getReceivedType(issue);
        const fix = generateFix(issue, field);

        return {
            code: 'VALIDATION_ERROR',
            field: field || '(root)',
            expected,
            received,
            fix,
        };
    });
}

/**
 * Extract expected type from Zod issue
 */
function getExpectedType(issue: ZodIssue): string {
    switch (issue.code) {
        case 'invalid_type':
            return issue.expected;
        case 'invalid_literal':
            return `literal ${JSON.stringify(issue.expected)}`;
        case 'invalid_enum_value':
            return `one of: ${(issue.options as string[]).join(', ')}`;
        case 'too_small':
            return `minimum ${issue.minimum}`;
        case 'too_big':
            return `maximum ${issue.maximum}`;
        default:
            return issue.message;
    }
}

/**
 * Extract received type/value from Zod issue
 */
function getReceivedType(issue: ZodIssue): string {
    switch (issue.code) {
        case 'invalid_type':
            return issue.received;
        case 'invalid_literal':
            return 'different value';
        case 'invalid_enum_value':
            return `"${issue.received}"`;
        default:
            return 'invalid value';
    }
}

/**
 * Generate actionable fix suggestion
 */
function generateFix(issue: ZodIssue, field: string): string {
    switch (issue.code) {
        case 'invalid_type':
            if (issue.received === 'undefined') {
                return `Add required field '${field}' with type ${issue.expected}`;
            }
            return `Change '${field}' from ${issue.received} to ${issue.expected}`;
        case 'invalid_literal':
            return `Set '${field}' to ${JSON.stringify(issue.expected)}`;
        case 'invalid_enum_value':
            return `Use one of: ${(issue.options as string[]).join(', ')}`;
        case 'too_small':
            return `Increase '${field}' to at least ${issue.minimum}`;
        case 'too_big':
            return `Decrease '${field}' to at most ${issue.maximum}`;
        default:
            return issue.message;
    }
}

// Default manifest values
const DEFAULTS: Partial<Manifest> = {
    canvas: {
        generation_size: 512,
        target_size: 128,
        downsample_method: 'nearest',
        alignment: {
            method: 'contact_patch',
            vertical_lock: true,
            root_zone_ratio: 0.15,
            max_shift_x: 32,
        },
    },
};

/**
 * Deep merge two objects (target wins over source)
 */
function deepMerge<T extends Record<string, unknown>>(source: T, target: Partial<T>): T {
    const result = { ...source };

    for (const key in target) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
            const sourceVal = source[key];
            const targetVal = target[key];

            if (
                targetVal !== undefined &&
                typeof sourceVal === 'object' &&
                sourceVal !== null &&
                typeof targetVal === 'object' &&
                targetVal !== null &&
                !Array.isArray(sourceVal)
            ) {
                result[key] = deepMerge(
                    sourceVal as Record<string, unknown>,
                    targetVal as Record<string, unknown>
                ) as T[typeof key];
            } else if (targetVal !== undefined) {
                result[key] = targetVal as T[typeof key];
            }
        }
    }

    return result;
}

/**
 * Resolve environment variables into config
 */
function resolveEnvOverrides(): Partial<Manifest> {
    const overrides: Partial<Manifest> = {};

    // Only specific fields can be overridden via env
    // API keys and paths are handled elsewhere (not in manifest)

    return overrides;
}

/**
 * Validate and resolve a manifest with config hierarchy
 * Hierarchy: manifest values > defaults > env variables
 */
export function validateManifest(input: unknown): Result<Manifest, ValidationError[]> {
    // Apply defaults first
    const withDefaults = deepMerge(
        DEFAULTS as Record<string, unknown>,
        input as Record<string, unknown>
    );

    // Apply env overrides
    const withEnv = deepMerge(
        withDefaults,
        resolveEnvOverrides() as Record<string, unknown>
    );

    // Validate against schema
    const result = manifestSchema.safeParse(withEnv);

    if (result.success) {
        return Result.ok(result.data);
    }

    return Result.err(formatZodError(result.error));
}

/**
 * Validate manifest without applying defaults (strict mode)
 */
export function validateManifestStrict(input: unknown): Result<Manifest, ValidationError[]> {
    const result = manifestSchema.safeParse(input);

    if (result.success) {
        return Result.ok(result.data);
    }

    return Result.err(formatZodError(result.error));
}
