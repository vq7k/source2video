# QA Task 0 Review — `bda65dd chore(framework): split root package topology`

## QA Summary

- Result: PASS

- Evidence:
  - **Check 1 — commit only contains Task 0 files: PASS.** `git show --name-status bda65dd` = pure topology split: deletes legacy `doc-maker/packages/{workflow-core,observability}/src/*`; adds root `packages/{workflow-core,observability,artifact-store,framework-store,framework-runtime}/*`; adds root `package.json` + `pnpm-workspace.yaml`; switches imports in `doc-maker/packages/writing-domain/src/*` (6 files) and `doc-maker/ui/{app,tests,tsconfig.json,vitest.config.ts}`; adds `tests/runtime/framework-package-topology.test.ts`; bumps `packages/.agent/{STATUS,TODO}.md`. The 6 writing-domain edits are **import-only** (0 non-header / non-import content lines in the diff). No unrelated business logic.
  - **Check 2 — root `packages/` owns generic framework packages: PASS.** All 5 present, each scoped `@source2video/*` (workflow-core, observability, artifact-store, framework-store, framework-runtime), `private: true`, `type: module`. `pnpm-workspace.yaml` includes `packages/*`.
  - **Check 3 — legacy `doc-maker/packages/{workflow-core,observability}` removed: PASS.** Dirs deleted; only `doc-maker/packages/writing-domain` remains.
  - **Check 4 — imports switched `@doc-maker/*` -> `@source2video/*`: PASS.** `rg '@doc-maker/(workflow-core|observability)|doc-maker/packages/(workflow-core|observability)'` over packages / doc-maker/packages / ui tests+app + tsconfig + vitest.config -> 0 matches. All consumers now resolve `@source2video/*`.
  - **Check 5 — uncommitted files free of framework WIP: PASS.** Working set = only `.agent/{STATUS,TODO}.md`, `AGENTS.md`, `CLAUDE.md`, `.eval/*`, untracked session dirs. `git status --porcelain` filtered for framework source -> 0 matches.

- Commands:
  - `git show --name-status --oneline --no-renames bda65dd`
  - `rg -n '@doc-maker/(workflow-core|observability)|doc-maker/packages/(workflow-core|observability)' packages doc-maker/packages doc-maker/ui/tests doc-maker/ui/app doc-maker/ui/tsconfig.json doc-maker/ui/vitest.config.ts` -> no matches (exit 1)
  - `cd doc-maker/ui && pnpm exec vitest run tests/runtime/framework-package-topology.test.ts` -> 1 file, 5 tests passed
  - `pnpm test` -> 10 files, 30 tests passed
  - `pnpm typecheck` (`tsc --noEmit`) -> exit 0, no errors
  - `git status` -> no framework WIP staged/unstaged
  - `git log -S 'COPY packages ./packages' -- Dockerfile` -> traced Docker fix provenance

- Findings:
  - All 5 handoff checks PASS against current branch `codex/framework-topology`; full suite green (30/30 tests, topology 5/5, typecheck 0).
  - Topology test self-verifies: root packages exist, legacy dirs absent, tsconfig/vitest aliases point at `../../packages/...`, no legacy `@doc-maker/{workflow-core,observability}` imports, root packages free of `doc-maker` business metadata, Dockerfile contains `COPY packages ./packages`.
  - **Provenance note (non-blocking):** the production `Dockerfile` was NOT part of `bda65dd`. The `COPY packages ./packages` line was added two commits later in `521f3c2 fix(deploy): include framework packages in docker build`. The topology test's Docker assertion would have FAILED on `bda65dd` in isolation and only passes at branch HEAD. Already remediated.

- Risks:
  - bda65dd in isolation left the prod Docker build context stale (missing root `packages/`), which would have broken deploy until `521f3c2`. No current risk — fixed on branch HEAD.
  - Root workspace now requires `pnpm install` at repo root for `@source2video/*` resolution; confirmed working locally.
  - No production behavior change beyond package relocation + import rewrites; framework implementation untouched.

- Required fixes:
  - None. Task 0 acceptance met on `codex/framework-topology` HEAD.
  - (Process suggestion only) Fold the matching `Dockerfile` update into the same split commit next time so the build context never lags the topology change.
