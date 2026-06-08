# Writing Dataset Closure Outputs — 2026-06-08

## Scope

- Closed OpenSpec `add-writing-production-system` tasks 13.4 and 13.5.
- Closed local repository wiring 8C with real Postgres verification.
- Closed online repository wiring with Docker Compose internal Postgres, production lazy migration, and public API verification.

## Code

- `doc-maker/packages/writing-domain/src/dataset-draft-persistence.ts`
  - Added `WRITING_EVAL_DATASET_ID`.
  - Added `promoteWritingDatasetDraftsForRun()`.
  - Promotion requires `confirmedBy`.
  - Promotion copies items into `writing_eval_dataset` with `split="validation"` and `reviewStatus="human_confirmed"`.
  - Draft dataset stays `writing_dataset_draft` / `split="draft"` / `needs_human_confirmation`.
- `doc-maker/ui/app/api/writing-runs/[runId]/dataset-drafts/confirm/route.ts`
  - Added explicit human confirmation route.
  - Uses the same repository provider as dataset drafts.
  - Returns 503 when `FRAMEWORK_DATABASE_URL` is not configured.
- `doc-maker/ui/tests/runtime/writing-dataset-persistence.test.ts`
  - Added confirmation/promotion tests.
- `doc-maker/ui/tests/runtime/writing-dataset-postgres.integration.test.ts`
  - Added env-gated real Postgres integration test.

## 8C Real Postgres Verification

Commands:

```bash
docker run -d --name s2v-pg-8c -e POSTGRES_PASSWORD=s2v -e POSTGRES_DB=source2video_framework -p 5544:5432 postgres:16-alpine
docker exec s2v-pg-8c pg_isready -U postgres -d source2video_framework
docker exec -i s2v-pg-8c psql -v ON_ERROR_STOP=1 -U postgres -d source2video_framework < packages/framework-store/migrations/0001_framework_core.sql
docker exec s2v-pg-8c psql -U postgres -d source2video_framework -t -c "select count(*) from information_schema.tables where table_schema='public' and table_name like 'framework_%';"
RUN_POSTGRES_INTEGRATION=1 FRAMEWORK_DATABASE_URL='postgres://postgres:s2v@localhost:5544/source2video_framework' pnpm --dir doc-maker/ui exec vitest run tests/runtime/writing-dataset-postgres.integration.test.ts
docker exec s2v-pg-8c psql -U postgres -d source2video_framework -t -c "select dataset_id, count(*) from framework_dataset_items group by dataset_id order by dataset_id;"
docker rm -f s2v-pg-8c
```

Observed:

- `pg_isready`: accepting connections.
- Migration: 10 `framework_*` tables created.
- Integration test: 1 test passed.
- Direct DB check:
  - `writing_dataset_draft | 1`
  - `writing_eval_dataset | 1`
- Cleanup: `s2v-pg-8c` removed.

## Follow-up

- Initial CodeUp pipeline run `13` failed in Docker build because the image installed only `doc-maker/ui` dependencies; tests importing `@source2video/framework-store` could not resolve `pg` from `/app/packages/framework-store/src/pg-client.ts`.
- Fix: Dockerfile now installs `packages/framework-store` dependencies in the deps stage and copies `packages/framework-store/node_modules` into the builder stage. Topology test covers this.
- Local `docker build -t source2video:deploy-verify .` passed after the fix, including container `pnpm test` and `pnpm build`.
- Follow-up commit `98f08a8 fix(deploy): package framework store runtime assets` fixed Docker runner runtime assets and changed missing run reads to 404 instead of 500.
- Follow-up commit `709d501 feat(deploy): add postgres data plane` added internal `source2video-postgres`, production repository lazy migration, compose/deploy docs, and topology/provider tests.
- CodeUp run `15`: deploy success; online dataset route changed from 500 to 503.
- CodeUp run `16`: deploy success but still 503 because cloud pipeline config was stale and did not unpack inner `deploy.tgz`; server kept old compose.
- Cloud pipeline config `5006844` was updated through `aliyun devops UpdatePipeline` with current repo `flow.yml`.
- CodeUp run `17`: deploy success; VMDeploy log confirms `source2video-postgres` created, started, and healthy.

## Online Verification

Observed on `https://s2v.x-lin7.com` after pipeline run `17`:

- `GET /api/health` -> 200.
- `HEAD /writing` -> 200.
- `POST /api/writing-runs/missing-run/dataset-drafts` -> 404 `Writing run not found`, proving the repository is configured and no longer returns `repository_unconfigured`.
- Real run `run_2f8ec678`, candidate `candidate_r1_1`:
  - `POST /confirm` -> 200.
  - `POST /feedback` -> 200, feedbackCount=1.
  - `POST /rule-patches` -> 200, patchCount=1.
  - `POST /finalize` -> 200, status=`finalized`.
  - `POST /rule-package` -> 200, package `rule_package_dd760243`.
  - `PATCH /rule-package` -> 200, status=`published`.
  - `POST /dataset-drafts` -> 200, `writing_dataset_draft`, itemCount=1.
  - `POST /dataset-drafts/confirm` -> 200, `writing_eval_dataset`, itemCount=1, split=`validation`.

## Remaining Operational Hardening

- Set a strong `SOURCE2VIDEO_POSTGRES_PASSWORD` in `/opt/source2video/.env` and redeploy once. The business loop is closed; this is security hardening, not a functional blocker.

## OpenSpec Archive

- Ran `openspec archive -y add-writing-production-system`.
- Main specs created:
  - `openspec/specs/generation-eval-loop/spec.md`
  - `openspec/specs/precheck-normalization/spec.md`
  - `openspec/specs/writing-job/spec.md`
  - `openspec/specs/writing-skill-lifecycle/spec.md`
- Change archived to `openspec/changes/archive/2026-06-08-add-writing-production-system/`.
