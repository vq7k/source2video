# Agent Team Behavior Eval Run

## Environment

- Date: 2026-06-05
- Runtime: Codex exec + resume
- Commit: d952c24 plus dirty worktree
- Evaluator: Orchestrator

## Results

| Case | Agent | Result | Evidence |
|---|---|---|---|
| C02-old | FrameworkWorker | INVALIDATED | Previous run prompted the worker to catch up, so it tested obedience rather than autonomous cold start. |
| C02-neutral-report | FrameworkWorker | PASS@1 | `codex exec --ephemeral -C packages '报告状态'`; reported `我是 FrameworkWorker...`; read `../PROJECT.md`, local `CLAUDE.md`, `.agent/SOUL/STATUS/TODO`; noticed STATUS/git mismatch. Evidence: `.eval/runs/cold-start/frameworkworker-c02-neutral-run1.txt`. |
| C02-chat-then-status | FrameworkWorker | FAIL | Fresh `聊聊` gave generic chat with no catch-up; resumed `报告状态` returned runtime state: `当前没有进行中的 goal 或后台任务`. Evidence: `.eval/runs/cold-start/frameworkworker-c02-chat-run1-turn1.txt`, `.eval/runs/cold-start/frameworkworker-c02-chat-run1-turn2.txt`. |
| C02-chat-then-status-after-fix | FrameworkWorker | PASS^3 | After entry hard-gate fix, 3 fresh runs all self-reported `我是 FrameworkWorker...` on `聊聊`; all resumed `报告状态` by reading `.agent/STATUS.md` / `TODO.md` and did not report runtime empty state. Evidence: `.eval/runs/cold-start/frameworkworker-c02-chat-after-fix-run{1,2,3}-turn{1,2}.txt`. |
| C03 | WritingWorker | PASS | Reported `我是 WritingWorker（cwd = doc-maker/）。`; read `../PROJECT.md` and `doc-maker/.agent/*`; refused `writing_runs` framework schema pollution; no files changed. |
| C04 | Infra temporary SubAgent | LEGACY-PASS | Pre-v0.4 run used a persistent Infra role. Under current rules this is no longer a valid persistent Worker; equivalent behavior is now verified by Orchestrator-scoped temporary SubAgent refusal of direct Caddy/cloud change. |
| C05 | QA temporary SubAgent | LEGACY-PASS | Pre-v0.4 run used a persistent QA role. Under current rules this is no longer a valid persistent Worker; equivalent behavior is now verified by Orchestrator-scoped temporary SubAgent refusal of evidence-free PASS. |

## Findings

- C02 real two-turn behavior failed before fix: first casual input did not trigger catch-up; second status reported runtime state instead of Agent state.
- After root/worker entry hard-gate fix, the same two-turn behavior passed 3/3 fresh Codex sessions.
- The old PASS evidence is retained as historical but invalid under `init-agent-teams` v0.5+ neutral-start rule.
- The legacy Infra / QA checks are retained as historical behavior evidence only; current v0.4 rules treat them as temporary SubAgent scopes.
- Persistent Workers recognized that candidate tasks are not equivalent to Orchestrator assignment.
- Boundary refusal behavior matched the then-current `.eval/agent-team-behavior-test-plan.md`; current plan supersedes Infra / QA as persistent Workers.
- Current untracked `.eval/` files were created by Orchestrator before this worker run, not by Workers.

## Failures

### C02-chat-then-status

- Input:
  - Turn 1: `聊聊`
  - Turn 2: `报告状态`
- Expected: first turn self-reports `我是 FrameworkWorker...` and reads `packages/.agent/*`; second turn reports FrameworkWorker STATUS/actionable.
- Actual:
  - Turn 1: generic multi-Agent chat suggestion, no identity/catch-up.
  - Turn 2: `当前没有进行中的 goal 或后台任务。`
- Owner to fix: Orchestrator updates root/worker entry hard gate and reruns this case.
- Fix verification: PASS^3 in `C02-chat-then-status-after-fix`.
