# Writing Dataset Closure Outputs — 2026-06-08

## Scope

- Closed OpenSpec `add-writing-production-system` tasks 13.4 and 13.5.
- Closed local repository wiring 8C with real Postgres verification.
- Did not enable production `FRAMEWORK_DATABASE_URL`; online dataset persistence still needs production PG env + migration.

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

- Run final verification and commit.
- For production closure: configure production `FRAMEWORK_DATABASE_URL`, run migration against production PG, deploy, then verify dataset draft and confirmation routes online.
