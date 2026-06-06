# Temporary Infra SubAgent Handoff — Local Data Plane Readiness

## 任务身份

你是 Orchestrator 临时派发的 **Infra / Local Services SubAgent**。你不是常驻 Worker，不创建 `.agent` 状态。

## 目标

并行准备 Task 2+ 会用到的本地服务信息，不修改线上资源，不启动不可控长期服务。

当前约束：

- Langfuse 仍用 Cloud Free
- 用户另一个项目已有 PostgreSQL
- 本项目部署在阿里云，未来要考虑国内自部署/OSS/MinIO 兼容

## Scope

只做 readiness 调研/本地环境建议：

1. 检查当前 repo 是否已有 `.env.example`、docker compose、本地 postgres/minio 配置
2. 给出最小本地服务方案：Postgres + filesystem artifact store first；MinIO/OSS optional
3. 明确 Task 2 migrations 需要的 env var 名称
4. 不修改 Caddy/云资源/线上部署

## 可选命令

```bash
find . -maxdepth 3 -name '.env*' -o -name '*compose*.yml' -o -name '*compose*.yaml'
rg -n 'DATABASE_URL|POSTGRES|MINIO|OSS|LANGFUSE|ARTIFACT' .env.example doc-maker ui packages docs 2>/dev/null
```

## 输出要求

写回：

`/.agent/sessions/2026-06-05-infra-local-data-plane-readiness/report.md`

格式：

```markdown
## Infra Readiness Summary

- Result:
- Existing config:
- Proposed local services:
- Env vars:
- Risks:
- Do not do yet:
```
