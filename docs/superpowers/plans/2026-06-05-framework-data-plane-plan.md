# Framework Data Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a business-agnostic LLMOps framework data plane that supports Postgres SOT, async execution, artifact storage, dataset/experiment/release-gate loops, and current Writing as the first adapter.

**Architecture:** Keep business logic out of the framework. `workflow-core` defines contracts, a new `framework-store` package owns Postgres persistence and migrations, a new `framework-runtime` package owns jobs/workers, and `writing-domain` only adapts its existing JSON records to the framework contracts. Langfuse remains the trace/score backend; Postgres is the system of record.

**Tech Stack:** Next.js 15, TypeScript, Vitest, Playwright, PostgreSQL, SQL migrations, Postgres-backed job queue, local MinIO/S3-compatible artifact store, Langfuse Cloud.

---

## Non-Negotiable Boundaries

- The framework must not create tables named after a business domain such as `writing_runs`.
- Business domains can store domain payload in `metadata_json` or adapter-owned tables later, but framework tables stay generic.
- Langfuse is not a business database. It stores observability traces/scores only.
- Large prompt/output/dataset blobs must move to artifact storage once they exceed an explicit byte threshold.
- LLM generation, eval, dataset build, experiment, and release gate must be executable outside the HTTP request lifecycle.
- Writing remains the first dogfood adapter, not the architecture center.

## Target Local Topology

```text
Next.js UI/API
  -> framework-store(Postgres)
  -> framework-runtime(Postgres job queue + worker)
  -> model gateway(OpenAI-compatible)
  -> observability(Langfuse TraceSink/ScoreSink)
  -> artifact-store(MinIO locally, OSS later)
```

## Persistent Worker Split

| Worker | Owns | Must Not Touch |
|---|---|---|
| `FrameworkWorker` | root `packages/`: contracts, `framework-store`, `framework-runtime`, `observability`, `artifact-store` | Writing UI/prompt, deployment resources, final QA verdict |
| `WritingWorker` | `doc-maker`: Writing domain/UI adapter, feedback/rule/dataset business semantics | framework schema naming, generic runtime internals |
| `InfraWorker` | local/online services: Postgres, MinIO/OSS, Caddy, Aliyun deploy, backup docs | product behavior, framework contracts |
| `QAWorker` | tests, fixtures, migration/backup/restore checks, release gate evidence | production behavior changes |

Fan-out only after Task 0/1 topology and contracts land. Before that, workers will collide on package paths and interfaces.

---

## File Structure

### Create

- `packages/framework-store/src/db.ts` — Postgres client and transaction helper.
- `packages/framework-store/src/migrations.ts` — migration runner used by scripts/tests.
- `packages/framework-store/src/repositories/workflow-runs.ts` — generic workflow run repository.
- `packages/framework-store/src/repositories/jobs.ts` — generic job repository.
- `packages/framework-store/src/repositories/artifacts.ts` — artifact metadata repository.
- `packages/framework-store/src/repositories/datasets.ts` — dataset and experiment repositories.
- `packages/framework-store/src/index.ts` — public exports.
- `packages/framework-runtime/src/jobs.ts` — job types and enqueue helpers.
- `packages/framework-runtime/src/worker.ts` — worker lease/retry loop.
- `packages/framework-runtime/src/handlers.ts` — handler registry.
- `packages/artifact-store/src/index.ts` — S3-compatible artifact store interface and filesystem local adapter.
- `packages/artifact-store/src/minio.ts` — S3-compatible client for MinIO/OSS.
- `doc-maker/ui/app/api/framework/jobs/route.ts` — local job inspection API.
- `doc-maker/ui/app/api/framework/datasets/route.ts` — dataset draft API.
- `doc-maker/ui/app/api/framework/experiments/route.ts` — experiment run API.
- `doc-maker/ui/scripts/migrate-framework-store.mjs` — run migrations.
- `doc-maker/ui/scripts/run-framework-worker.mjs` — local worker entrypoint.
- `doc-maker/ui/tests/runtime/framework-store.test.ts` — store contract tests.
- `doc-maker/ui/tests/runtime/framework-worker.test.ts` — queue/worker tests.
- `doc-maker/ui/tests/runtime/framework-dataset.test.ts` — dataset/experiment tests.
- `doc-maker/ui/tests/e2e/framework-data-plane.spec.ts` — UI/API integration path.
- `docs/framework-data-plane.md` — architecture SOT after implementation.

