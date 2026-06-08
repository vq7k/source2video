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

## Deployment Gate

Do not push to CodeUp/deploy until:

1. Infra provisions shared database/role: `PROJ_PASSWORD='<strong password>' bash infra/scripts/provision-shared-db.sh source2video_framework`
2. `/opt/source2video/.env` contains: `FRAMEWORK_DATABASE_URL=postgresql://source2video_framework:<password>@ftai-postgres:5432/source2video_framework`
3. If old acceptance dataset must be preserved, export/import rows from the old `source2video-postgres` first.
