# FrameworkWorker Handoff: Task 7A Generic Dataset Repository

## Identity / cwd

- Agent: FrameworkWorker
- Start cwd: `/Users/xuelin/projects/source2video/packages`
- Branch: `codex/framework-topology`

## Context

Task 4/5 are complete and Orchestrator-verified:

- `a73a8db feat(framework): add artifact store abstraction`
- `412c890 feat(framework): add postgres-backed worker runtime`

Independent verification passed:

- `framework-worker.test.ts` + `framework-store.test.ts`: 11 tests passed
- `pnpm test`: 8 files / 23 tests passed
- `pnpm typecheck`
- `git diff --check`
- framework package business-name scan clean

## Task

Implement **Task 7A: Generic Dataset Repository** from `docs/superpowers/plans/2026-06-05-framework-data-plane-plan.md`, but keep this lane framework-only.

Do:

1. Write RED tests in `doc-maker/ui/tests/runtime/framework-dataset.test.ts`.
2. Implement `packages/framework-store/src/repositories/datasets.ts`.
3. Export repository factory/types from `packages/framework-store/src/index.ts`.
4. Use existing `framework_datasets` / `framework_dataset_items` migration tables; do not add Writing-specific schema.
5. Cover:
   - create/update dataset
   - get/list datasets
   - append dataset draft item
   - item shape preserves source refs, split, labels, metadata
   - SQL is parameterized
   - no business-domain column/table names

Do **not** implement Writing adapter in this lane. Leave these for WritingWorker/integration:

- `doc-maker/packages/writing-domain/**`
- `doc-maker/ui/app/api/framework/datasets/route.ts`
- release gate / experiment runner

## Allowed files

- `packages/framework-store/src/index.ts`
- `packages/framework-store/src/repositories/datasets.ts`
- `doc-maker/ui/tests/runtime/framework-dataset.test.ts`
- `packages/.agent/STATUS.md`
- `packages/.agent/TODO.md`

If a needed file is outside this list, stop and report.

## Required workflow

Use TDD:

1. Run RED test and record the expected failure.
2. Implement minimum GREEN.
3. Run verification.
4. Commit only task files.
5. Update `packages/.agent/STATUS.md` / `TODO.md` after commit, leaving them unstaged if they already have non-task state.

## Verification

Run from `doc-maker/ui`:

```bash
pnpm exec vitest run tests/runtime/framework-dataset.test.ts tests/runtime/framework-store.test.ts
pnpm test
pnpm typecheck
```

Run from repo root:

```bash
git diff --check
if rg -n 'writing_|doc-maker|docMaker|Writing' packages/framework-store packages/workflow-core packages/artifact-store packages/framework-runtime; then exit 1; else echo business-name-scan-clean; fi
```

## Commit

```bash
git add packages/framework-store/src/index.ts packages/framework-store/src/repositories/datasets.ts doc-maker/ui/tests/runtime/framework-dataset.test.ts
git commit -m "feat(framework): persist dataset drafts"
```

Do not push.

## Stop conditions

Stop and report if:

- tests/typecheck fail after reasonable fix attempts
- implementation needs Writing adapter files
- implementation needs API route or UI changes
- implementation needs migration schema changes beyond current generic tables
- git push/deploy is requested
