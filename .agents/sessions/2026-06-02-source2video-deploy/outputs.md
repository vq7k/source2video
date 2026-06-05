# outputs: source2video production deploy

## 部署产出

- 公网入口：`https://s2v.x-lin7.com`
- 默认页面：`/writing`
- 全貌页面：`/overview`
- 诊断/Langfuse 跳转页：`/framework`
- 镜像：`crpi-hych6zm27jhqndgw.cn-hongkong.personal.cr.aliyuncs.com/qv7k/source2video:fda66cef`
- 容器：`source2video`，状态 `healthy`

## 关键提交

- `ba6cc59 feat(doc-maker): add writing production deployment`
- `b7d1838 fix(deploy): unpack vm deploy bundle`
- `c392259 fix(ui): redirect home to writing workspace`
- `227734c fix(ui): restore overview workspace route`
- `d138846 fix(llm): respect env model for production runtime`
- `f705df3 fix(deploy): chown runtime data directories`
- `fda66ce fix(trace): preserve successful llm call status`

## 验收记录

- `pnpm --dir doc-maker/ui test`：4 files / 7 tests passed
- `pnpm --dir doc-maker/ui typecheck`：passed
- `pnpm --dir doc-maker/ui build`：passed
- `pnpm --dir doc-maker/ui e2e`：3 tests passed
- 云效流水线 `pipelineRunId=7`：`SUCCESS`
- 线上 `/api/health`：`{"status":"ok"}`
- 线上新 run `run_f0dc4c4e`：`candidate_ready`，3 条候选 trace 均 `status: complete`
- 旧问题 run `run_d70d81e5`：40181ms 候选生成在页面显示“完成”；Langfuse API 返回 200，trace `b8c6d975-7cc2-42af-80bb-a82f548228ca` 存在，observations=8

## 遗留

- 本地仍有用户/既有无关未提交文档和 skills 文件；本 session 未处理。
- Chrome 插件未安装/不可用，无法复用用户 Chrome 登录态验证 Langfuse Web 权限；已通过服务端 API 确认 trace 存在。