### Modify

- `packages/workflow-core/src/run.ts` — add persistence-safe status and snapshot references if needed.
- `packages/workflow-core/src/artifact.ts` — add `uri`, `contentHash`, and `byteLength` to artifact refs.
- `packages/workflow-core/src/feedback.ts` — add stable feedback event shape.
- `packages/workflow-core/src/eval.ts` — add judge attribution fields.
- `doc-maker/packages/writing-domain/src/run-store.ts` — introduce store factory: JSON default, Postgres optional.
- `doc-maker/packages/writing-domain/src/rule-package-store.ts` — introduce store factory.
- `doc-maker/packages/writing-domain/src/runtime.ts` — split synchronous functions from enqueueable workflow steps.
- `doc-maker/ui/package.json` — add db/artifact scripts and dependencies.
- `docker-compose.yml` or `doc-maker/ui/docker-compose.local.yml` — local Postgres + MinIO.
- `.env.example` — local service variables.

---

## Phase -1: Package Topology Split

### Task 0: Move Framework Ownership to Root Packages

**Files:**
- Create/modify: `packages/workflow-core`
- Create: `packages/framework-store`
- Create: `packages/framework-runtime`
- Create: `packages/observability`
- Create: `packages/artifact-store`
- Modify: `doc-maker/ui/package.json`
- Modify: workspace / tsconfig path wiring as needed
- Test: existing typecheck/unit tests that import workflow contracts

- [ ] Step 1: Prove current imports/package paths.

Run:

```bash
rg -n "doc-maker/packages/(workflow-core|framework-store|framework-runtime|observability|artifact-store)|packages/(workflow-core|framework-store|framework-runtime|observability|artifact-store)" .
```

Expected: every generic framework path resolves to root `packages/`; Writing-only code remains under `doc-maker/packages/writing-domain`.

- [ ] Step 2: Create root package skeletons and workspace wiring.

Root `packages/` owns generic framework code. `doc-maker/packages/` owns business adapter packages only.

- [ ] Step 3: Update imports to public package exports.

No deep relative imports across framework/business boundaries.

- [ ] Step 4: Run affected tests/typecheck.

Expected: existing Writing flow still passes while framework packages are path-stable.

- [ ] Step 5: Commit.

```bash
git add packages doc-maker/ui/package.json doc-maker/packages/writing-domain docs/superpowers/plans/2026-06-05-framework-data-plane-plan.md
git commit -m "chore(framework): split root package topology"
```

---

## Phase 0: Contract Freeze

### Task 1: Define Generic Persistence Contracts

**Files:**
- Modify: `packages/workflow-core/src/artifact.ts`
- Modify: `packages/workflow-core/src/feedback.ts`
- Modify: `packages/workflow-core/src/eval.ts`
- Create: `packages/framework-store/src/index.ts`
- Test: `doc-maker/ui/tests/runtime/framework-store.test.ts`

- [ ] Step 1: Add a failing test proving framework records are domain-agnostic.

Run:

```bash
cd doc-maker/ui
pnpm exec vitest run tests/runtime/framework-store.test.ts
```

Expected: fail because `framework-store` does not exist.

- [ ] Step 2: Create framework store interfaces.

Implement exported interfaces:

```ts
export type FrameworkStore = {
  workflowRuns: WorkflowRunRepository;
  artifacts: ArtifactRepository;
  jobs: JobRepository;
  datasets: DatasetRepository;
};
```

Repository methods must use generic names: `putRun`, `getRun`, `listRuns`, `appendNodeRun`, `putArtifact`, `enqueueJob`, `leaseJob`, `completeJob`, `failJob`.

- [ ] Step 3: Run the test again.

