# decisions: Writing Production v1 online acceptance

## D1. 继续用 CodeUp main 触发云效

沿用 `docs/deploy.md`：push CodeUp `main` 触发 pipeline `5006844`，镜像 tag 使用 `${CI_COMMIT_ID}`。

## D2. 生产 TLS 修复落在 ftai-caddy

根因不是应用容器：`source2video` healthy，容器内 `/api/health` ok，`ftai-caddy -> source2video:3000` ok。公网 HTTPS 握手失败是 `ftai-caddy` Caddyfile 缺少 `s2v.x-lin7.com` site block。

处理：备份 `/opt/from-fullstack-to-ai/infra/Caddyfile` 到 `Caddyfile.bak.s2v-20260605-085109`，追加 `s2v.x-lin7.com` reverse_proxy block，`caddy validate` 后 reload。

## D3. LLM 验收用生产 env，而不是默认 settings route

`/api/settings/llm/test` 不带 body 会读 `.doc-maker-runtime/llm-settings.json` 或默认值；业务 runtime 使用容器 env。线上容器 env 为：

- `DOC_MAKER_LLM_PROVIDER=openai-compatible`
- `DOC_MAKER_LLM_BASE_URL=https://api.deepseek.com`
- `DOC_MAKER_LLM_MODEL=deepseek-v4-pro`

因此验收时显式传入生产 settings 测连接，再跑业务 run。

