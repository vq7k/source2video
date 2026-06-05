# worker-entry — Worker 工作区本地入口模板

> 每个常驻 Worker 的工作区（`<cwd>/`）除 `.agent/` 外，**必须**有本地 `CLAUDE.md` + `AGENTS.md`，
> 让任何 runtime 进该 cwd 就能独立 catch-up（catch-up 第二步「cat CLAUDE.md」读的是本地这份；
> 缺它 = 拆了角色却进不去，非 Claude runtime 更无 AGENTS.md 引导）。
> A4 落地时为每个 Worker 工作区各建这两份；占位符 `<…>` 按真实值填。check B2-4 程序化查齐备。

## 模板 1：`<cwd>/CLAUDE.md`

````markdown
# <模块名> — <角色> Entry Point

> 你在 `<cwd>/` 启动 session → 你是 **<角色>**。

## 必读（catch-up）
1. `.agent/SOUL.md` — 你是谁、边界
2. `.agent/STATUS.md` — 上次状态 + 当前 actionable
3. `.agent/TODO.md` — 你要做什么
4. 根 `PROJECT.md`（`<到根的相对路径>/PROJECT.md`）— 项目身份 + cwd→角色表 + 硬约束

## 工作流
catch-up（看 cwd 定角色 → 读上面四件 → 自报边界 → 判 actionable）→ 干 → 收工写 STATUS / 按 `worker-summary` 回报主理。

## 可用 skills（在根 `.skill/`，按需读）
`catch-up` · `status-update` · `worker-summary` ·（其它按需）
````

## 模板 2：`<cwd>/AGENTS.md`

````markdown
# <模块名> — <角色> Entry Point (Codex / Aider / 其它 runtime)

同 [`CLAUDE.md`](./CLAUDE.md)。source of truth 是根 [`PROJECT.md`](<到根的相对路径>/PROJECT.md)。
````
