# TODO

## 当前 in-progress

无。等待 Orchestrator 派活。

## 下一候选

- [ ] 盘点现有本地/另项目 PostgreSQL 的复用方式与隔离策略
- [ ] 为 framework data plane 补本地 Postgres + MinIO + worker 启动拓扑
- [ ] 补 `.env.example`：FRAMEWORK_DATABASE_URL、artifact store、worker、Langfuse
- [ ] 补部署文档：阿里云 ECS / Caddy / OSS / backup / rollback

## 质量门禁

- [ ] 不把 secret 写入 git
- [ ] 每个新增服务都有本地启动、健康检查、数据备份说明
- [ ] 线上变更必须由 user explicit 拍板后执行
