# Writing Dataset Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Writing feedback data loop from Feedback Ledger to dataset draft, human-confirmed eval dataset, and real Postgres verification.

**Architecture:** Keep Writing as the adapter owner and framework-store as the generic dataset store. Dataset drafts stay in `writing_dataset_draft`; human confirmation promotes copied items into `writing_eval_dataset` so draft rows are not mutated or silently published.

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, framework-store Postgres repository, Docker Postgres for local verification.

---

### Task 1: Human-confirmed eval dataset promotion

**Files:**
- Modify: `doc-maker/packages/writing-domain/src/dataset-draft-persistence.ts`
- Modify: `doc-maker/ui/tests/runtime/writing-dataset-persistence.test.ts`

- [x] **Step 1: Write the failing tests**

Add tests that prove:
- draft persistence writes split `draft` into `writing_dataset_draft`;
- promotion requires an explicit human confirmation;
- promotion writes copied items into `writing_eval_dataset` with split `validation` and `reviewStatus: "human_confirmed"`.

- [x] **Step 2: Run the targeted test and verify RED**

Run: `pnpm --dir doc-maker/ui vitest run tests/runtime/writing-dataset-persistence.test.ts`
Expected: FAIL because `promoteWritingDatasetDraftsForRun` and `WRITING_EVAL_DATASET_ID` do not exist.

- [x] **Step 3: Implement minimal promotion**

Add:
- `WRITING_EVAL_DATASET_ID = "writing_eval_dataset"`;
- confirmation options with `confirmedBy`, `confirmedAt`, and optional `note`;
- `promoteWritingDatasetDraftsForRun()` that builds dataset draft items, copies them into eval items, changes item ids, sets split `validation`, and stores confirmation metadata.

- [x] **Step 4: Run targeted test and verify GREEN**

Run: `pnpm --dir doc-maker/ui vitest run tests/runtime/writing-dataset-persistence.test.ts`
Expected: PASS.

### Task 2: API confirmation path

**Files:**
- Create: `doc-maker/ui/app/api/writing-runs/[runId]/dataset-drafts/confirm/route.ts`
- Modify: `doc-maker/ui/tests/runtime/writing-dataset-persistence.test.ts`

- [x] **Step 1: Write the failing route test**

Test `POST /dataset-drafts/confirm` with a configured repository and body `{ "confirmedBy": "human-reviewer" }`; expect 200 and `writing_eval_dataset`.

- [x] **Step 2: Run targeted test and verify RED**

Run: `pnpm --dir doc-maker/ui vitest run tests/runtime/writing-dataset-persistence.test.ts`
Expected: FAIL because the route does not exist.

- [x] **Step 3: Implement the route**

Read the run, require repository, parse JSON body, call `promoteWritingDatasetDraftsForRun`, and return dataset/item summary. Invalid confirmation returns 400.

- [x] **Step 4: Run targeted test and verify GREEN**

Run: `pnpm --dir doc-maker/ui vitest run tests/runtime/writing-dataset-persistence.test.ts`
Expected: PASS.

### Task 3: Real Postgres integration verification

**Files:**
- Create: `doc-maker/ui/tests/runtime/writing-dataset-postgres.integration.test.ts`

- [x] **Step 1: Write env-gated integration test**

The test skips unless `RUN_POSTGRES_INTEGRATION=1` and `FRAMEWORK_DATABASE_URL` are set. When enabled, it persists draft items and promotes confirmed eval items through `createPgSqlClient` + `createPostgresDatasetRepository`.

- [x] **Step 2: Verify skip in normal suite**

Run: `pnpm --dir doc-maker/ui vitest run tests/runtime/writing-dataset-postgres.integration.test.ts`
Expected: PASS with skipped tests when env is absent.

- [x] **Step 3: Run real local PG**

Start Docker Postgres on host port `5544`, apply `packages/framework-store/migrations/0001_framework_core.sql` with container `psql`, then run:

```bash
RUN_POSTGRES_INTEGRATION=1 FRAMEWORK_DATABASE_URL=postgres://postgres:s2v@localhost:5544/source2video_framework pnpm --dir doc-maker/ui vitest run tests/runtime/writing-dataset-postgres.integration.test.ts
```

Expected: PASS and rows exist in `framework_datasets` / `framework_dataset_items`.

### Task 4: OpenSpec and agent state

**Files:**
- Modify: `openspec/changes/add-writing-production-system/tasks.md`
- Modify: `.agent/STATUS.md`
- Modify: `.agent/TODO.md`
- Add: `.agent/sessions/2026-06-08-writing-dataset-closure/outputs.md`

- [x] **Step 1: Mark OpenSpec 13.4 and 13.5 complete**

Only after tests and 8C verification pass.

- [x] **Step 2: Update agent state**

Replace stale 8B/8C text with the verified closure status, next actionable, and exact verification commands.

- [x] **Step 3: Run final verification**

Run:
- `openspec validate add-writing-production-system`
- `pnpm --dir doc-maker/ui test`
- `pnpm --dir doc-maker/ui typecheck`
- `git diff --check`

- [x] **Step 4: Commit**

Commit code + docs with a scoped message after verification passes.
