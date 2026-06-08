# Shared PostgreSQL Migration — 2026-06-08

## Trigger

User clarified that the latest infrastructure direction is to reuse the shared PostgreSQL instance documented at `/Users/xuelin/projects/from-fullstack-to-ai/infra/docs/shared-database.md`; `agent-minimal` already follows that pattern.

## Decision

- Target database topology: shared `ftai-postgres`.
- Isolation model: independent database + role.
- Project/database/role name: `source2video_framework`.
- Production connection string shape: `postgresql://source2video_framework:<password>@ftai-postgres:5432/source2video_framework`.

## Correction

Earlier Infra readiness already recommended reusing the existing PG instance and explicitly said not to write Postgres into compose as a long-running service. Commit `709d501` introduced internal `source2video-postgres` as a short-term closure path to get online persistence working, not as the long-term target.

## Repo Changes

- `docker-compose.yml`: removed `source2video-postgres`; `FRAMEWORK_DATABASE_URL` is now required.
- `flow.yml`: no longer creates `data/postgres`.
- `docs/deploy.md`: documents shared `ftai-postgres` provisioning and connection.
- `framework-package-topology.test.ts`: topology assertions updated to reject project-local PG.

## Deployment Execution

Executed after user confirmed permission:

1. Provisioned shared database/role `source2video_framework` on `ftai-postgres`.
2. Migrated old internal PG data: `framework_datasets=2`, `framework_dataset_items=4`.
3. Wrote production `/opt/source2video/.env` with shared `FRAMEWORK_DATABASE_URL`; backup: `/opt/source2video/.env.bak.shared-db-20260608-121332`.
4. Updated cloud pipeline `5006844` YAML so VMDeploy no longer creates `data/postgres`.
5. Pushed `a09bea7`; CodeUp run `19` failed in Docker build due Docker Hub anonymous rate limit on `node:22-slim`.
6. Added `a067d24 fix(deploy): avoid docker hub rate limit in ci builds`: Dockerfile now uses `public.ecr.aws/docker/library/node:22-slim`; builder copies `docs/` so container tests can read `docs/deploy.md`.
7. CodeUp run `20` succeeded; production image is `source2video:a067d241`; `source2video-postgres` no longer appears in `docker compose ps`.

## Online Acceptance

- `GET /api/health` -> 200.
- `HEAD /writing` -> 200.
- `POST /api/writing-runs/missing-run/dataset-drafts` -> 404 `Writing run not found`, proving repository is configured.
- Retained acceptance tag: `online-shared-db-2026-06-08-a067d24`.
- Retained run: `run_c879dc71`, candidate `candidate_r1_1`, feedback `feedback_a719d1cc`.
- Published rule package: `rule_package_89160b83`.
- Draft item: `dataset_draft_run_c879dc71_feedback_a719d1cc` in `writing_dataset_draft`.
- Eval item: `eval_dataset_item_run_c879dc71_feedback_a719d1cc` in `writing_eval_dataset`, split `validation`.
- Shared DB counts after acceptance: `writing_dataset_draft=3`, `writing_eval_dataset=3`.

## Incident Note

Manual schema application initially used `ftai`, so framework tables were owned by the superuser. The app role then failed with `must be owner of table framework_workflow_runs` during runtime migration/index checks. Fixed by changing `public` schema and all framework table owners to `source2video_framework`; dataset write then passed.