Expected: pass for type imports and domain-agnostic naming assertions.

- [ ] Step 4: Commit.

```bash
git add packages/workflow-core packages/framework-store doc-maker/ui/tests/runtime/framework-store.test.ts
git commit -m "feat(framework): define generic persistence contracts"
```

## Phase 1: Local Postgres SOT

### Task 2: Add Postgres Migrations

**Files:**
- Create: `packages/framework-store/src/migrations.ts`
- Create: `packages/framework-store/migrations/0001_framework_core.sql`
- Create: `doc-maker/ui/scripts/migrate-framework-store.mjs`
- Modify: `doc-maker/ui/package.json`
- Test: `doc-maker/ui/tests/runtime/framework-store.test.ts`

- [ ] Step 1: Write migration test.

Test must start with an empty test database and assert these tables exist:

```text
framework_workflow_runs
framework_node_runs
framework_artifacts
framework_feedback_events
framework_jobs
framework_datasets
framework_dataset_items
framework_experiments
framework_release_gates
framework_schema_migrations
```

- [ ] Step 2: Create SQL migration.

Core fields:

```sql
create table framework_workflow_runs (
  id text primary key,
  domain text not null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  metadata_json jsonb not null default '{}'::jsonb
);

create table framework_jobs (
  id text primary key,
  type text not null,
  status text not null,
  priority integer not null default 100,
  payload_json jsonb not null,
  result_json jsonb,
  error_json jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  locked_by text,
  locked_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
```

Add indexes on `(domain, updated_at desc)`, `(status, priority, run_after)`, and foreign keys from node/dataset/experiment records to their parent rows.

- [ ] Step 3: Add script.

`pnpm framework:migrate` runs migrations against `FRAMEWORK_DATABASE_URL`.

- [ ] Step 4: Run migration test.

Expected: all migration assertions pass.

- [ ] Step 5: Commit.

```bash
git add packages/framework-store doc-maker/ui/scripts doc-maker/ui/package.json doc-maker/ui/tests/runtime/framework-store.test.ts
git commit -m "feat(framework): add postgres schema migrations"
```

### Task 3: Implement Workflow Run Repository

**Files:**
- Create: `packages/framework-store/src/db.ts`
- Create: `packages/framework-store/src/repositories/workflow-runs.ts`
- Modify: `packages/framework-store/src/index.ts`
- Test: `doc-maker/ui/tests/runtime/framework-store.test.ts`

- [ ] Step 1: Write tests for CRUD behavior.

Required assertions:

- `putRun` inserts and updates idempotently.
- `getRun` returns metadata exactly.
- `listRuns({ domain })` filters by domain.
- `appendNodeRun` persists node runs independently from business payload.

- [ ] Step 2: Implement repository with explicit JSON serialization.

Do not use ORM magic in this task. Use parameterized SQL.

- [ ] Step 3: Run tests.

```bash
cd doc-maker/ui
pnpm exec vitest run tests/runtime/framework-store.test.ts
```

Expected: repository tests pass.

- [ ] Step 4: Commit.

```bash
git add packages/framework-store doc-maker/ui/tests/runtime/framework-store.test.ts
git commit -m "feat(framework): persist workflow runs in postgres"
```

## Phase 2: Artifact Store

### Task 4: Add Artifact Store Abstraction

**Files:**
- Create: `packages/artifact-store/src/index.ts`
- Create: `packages/artifact-store/src/minio.ts`
- Create: `packages/framework-store/src/repositories/artifacts.ts`
- Modify: `packages/workflow-core/src/artifact.ts`
- Test: `doc-maker/ui/tests/runtime/framework-store.test.ts`

- [ ] Step 1: Write tests for small and large payloads.

Required behavior:

- Payload under threshold may be stored inline in Postgres artifact metadata.
- Payload over threshold is written to artifact store and Postgres stores only `uri`, `contentHash`, `byteLength`.

- [ ] Step 2: Implement `ArtifactStore`.

Contract:

