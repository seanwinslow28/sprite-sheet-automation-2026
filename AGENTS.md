# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the TypeScript CLI and pipeline logic (entry: `src/bin.ts`).
- `src/core/`, `src/domain/`, `src/commands/`, and `src/adapters/` contain the main pipeline layers.
- `test/` and `src/__tests__/` contain Vitest suites (most tests live in `test/`).
- `assets/` and `test-fixtures/` store sample inputs/fixtures used by tests.
- `dist/` is the compiled output from `tsc` (do not edit by hand).
- `runs/` stores generated run artifacts (local outputs).

## Build, Test, and Development Commands
- `npm run dev` — runs the CLI directly from TypeScript via `tsx` (fast local iteration).
- `npm run build` — compiles to `dist/` using `tsc` for release builds.
- `npm run test` — runs the Vitest suite.

## Coding Style & Naming Conventions
- TypeScript, ES2022, NodeNext modules (see `tsconfig.json`).
- 2-space indentation and consistent casing for file names.
- Test files use `*.test.ts` naming (e.g., `test/core/orchestrator.test.ts`).
- Favor explicit types where the pipeline boundary is critical (manifests, adapters, exports).

## Testing Guidelines
- Framework: Vitest.
- Tests live primarily under `test/` by domain area; some legacy coverage exists in `src/__tests__/`.
- Keep new tests alongside the related domain folder (e.g., `test/core/...`).
- Run all tests before PRs: `npm run test`.

## Commit & Pull Request Guidelines
- Commit style follows `type: summary` (e.g., `feat: add export validator`).
- Keep commits focused and include tests for new behavior or bug fixes.
- PRs should include: a short summary, testing notes, and any relevant output artifacts (e.g., sample run logs or atlas previews) when touching export/validation logic.

## Security & Configuration Tips
- Use `.env.example` and `.mcp.json.example` as templates; do not commit secrets.
- Treat `runs/` as local output; avoid committing large generated assets unless explicitly required.
