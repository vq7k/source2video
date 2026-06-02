# source2video Docker 部署

## 现状

- 公网入口: `https://s2v.x-lin7.com`
- 运行方式: 轻量服务器 Docker Compose，容器名 `source2video`
- 应用入口: `doc-maker/ui`，Next.js standalone，容器端口 `3000`
- 镜像仓库: `crpi-hych6zm27jhqndgw.cn-hongkong.personal.cr.aliyuncs.com/qv7k/source2video`
- 网络: 复用 `from-fullstack-to-ai` 的 `infra_ftai-net`
- 网关: 复用 `ftai-caddy`，反代 `s2v.x-lin7.com -> source2video:3000`

## 云效流水线

流水线使用仓库根目录 `flow.yml`:

1. `代码源`: 从 Codeup 仓库 `agent/source2video.git` 的 `main` 分支拉代码，push 到 `main` 自动触发。
2. `镜像构建`: 使用 `DockerBuildPushACR` 构建并推送 Docker 镜像；Dockerfile 内会执行 `pnpm test` 和 `pnpm build`。
3. `部署包`: 上传 `docker-compose.yml` 作为部署制品。
4. `主机部署`: VMDeploy 到主机组 `Ygtt0gTV53OffUF7`，在 `/opt/source2video` 执行 `docker compose pull && up -d`。
5. `验证`: 容器内 `/api/health` 和 Caddy 到容器的 `/api/health`。

镜像 tag 使用 `${CI_COMMIT_ID}`，不是裸 `latest`。回滚时重跑历史流水线。

## 云效变量

沿用参考项目:

```bash
REGISTRY_USERNAME=<ACR 用户名>   # 服务器未登录 ACR 时需要
REGISTRY_PASSWORD=<ACR 密码>     # 服务器未登录 ACR 时需要
```

`flow.yml` 已沿用参考项目的 Codeup 服务连接 `xrhfc959mqp5nqye`。

## 服务器环境变量

服务器 `/opt/source2video/.env` 放应用运行时变量:

```bash
DOC_MAKER_LLM_PROVIDER=openai-compatible
DOC_MAKER_LLM_BASE_URL=https://api.deepseek.com
DOC_MAKER_LLM_MODEL=deepseek-v4-pro
DOC_MAKER_LLM_API_KEY=...

# 可选 Langfuse
LANGFUSE_BASE_URL=https://cloud.langfuse.com
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
LANGFUSE_ENVIRONMENT=production
LANGFUSE_PROJECT_ID=...
```

如果生产要继续走 CLIProxyAPI，把 `DOC_MAKER_LLM_BASE_URL` 改成服务器上容器可访问的 OpenAI-compatible 地址；不要写容器内不可达的 `localhost:8317`。

## 持久化目录

部署脚本会创建:

```bash
/opt/source2video/data/writing-runs
/opt/source2video/data/rule-packages
/opt/source2video/data/runtime
```

前两个目录保存业务 run 和 Rule Package JSON；`data/runtime` 挂载到容器 `/app/ui/.doc-maker-runtime`，保存页面里写入的 LLM runtime settings。

## Caddy site block

在 `ftai-caddy` 对应 Caddyfile 增加:

```caddy
s2v.x-lin7.com {
	encode gzip zstd

	reverse_proxy source2video:3000 {
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}

	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
	}

	log {
		output stdout
		format console
	}
}
```

确认 DNS A 记录 `s2v.x-lin7.com` 指向服务器后 reload Caddy。

## 手工检查

```bash
docker ps --filter name=source2video
docker inspect source2video --format '{{.State.Health.Status}}'
docker exec source2video node -e "fetch('http://127.0.0.1:3000/api/health').then(async r=>{console.log(await r.text()); process.exit(r.ok?0:1)})"
docker exec ftai-caddy wget -qO- --timeout=3 http://source2video:3000/api/health
curl -I https://s2v.x-lin7.com/
```
