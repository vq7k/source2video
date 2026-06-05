# outputs: Writing Production v1 online acceptance

## 部署

- CodeUp push：`fda66ce..1bfce63 main -> main`
- 云效流水线：`pipelineRunId=8`，`SUCCESS`
- 镜像 tag：`1bfce634`
- VMDeploy order：`63382768`，`Success`
- 容器：`source2video`，image `qv7k/source2video:1bfce634`，healthy

## 生产网关

- 修复前：HTTP 308 可达，HTTPS TLS handshake 返回 `tlsv1 alert internal error`，无证书返回
- 根因：`/opt/from-fullstack-to-ai/infra/Caddyfile` 缺少 `s2v.x-lin7.com` site block
- 修复：追加 `s2v.x-lin7.com -> source2video:3000`，`caddy validate` + `caddy reload`
- 备份：`/opt/from-fullstack-to-ai/infra/Caddyfile.bak.s2v-20260605-085109`

## 验收

- 本地：`pnpm test` 4 files / 7 tests passed；`pnpm e2e` 6 passed；`pnpm build` passed
- 线上 `/api/health`：`{"status":"ok"}`
- 线上 `/writing`：200，标题 `doc-marker · 文本生产工作台`
- LLM runtime：DeepSeek `deepseek-v4-pro` 连接测试 ok，Langfuse sink `complete`
- 线上业务 run：`run_787ab96e`
- 业务结果：`candidate_ready`，3 candidates，8 LLM traces 全 `complete`
- Langfuse trace：`4b973abf-d46c-4539-ac6e-f79b50434fb5`
- ScoreSink：3 条 candidate eval 均 `complete`，每条 5 scores
- Framework 深链：`/framework?runId=run_787ab96e&traceId=llm_trace_f2a47e6f&returnTo=/writing` 显示 `Trace 已定位`