```ts
export type PutArtifactInput = {
  key: string;
  contentType: string;
  body: Uint8Array | string;
};

export type ArtifactStore = {
  put(input: PutArtifactInput): Promise<{ uri: string; contentHash: string; byteLength: number }>;
  get(uri: string): Promise<Uint8Array>;
};
```

- [ ] Step 3: Add local filesystem adapter first.

Use `.test-artifacts/framework-artifacts` in tests.

- [ ] Step 4: Add S3-compatible adapter for MinIO/OSS.

Keep credentials in env only:

```text
ARTIFACT_STORE_ENDPOINT
ARTIFACT_STORE_BUCKET
ARTIFACT_STORE_ACCESS_KEY_ID
ARTIFACT_STORE_SECRET_ACCESS_KEY
```

- [ ] Step 5: Commit.

```bash
git add packages/artifact-store packages/framework-store packages/workflow-core doc-maker/ui/tests/runtime/framework-store.test.ts
git commit -m "feat(framework): add artifact store abstraction"
```

## Phase 3: Async Runtime

### Task 5: Implement Postgres Job Queue

**Files:**
- Create: `packages/framework-runtime/src/jobs.ts`
- Create: `packages/framework-runtime/src/worker.ts`
- Create: `packages/framework-runtime/src/handlers.ts`
- Create: `packages/framework-store/src/repositories/jobs.ts`
- Create: `doc-maker/ui/scripts/run-framework-worker.mjs`
- Modify: `doc-maker/ui/package.json`
- Test: `doc-maker/ui/tests/runtime/framework-worker.test.ts`

- [ ] Step 1: Write lease/retry tests.

Required behavior:

- A queued job can be leased by one worker only.
- Failed job retries until `max_attempts`.
- Expired lock can be leased again.
- Completed job is never leased again.

- [ ] Step 2: Implement repository with `for update skip locked`.

Lease query must be atomic.

- [ ] Step 3: Implement worker loop.

The worker must accept a handler registry and a bounded `once()` method for tests.

- [ ] Step 4: Add scripts.

```json
{
  "framework:worker": "node scripts/run-framework-worker.mjs",
  "framework:migrate": "node scripts/migrate-framework-store.mjs"
}
```

- [ ] Step 5: Commit.

```bash
git add packages/framework-runtime packages/framework-store doc-maker/ui/scripts doc-maker/ui/package.json doc-maker/ui/tests/runtime/framework-worker.test.ts
git commit -m "feat(framework): add postgres-backed worker runtime"
```

### Task 6: Convert Writing Long-Running Steps to Jobs

**Files:**
- Modify: `doc-maker/packages/writing-domain/src/runtime.ts`
- Modify: `doc-maker/ui/app/api/writing-runs/route.ts`
- Modify: `doc-maker/ui/app/api/writing-runs/[runId]/confirm/route.ts`
- Create: `doc-maker/ui/app/api/framework/jobs/route.ts`
- Test: `doc-maker/ui/tests/runtime/writing-runtime.test.ts`
- Test: `doc-maker/ui/tests/e2e/framework-data-plane.spec.ts`

- [ ] Step 1: Write tests for HTTP enqueue behavior.

Required behavior:

- `POST /api/writing-runs` creates a draft/precheck job and returns `202` or a run with `status: running`.
- `POST /api/writing-runs/:id/confirm` enqueues candidate generation instead of blocking until all LLM calls complete.
- Existing synchronous behavior remains available behind a test helper or explicit runtime function.

- [ ] Step 2: Extract handler functions.

Split `createWritingRun` internals into enqueueable steps:

```text
writing.scope_extraction
writing.precheck_normalization
writing.candidate_generation_batch
writing.rule_patch_compilation
```

- [ ] Step 3: Register handlers in `framework-runtime`.

The handler registry maps job type to a business adapter function. The registry is the only place that knows about Writing job types.

- [ ] Step 4: Update API routes.

Routes should return job ids and current run state. UI polling can remain simple.

- [ ] Step 5: Run tests.

```bash
cd doc-maker/ui
pnpm test
pnpm e2e
```

- [ ] Step 6: Commit.

