# 实现偷懒审查与改造计划

日期：2026-05-19

## 结论

当前 `/writing` 已能跑通轻量写作飞轮，但底层实现把“产品设计里的独立路径”简化成了“单次批量生成 + 生成自带分数”。这违反了 doc-marker 的核心设计：候选版本应该是多条可观察、可评估、可复盘的可能路径。

2026-05-19 修复状态：P0/P1 已落地。新生成 run 采用 `independent_candidate_paths`，每轮写入 3 个 `candidate_generation` trace、3 个 `candidate_eval` trace 和 1 个 `candidate_batch` 汇总节点；推荐逻辑读取 eval result，不再读取生成分；生成 trace 不再携带 `breakdown` 或 `scoreHints`。

2026-05-21 同步状态：`/writing` 已做 L1 轻量化收敛。UI 不再展示 G1/E1 等内部 pipeline 格子，改为自然语言进度；右侧 ContextPanel 删除，上下文改为中央折叠条；`定稿` 主按钮降级为 `标为最终`，复制文本成为更直接出口。

## 需要改造的问题

| 优先级 | 问题 | 当前实现 | 正确实现 |
|---|---|---|---|
| P0 | 3 个候选不是独立生成 | `candidateCount: 3` 一次 LLM 调用返回 3 个 candidates | 已改：3 次独立 `candidate_generation` 调用，共享同一 Rule Snapshot |
| P0 | Eval 不是独立节点 | `CandidateDraft.breakdown` 由生成调用返回，再映射成 deterministic eval | 已改：每个 candidate 生成后单独跑 `candidate_eval`，生成节点不产分 |
| P0 | 推荐逻辑依赖生成分 | `writing-topic-view.ts` 用 `candidate.total` 排序 | 已改：只用 eval 结果推荐；无 eval 时显示“待评估” |
| P0 | Trace 粒度错误 | 一个 batch trace 代表 3 个候选和一组 eval | 已改：父级 batch + 3 个 generation observation + 3 个 eval observation |
| P1 | Store 结构混合 | `CandidateRecord.total/breakdown` 同时承担候选内容和评分结果 | 已缓解：权威评分写入 `EvalRun`；`CandidateRecord.total/breakdown` 仅作为历史 UI 兼容缓存 |
| P1 | UI 进度不透明 | loading 文案写“生成 3 个版本”，看不到执行过程 | 已改：内部仍有独立生成/eval trace，但 L1 只展示自然语言进度，不暴露 G1/E1 |
| P1 | Framework Lens 显示伪 score | `/framework` 直接显示 `candidate.total/breakdown` | 已改：候选卡展示 eval attribution；生成节点只展示候选内容 |
| P2 | 旧 L1 页面残留自动评分 | `app/page.tsx` 仍有“自动评分 / breakdown”展示 | 已改：旧页评审分数读取 `EvalRun.candidateResults` |
| P2 | Mock/fallback 边界不清 | mock provider 可生成候选；历史 mock 数据混入列表 | mock 只作为显式 dev provider；L1 标清来源，默认不伪装真实结果 |
| P2 | Precheck 被轮次污染 | `contentBrief` 追加“第 N 批采纳反馈” | Precheck 保持输入契约；轮次变化写入 Rule Snapshot / Round Note |
| P3 | 文档验收口径过期 | `07-acceptance.md` 仍写“每篇展示自动总分” | 改成“候选完成后进入独立 eval，才显示评分” |

## 改造顺序

1. **先改数据契约**
   - 增加 `CandidateGenerationNodeRun` / `CandidateEvalNodeRun`。
   - `GenerationRunRecord` 增加 `candidateNodeRunIds`、`evalNodeRunIds`。
   - 保留 `candidate.total/breakdown` 只做历史 UI 兼容缓存，权威评分来源为 `EvalRun.candidateResults`。

2. **拆生成节点**
   - 新增 `generateCandidateVariant(run, snapshot, variantIndex)`。
   - 3 个候选并发或顺序独立调用 LLM。
   - 每个调用写自己的 `LLMCallTraceRecord`、`nodeRunId`、Langfuse observation。

3. **拆 eval 节点**
   - 新增 `evaluateCandidate(run, candidate)`。
   - 初期用 deterministic evaluator，但必须独立于生成调用。
   - Eval 输出写 `EvalRun.candidateResults` 和 Langfuse Scores。

4. **改推荐逻辑**
   - `buildWritingTopicView()` 不再用 `candidate.total`。
   - 推荐来源为最新 round 的 eval result。
   - 无 eval / eval failed 时不推荐，只显示待评估或失败。

5. **改 L1 UI**
   - L1 只展示用户语言进度，内部节点链交给 `/framework` 和 Langfuse Lens。
   - 结果卡只显示 eval 依据，不展示生成阶段伪分。
   - “再来一轮”读取本轮 eval、用户反馈方向和补充要求生成下一轮。

6. **改 Framework Lens**
   - 左侧按 Run -> Candidate Path -> Node 展示。
   - Candidate generation 和 candidate eval 分开看输入、输出、trace、score。
   - 从 L1 观测入口带 `runId`，Framework Lens 内部按 candidate/node 定位。

7. **迁移和兼容**
   - 历史 run 可读，但标记 `legacy_batch_generation`。
   - 历史分数标记 `legacy_generation_score`，不再作为当前推荐依据。

8. **测试**
   - 单测：3 个候选产生 3 个 generation trace、3 个 eval result。
   - 集成：生成失败一个候选时，另外两个不丢。
   - UI：无 eval 不显示推荐分；eval 完成才展示推荐。

## 当前不做

- 不引入 RAG / 数据集实验平台。
- 不做 LLM-as-judge 第一版；先把 deterministic eval 独立成节点。
- 不做全量数据库迁移；继续使用本地 JSON，但写入结构必须按新契约。
- 不在 L1 展示 raw prompt、token、trace payload；这些属于观测层。
