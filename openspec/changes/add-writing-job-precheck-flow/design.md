## Context

当前 `/` 首页已经承载 Writing Production 的核心概念，但输入、Precheck、候选生成都是静态展示。产品上需要验证用户是否能理解并完成第一条真实路径：编辑 Job Spec、确认 Output Profile、运行 Precheck、确认评分标准，再进入候选生成。

## Goals / Non-Goals

**Goals:**

- 将首页改为 client-side mock flow。
- 输入字段可编辑，修改后自动回到 `needs-precheck` 状态。
- `Run Precheck` 生成/刷新固定结构的 Precheck 结果。
- `Confirm Precheck` 后才展示 Candidate Drafts。
- Output Profile 保留 `structured explanation package` 默认档案。

**Non-Goals:**

- 不实现真实 LLM 生成。
- 不保存到数据库、localStorage 或文件。
- 不接真实相似度检测、真实评分器或 skill 仓库。
- 不改 L2/L3 诊断路由。

## Decisions

### 决策 1：用单页 client state 表达流程

首页改为 `"use client"`，用 `useState` 保存 Job Spec、Precheck 阶段和 Output Profile。

理由：这是产品交互验证，不需要引入后端 API 或状态库。

### 决策 2：阶段只设三态

阶段为：

- `needs-precheck`：用户正在编辑，候选区隐藏。
- `precheck-ready`：Precheck 产出可审，候选区仍隐藏。
- `confirmed`：用户确认 Precheck 后展示候选 Draft。

理由：三态足够表达“Precheck 是生成前 gate”，避免把 mock 做成伪工作流系统。

### 决策 3：Precheck 结果用输入派生文案

Precheck mock 使用当前标题/目标/Output Profile 生成少量派生文案，其余规则固定。

理由：让用户看到输入影响结果，同时不伪装成真实智能处理。

## Risks / Trade-offs

- 交互仍是 mock，可能被误解为真实生成 → 在 UI 中保留 “mock / no backend” 语义，避免承诺。
- 首页文件会变大 → 本轮优先验证产品路径；后续稳定后再拆组件。
- 隐藏候选区会减少首屏信息 → 用空态明确“确认 Precheck 后生成”，强化 gate。