```bash
git add doc-maker/packages/writing-domain packages/framework-runtime doc-maker/ui/app/api doc-maker/ui/tests
git commit -m "feat(writing): run generation through framework jobs"
```

## Phase 4: Dataset, Experiment, Release Gate

### Task 7: Dataset Draft Builder

**Files:**
- Create: `packages/framework-store/src/repositories/datasets.ts`
- Create: `doc-maker/ui/app/api/framework/datasets/route.ts`
- Modify: `doc-maker/packages/writing-domain/src/workflow-adapter.ts`
- Test: `doc-maker/ui/tests/runtime/framework-dataset.test.ts`

- [ ] Step 1: Write tests for dataset promotion.

Input: a completed Writing run with accepted candidate and feedback events.

Expected output: dataset item with:

```text
sourceRunId
sourceArtifactId
inputRef
expectedOutputRef
labelJson
split = "draft"
metadataJson.domain = "writing"
```

- [ ] Step 2: Implement generic dataset repository.

No writing-specific columns.

- [ ] Step 3: Implement Writing adapter.

Adapter maps `WritingRunRecord` to generic `DatasetItemDraft`.

- [ ] Step 4: Commit.

```bash
git add packages/framework-store doc-maker/packages/writing-domain doc-maker/ui/app/api/framework doc-maker/ui/tests/runtime/framework-dataset.test.ts
git commit -m "feat(framework): build dataset drafts from runs"
```

### Task 8: Experiment Runner

**Files:**
- Modify: `packages/framework-runtime/src/handlers.ts`
- Modify: `packages/framework-store/src/repositories/datasets.ts`
- Create: `doc-maker/ui/app/api/framework/experiments/route.ts`
- Test: `doc-maker/ui/tests/runtime/framework-dataset.test.ts`

- [ ] Step 1: Write experiment test.

Given one dataset and two variants:

```json
[
  { "kind": "rule_snapshot", "id": "baseline" },
  { "kind": "rule_snapshot", "id": "candidate" }
]
```

Expected: experiment stores per-item scores and aggregate metrics.

- [ ] Step 2: Implement experiment job handler.

Handler must run through `ScoreSink` and store aggregate metrics in Postgres.

- [ ] Step 3: Add API route.

`POST /api/framework/experiments` enqueues an experiment and returns job id.

- [ ] Step 4: Commit.

```bash
git add packages/framework-runtime packages/framework-store doc-maker/ui/app/api/framework doc-maker/ui/tests/runtime/framework-dataset.test.ts
git commit -m "feat(framework): run dataset experiments"
```

### Task 9: Release Gate

**Files:**
- Modify: `packages/framework-store/src/repositories/datasets.ts`
- Modify: `doc-maker/packages/writing-domain/src/runtime.ts`
- Test: `doc-maker/ui/tests/runtime/framework-dataset.test.ts`
- Test: `doc-maker/ui/tests/e2e/framework-data-plane.spec.ts`

- [ ] Step 1: Write gate tests.

Publishing a rule package must fail unless:

- experiment status is complete,
- holdout pass rate is above configured threshold,
- no critical regression score exists,
- human approval flag is true.

- [ ] Step 2: Implement `ReleaseGateResult`.

Fields:

```ts
type ReleaseGateResult = {
  status: "passed" | "failed" | "needs_human_review";
  checks: Array<{ id: string; status: "pass" | "fail"; evidence: string }>;
  experimentId: string;
};
```

- [ ] Step 3: Wire Writing rule package publish.

`publishRulePackage` must consult release gate when `FRAMEWORK_RELEASE_GATE_REQUIRED=true`.

- [ ] Step 4: Commit.

```bash
git add packages/framework-store doc-maker/packages/writing-domain doc-maker/ui/tests
git commit -m "feat(framework): gate rule package releases"
```

## Phase 5: Local Dev Services and QA

### Task 10: Local Compose and Environment

**Files:**
- Create: `doc-maker/ui/docker-compose.local.yml`
- Modify: `.env.example`
- Modify: `doc-maker/ui/README.md`
- Test: `doc-maker/ui/tests/runtime/framework-store.test.ts`

