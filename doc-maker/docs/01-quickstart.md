# 01 · Quickstart

> ≤ 5 分钟从 clone 到跑通 toy 节点。
>
> **本文档定位**：第一次启动用。完成后，日常 4 动作循环见 [`04-handbook.md`](./04-handbook.md)；加新 X 的 step-by-step 见 [`05-recipes.md`](./05-recipes.md)；CLI 详细说明见 [`reference/cli.md`](./reference/cli.md)。

---

## 0. 前置（一次性）

### 0.1 环境配置

```bash
cp .env.example .env && vim .env
```

填以下字段：

```
OPENAI_API_KEY=...
OPENAI_BASE_URL=http://localhost:8317     # 走 CLIProxyAPI
LANGFUSE_HOST=...
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
S2V_MODEL=claude-sonnet-4-6
```

### 0.2 包安装

按 [`08-tech-stack.md`](./08-tech-stack.md) §3.1 / §3.3 装依赖。

### 0.3 一次跑批的四个输入（认知模型）

```
═══════════════════════════════════════════════════════════════════
 一次跑批的 4 个输入                            产出
═══════════════════════════════════════════════════════════════════

  ┌─[1] Node 实现 ─────────────────────────────┐
  │  nodes/<name>/node.py                       │
  │  Python class 实现 Node Protocol             │
  │  声明 materials_spec（要哪些物料）           │
  │  (框架 MVP 用 ToyNode；业务侧第二轮加 Plan/Shot)│
  └─────────────────────────────────────────────┘
                       +
  ┌─[2] Cases（输入数据）─────────────────────┐
  │  fixtures/cases/train/*.md                  │     ┌──────────────┐
  │  fixtures/cases/holdout/*.md (锁，禁访问)    │ ──► │ Artifacts    │
  │  每个 case 配套 metadata.yaml                │     │ Trace        │
  └─────────────────────────────────────────────┘     │ Eval 报告    │
                       +                              │ Metrics      │
  ┌─[3] Materials（行为配方）────────────────┐       └──────────────┘
  │  nodes/<node>/                              │
  │  ├── prompts/    必备                       │
  │  ├── schemas/    必备                       │
  │  ├── rubrics/    必备                       │
  │  ├── style_guides/  可省                    │
  │  └── exemplars/  可省（bootstrap 建议 ≥1）   │
  └─────────────────────────────────────────────┘
                       +
  ┌─[4] Env（运行时）──────────────────────────┐
  │  .env（见 §0.1）                            │
  └─────────────────────────────────────────────┘
```

---

## 1. Smoke 跑通（5 步）

```bash
# Step 1 · 检查物料就位（缺必备直接报错）
s2v materials check toy
# 校验 prompts / schemas / rubrics 必备；style_guides / exemplars 可省

# Step 2 · 检查 case 集
s2v cases list --split train              # 列出已注册 case + schema 校验

# Step 3 · Smoke：单 case 跑通（第一次禁止全量）
s2v run toy --cases fixtures/cases/train/01_basic.md

# Step 4 · 看产出（见 §2）
cat traces/artifacts/01_basic.yaml
cat traces/decisions/01_basic.yaml
cat reports/eval_<run_id>.md

# Step 5 · 全量 train
s2v run toy --cases fixtures/cases/train/ --concurrency 4
s2v metrics summary <run_id>               # 决定下一步动哪一层
```

> **第一次禁止全量**：先 smoke 单 case，节省 LLM cost + 防止整批因低级错误浪费。

---

## 2. 看到什么算成功

| 输出 | 在哪里 | 看什么 |
|---|---|---|
| Artifacts | `traces/artifacts/<case_id>.yaml` | 主产物（含内嵌物料版本号） |
| Decision Trace | `traces/decisions/<case_id>.yaml` | LLM 凭啥这么写（模板渲染 / 注入物料 / thinking） |
| Eval 报告 | `reports/eval_<run_id>.md` | 各 rubric 维度 pass/fail 分布 + attribution 聚类 |

**先看 Eval 报告里的"一次过率"和"top 失败原因"**。这俩数决定你下一步动哪一层（见 [`04-handbook.md`](./04-handbook.md) §改物料 L0–L5）。

---

## 3. 下一步

| 我要做什么 | 去哪 |
|---|---|
| 进入日常迭代循环（跑批 → 审 → 改 → 验） | [`04-handbook.md`](./04-handbook.md) |
| 改物料（撞墙怎么办、L0–L5） | [`04-handbook.md`](./04-handbook.md) §改物料 |
| 加新 source case | [`05-recipes.md`](./05-recipes.md) §5.1 |
| 加新物料（bootstrap 从零） | [`05-recipes.md`](./05-recipes.md) §5.2 |
| 加新节点 | [`05-recipes.md`](./05-recipes.md) §5.3 |
| CLI 命令查询 | [`reference/cli.md`](./reference/cli.md) |
| 不变量速查 | [`03-invariants.md`](./03-invariants.md) |
