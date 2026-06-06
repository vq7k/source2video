# WritingWorker Handoff: Task 7B Writing Dataset Adapter

## Identity / cwd

- Agent: WritingWorker
- Start cwd: `/Users/xuelin/projects/source2video/doc-maker`
- Branch: `codex/framework-topology`

## Context

FrameworkWorker completed and Orchestrator-verified:

- `55cd28e feat(framework): persist dataset drafts`

Available public framework API:

- `createPostgresDatasetRepository`
- `FrameworkDatasetRecord`
- `FrameworkDatasetItem`
- dataset item fields: `sourceRunId`, `sourceArtifactId`, `inputRef`, `expectedOutputRef`, `split`, `labels`, `metadata`

## Task

Connect the existing Writing readiness projection to the formal framework dataset item contract.

Do:

1. Extend `packages/writing-domain/src/adapter-readiness.ts`.
2. Add a function that converts each `WritingDatasetDraftItem` into a `FrameworkDatasetItem`.
3. Keep Writing semantics in adapter metadata/labels/artifact refs; do not add framework schema names.
4. Extend `ui/tests/runtime/writing-adapter-readiness.test.ts` to verify:
   - output is a `FrameworkDatasetItem`
   - `split === "draft"`
   - `sourceRunId` and candidate/source artifact reference survive
   - label JSON contains feedback verdict/confidence/status
   - metadata contains `domain: "writing"` and `reviewStatus: "needs_human_confirmation"`
   - the item can be appended through `createPostgresDatasetRepository` using a fake SQL client

Do not implement API routes, UI, release gates, experiments, job runtime, or framework internals.

## Allowed files

- `packages/writing-domain/src/adapter-readiness.ts`
- `ui/tests/runtime/writing-adapter-readiness.test.ts`
- `.agent/STATUS.md`
- `.agent/TODO.md`

If a needed file is outside this list, stop and report.

## Required workflow

Use TDD:

1. Write/extend RED test first.
2. Run targeted test and record expected failure.
3. Implement minimal GREEN.
4. Run verification.
5. Commit only task files.
6. Update `.agent/STATUS.md` / `TODO.md` after commit, leaving them unstaged if they already have session state.

## Verification

Run from `doc-maker/ui`:

```bash
pnpm exec vitest run tests/runtime/writing-adapter-readiness.test.ts tests/runtime/framework-dataset.test.ts
pnpm test
pnpm typecheck
```

Run from repo root:

```bash
git diff --check
git diff --name-only HEAD
```

Confirm no `packages/**` framework files changed in this task.

## Commit

```bash
git add doc-maker/packages/writing-domain/src/adapter-readiness.ts doc-maker/ui/tests/runtime/writing-adapter-readiness.test.ts
git commit -m "feat(writing): adapt dataset drafts to framework items"
```

Do not push.

## Stop conditions

Stop and report if:

- implementation needs `packages/**` framework changes
- implementation needs API route/UI changes
- tests/typecheck fail after reasonable fix attempts
- git push/deploy is requested