- [ ] Step 1: Add local services.

Compose services:

```text
postgres:16
minio
```

Do not add Langfuse local yet; Cloud Free remains current observability backend.

- [ ] Step 2: Document env.

Required local env:

```text
FRAMEWORK_DATABASE_URL
ARTIFACT_STORE_ENDPOINT
ARTIFACT_STORE_BUCKET
ARTIFACT_STORE_ACCESS_KEY_ID
ARTIFACT_STORE_SECRET_ACCESS_KEY
LANGFUSE_BASE_URL
LANGFUSE_PUBLIC_KEY
LANGFUSE_SECRET_KEY
```

- [ ] Step 3: Run local smoke.

```bash
cd doc-maker/ui
docker compose -f docker-compose.local.yml up -d
pnpm framework:migrate
pnpm test
```

- [ ] Step 4: Commit.

```bash
git add .env.example doc-maker/ui/docker-compose.local.yml doc-maker/ui/README.md doc-maker/ui/tests/runtime/framework-store.test.ts
git commit -m "docs(framework): add local data plane setup"
```

### Task 11: Backup and Restore Drill

**Files:**
- Create: `doc-maker/ui/scripts/backup-framework-data.mjs`
- Create: `doc-maker/ui/scripts/restore-framework-data.mjs`
- Modify: `doc-maker/ui/package.json`
- Test: `doc-maker/ui/tests/runtime/framework-store.test.ts`

- [ ] Step 1: Write backup/restore test.

Seed one run, one artifact, one dataset item. Backup to `.test-artifacts/framework-backup`. Restore into empty database. Assert all ids and hashes match.

- [ ] Step 2: Implement backup script.

Backup Postgres tables as JSONL plus artifact blobs by URI.

- [ ] Step 3: Implement restore script.

Restore must fail if target database is non-empty unless `--force` is passed.

- [ ] Step 4: Commit.

```bash
git add doc-maker/ui/scripts doc-maker/ui/package.json doc-maker/ui/tests/runtime/framework-store.test.ts
git commit -m "feat(framework): add backup restore drill"
```

## Phase 6: Execution Strategy With Sub-Agents

### Wave A: Sequential Foundation

Run inline or with one agent only:

1. Task 1 contract freeze.
2. Task 2 migrations.

Reason: every other agent depends on these interfaces.

### Wave B: Parallel Worktrees

Dispatch four agents after Wave A:

```text
schema-store-agent -> Task 3
artifact-agent -> Task 4
queue-worker-agent -> Task 5
dataset-eval-agent -> Task 7
```

Coordinator constraints:

- Each agent gets one task file section only.
- Each agent commits on its own branch.
- Coordinator merges in this order: store, artifact, queue, dataset.
- After each merge, run `pnpm test`.

### Wave C: Integration

Use one integration agent:

```text
writing-adapter-agent -> Task 6 + Task 9
```

Reason: Writing adapter touches current runtime and API routes; parallel edits here will conflict.

### Wave D: QA/Docs

Run QA agent:

```text
qa-agent -> Task 10 + Task 11 + final e2e
```

Final verification:

```bash
cd doc-maker/ui
pnpm test
pnpm e2e
pnpm build
pnpm framework:migrate
pnpm framework:worker -- --once
```

## Scope Cut If Time Gets Tight

Keep:

1. Postgres SOT.
2. Worker queue.
3. Artifact store contract.
4. Dataset draft.

Defer:

1. Full admin UI.
2. Langfuse self-host.
3. OSS production deployment.
4. Complex RBAC.
5. Automatic model fine-tuning.

## Definition of Done

- Local Postgres can replace JSON store for framework records.
- Long-running LLM work runs through worker jobs.
- Large artifacts can be offloaded to artifact storage.
- A completed Writing run can produce dataset draft items.
- An experiment can compare at least two rule/prompt variants over a dataset.
- Publishing a RulePackage can require a release gate.
- Existing Writing v1 e2e still passes.
- No table or framework package is named after a business domain.
