# Langfuse 接入说明

本文是 `doc-maker` 当前 Langfuse 接入 SOT。目标不是自研观测平台，而是把业务节点的 LLM 调用、自动评分和人工轻反馈写入 Langfuse，再由 `/framework` 做业务节点 Lens。

## 1. 部署选择

当前优先使用外部 Langfuse 实例：

| 方案 | 当前状态 | 说明 |
|---|---|---|
| Langfuse Cloud | 已支持 | 推荐当前开发使用，配置 env 即可 |
| Self-host Langfuse | 暂不纳入项目脚本 | 后续需要内网化或数据治理时再补 docker / compose |
| 自研观测平台 | 不做 | Framework 只做映射和 Lens，不替代 Langfuse |

## 2. 环境变量

写入 `doc-maker/ui/.env.local`，不要提交：

```bash
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_BASE_URL="https://us.cloud.langfuse.com"
LANGFUSE_ENVIRONMENT="development"
```

可选：

```bash
# 只用于 /framework 深链跳转。未配置时仍会写 trace / score，只是不生成直接跳转链接。
LANGFUSE_PROJECT_ID="..."

# 等价于 LANGFUSE_BASE_URL，二选一即可。
LANGFUSE_HOST="https://us.cloud.langfuse.com"
```

密钥轮换不在本轮执行范围；若密钥曾进入对话或日志，后续应单独 rotate。

## 3. 数据写入策略

| 本地对象 | Langfuse 对象 | 当前实现 |
|---|---|---|
| `LLMCallTraceRecord` | Trace + Generation | `TraceSink` 写入 |
| `CoreEvalRun.attribution` | Scores | `ScoreSink.writeEvalScores()` 写入 |
| `HumanFeedbackRecord` | Score + metadata | 数字反馈写 `human.feedback_score`；标签反馈写 `human.feedback_label` |
| `ArtifactRef` | metadata | 只写 id/kind/summary/ref，不把业务 store 变成 Langfuse |
| `Run / NodeRun` | metadata 查询键 | `runId / nodeRunId / nodeId / round / candidateId / artifactId` |

Langfuse 写入失败不阻塞业务流程；系统回退 `local-json`，并在 trace metadata 中记录错误。

## 4. 验证命令

连接测试：

```bash
cd doc-maker/ui
curl --noproxy '*' -X POST http://localhost:3011/api/settings/llm/test \
  -H 'content-type: application/json' \
  -d '{}'
```

期望响应里出现：

```json
{
  "ok": true,
  "trace": {
    "sink": "langfuse",
    "langfuseTraceId": "..."
  }
}
```

完整业务闭环验证：

```bash
curl --noproxy '*' -X POST http://localhost:3011/api/writing-runs \
  -H 'content-type: application/json' \
  -d @/tmp/doc-maker-langfuse-run.json

curl --noproxy '*' -X POST http://localhost:3011/api/writing-runs/<runId>/confirm
```

验收点：

- `scope_extraction` 写入 Langfuse trace。
- `precheck_normalization` 写入 Langfuse trace。
- `candidate_generation` 写入 Langfuse trace。
- Candidate Core Eval attribution 写入 Langfuse Scores。
- 人工轻反馈写入 `human.feedback_score` 或 `human.feedback_label`。
- `/framework?runId=<runId>&nodeRunId=<nodeRunId>` 只展示该业务节点。

## 5. 与 Langfuse 自有功能的分工

| Langfuse 模块 | Langfuse 负责 | doc-maker 负责 |
|---|---|---|
| Traces / Generations | 观测调用、错误、latency、prompt/output | 业务节点上下文和跳转入口 |
| Scores | 存储自动评分、人工评分、judge 评分 | 定义评分维度、业务归因和写入时机 |
| Human Annotation | 人工复评工作台 | L1 轻反馈入口和反馈账本 |
| Datasets | 固化输入/输出样本集 | 决定哪些候选/反馈可晋升为回归样本 |
| Experiments | 比较 prompt/model/rule snapshot | 发起哪组规则快照和候选生成批次参与实验 |

## 6. Dataset / Experiment 后置设计

当前不把 Dataset / Experiment 塞进 L1 默认流程。触发条件是：已有足够历史候选、规则快照和延迟反馈，需要做回归验证。

映射方式：

```text
Promoted Candidate Artifact
  -> Dataset Item
  -> Rule Snapshot / Prompt Version / Model Variant
  -> Experiment Run
  -> Score comparison
  -> Skill Package release gate
```

这部分属于框架层能力，不是业务工作台的默认交互。L1 只显示“当前规则是否可发布”的业务结论。
