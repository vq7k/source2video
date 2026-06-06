# learned-rules

> 实战踩坑沉淀（不写理论规则）。

## L1: 线上可用必须验完整用户链路（2026-06-02）

**事件**：`source2video` 首次部署后，只验证了 `/api/writing-runs` 创建到 `precheck_ready` 和 Langfuse precheck trace，就回答“线上可用”；随后用户在候选生成区看到 `candidate-generation-v0.2` 被显示为失败。

**规则**：以后声明“线上可用/验收通过”前，必须按用户实际操作链路验证到最终业务状态；本项目至少覆盖 `/writing` 创建 run → `/confirm` 候选生成 → `candidate_ready` → 页面展示 → Langfuse 外链。

**为什么**：precheck 成功不能代表候选生成成功；局部 API 成功不能代表 UI 状态、trace 状态和外链都正确。

**修复模式**：为原失败点补最小复现和回归测试；验证用真实线上 run、页面 DOM/截图或浏览器点击，不用中间状态代替最终验收。

## L2: 本地 Playwright 必须走 `pnpm e2e` 脚本清代理（2026-06-04）

**事件**：直接运行 `pnpm exec playwright test ...` 时，代理环境让 `127.0.0.1:3911/writing` 返回 502，Playwright 误判 webServer URL 已被占用。

**规则**：本项目跑本地 e2e 必须优先用 `pnpm e2e` 或复用同等 env：unset `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY`，并设置 `NO_PROXY=127.0.0.1,localhost`。

**为什么**：用户环境外网请求走 ClashX 代理，本地 dev server 不能经代理访问；Playwright webServer 探测会把代理返回当成端口占用。

**修复模式**：若遇到 `http://127.0.0.1:3911/writing is already used`，先用 `curl --noproxy '*'` 或 `lsof -nP -iTCP:3911` 区分真实端口占用和代理误判，再改用 `pnpm e2e -- <spec>`。

## L3: 终端渲染损坏期工具输出/写操作不可信，副作用与落盘必须独立只读复核（2026-06-06）

**事件**：repository wiring session 后段终端渲染长时间损坏，造成一连串**假成功**，且多数当时未察觉：(1) `docker run -p 5432` 因端口冲突失败，却显示“容器就绪/migration 通过/10 表建出”，`docker ps -a` 才发现容器根本不存在；(2) `Write` 创建 `session-summary.md` / 8B `handoff.md` 返回“File created successfully”，`test -f` 却为 NO（实际未落盘）；(3) `git add && git commit` 报告 `commit_rc=0 / new HEAD=2c4e9f8`，但 `git cat-file`/`reflog` 显示该 commit **从未存在**；(4) `git remote -v` 显示为空、`main` 报 unknown revision，据此误判“无 remote 无 main”，实际有 `codeup`+`origin`+`main`；(5) `Edit` 给 learned-rules 加 L3 报成功，`grep` 实为 0 行。渲染同期还有命令文本回显、整行重复、Read 把 53 行文件显示成 ~3700 行。

**规则**：渲染异常（命令回显/整行重复/超长幻觉）时，**任何有副作用或落盘的操作**（docker/migration/Write/Edit/git add/commit/push/branch）都不得据其返回判定成功；必须另跑一条最简、只读、格式干净的命令复核真实状态，以干净命令为准：
- 文件落盘 → `test -f` + `wc -l` + `grep` 关键串
- git 提交 → `git log --format=... -1` + `git cat-file -t <hash>` + `git reflog`
- 容器/服务 → `docker ps -a --format ...`
- 远程/分支 → `git remote -v` + `git branch -a`（渲染好时复核，别信损坏期的“空”）
绝不把损坏期的“成功”写进 STATUS 或据此做不可逆决策（合并/删除/部署）。

**为什么**：渲染损坏会把失败显示成成功、把已存在显示成不存在，污染状态与决策；本次若不复核就会把“已提交/已部署”的假状态固化。

**修复模式**：渲染损坏期改用「结果写 `/tmp/xxx.txt` 受控小文件 → Read 读回」绕开 stdout 回显；渲染恢复后对该期所有副作用操作做一轮干净复核补做。环境事实：本机主机 5432 被 `langfuse-postgres-1` 占用，s2v 本地 PG 用 5544。

## 模板

每条 learned-rule 一段：

```markdown
## L<N>: <一句话标题>（<date>）

**事件**：踩到的具体场景（链 commit / session / file 路径）

**规则**：以后怎么避免

**为什么**：根因

**修复模式**（如适用）：具体如何修
```

## 何时写

- 踩了具体的坑（不是理论上的"应该这样"）
- 修复后想到"以后避免这个"
- 跨 session 容易复发的模式

## 何时不写

- 一次性问题（如 typo / 笔误）
- 理论建议（应该 SKILL 化或 ADR 化）
- 业务逻辑细节（应该在 doc-maker 业务文档）
