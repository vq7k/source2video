# context: source2video production deploy

**日期**：2026-06-02
**目标**：参考已上线项目 `/Users/xuelin/projects/agent-minimal`，将当前项目部署到 `https://s2v.x-lin7.com`，并完成线上可用性验收。

## 起始上下文

- CodeUp 仓库：`https://codeup.aliyun.com/62cd1e4411fc0f0c9e2b51d0/agent/source2video.git`
- 云效流水线：`5006844`
- 服务器：阿里云轻量服务器，Docker Compose 部署
- 域名：`s2v.x-lin7.com`
- 用户指定：LLM 参考现有项目，使用 `deepseek-v4-pro`；部署后监控流水线并处理线上问题。

## 约束

- 不碰用户/既有无关脏文件。
- 外网请求走本机代理。
- 线上验收不能只看中间状态，必须覆盖用户实际链路。
