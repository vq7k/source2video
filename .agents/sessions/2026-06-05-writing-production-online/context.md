# context: Writing Production v1 online acceptance

**目标**：执行用户“部署，上线，验收”，把 2026-06-04 本地闭环收口部署到生产 `https://s2v.x-lin7.com`，并证明线上业务闭环可用。

**入口**：

- CodeUp `main` push 触发云效流水线 `5006844`
- 生产域名：`https://s2v.x-lin7.com`
- 生产容器：`source2video`
- 网关容器：`ftai-caddy`

**本轮部署 commit**：

- `dc96eb3 feat(writing): close v1 production loop`
- `c4f2356 chore(agents): add project team skills`
- `1bfce63 docs(doc-maker): add writing research notes`

