# decisions: source2video production deploy

## D1: 生产部署复用 CodeUp + 云效 + ACR + Docker Compose

选择仓库根 `flow.yml` 驱动云效流水线，镜像推送到香港 ACR，服务器用 Docker Compose 拉取指定 commit tag。理由：贴合已有阿里云权限和参考项目部署方式，回滚可通过历史流水线完成。

## D2: 生产 LLM 使用 DeepSeek OpenAI-compatible

线上 `.env` 使用：

- `DOC_MAKER_LLM_PROVIDER=openai-compatible`
- `DOC_MAKER_LLM_BASE_URL=https://api.deepseek.com`
- `DOC_MAKER_LLM_MODEL=deepseek-v4-pro`

同时修复 env model 被节点默认模型覆盖的问题。

## D3: `/writing` 作为默认业务入口，`/overview` 保留全貌诊断入口

根路径进入轻量 writing workspace；“全貌”按钮跳到 `/overview`。理由：默认进入用户核心工作台，同时保留原完整诊断视图。

## D4: Langfuse 可点击入口放在 `/framework`

`/overview` 的 `Langfuse` 是同步状态 badge，不是链接；可点击跳转在 `/framework` 诊断页的“打开 Langfuse”。当前实现保持不变，本 session 只修误判失败。

## D5: trace 状态缺失按完成处理，只把显式 failed 显示失败

根因是 trace sink 中默认 `status: "complete"` 被 `...input` 里的 `status: undefined` 覆盖；UI 又把非 complete 全显示失败。修复为 sink 保留默认状态，旧 run 展示层只把显式 `"failed"` 显示为失败。
