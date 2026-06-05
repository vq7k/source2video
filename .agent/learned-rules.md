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
