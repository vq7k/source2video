# 04 · source2video 用户使用手册

> **阅读位置**：04 / 10（入口：[`README.md`](./README.md)）。**本文档定位**：日常操作手册——拿到框架后**每天怎么干活**、**撞墙怎么办**。**只装日常 4 动作循环**。
>
> 配套：[`01-quickstart.md`](./01-quickstart.md)（首次启动 5 步）、[`05-recipes.md`](./05-recipes.md)（加新 X 的 step-by-step）、[`reference/cli.md`](./reference/cli.md)（CLI 速查）、[`02-architecture.md`](./02-architecture.md)（机制定义）、[`07-acceptance.md`](./07-acceptance.md)（验收 AC）、[`_future/business-design.md`](./_future/business-design.md)（业务案例）。
>
> **本手册与其它文档的关系**：架构 + ADR 回答"是什么 / 凭什么 / 验什么"；**04 回答"我作为用户，每天怎么用"**。冲突以架构定义为准。

---

## 0. 谁该读

- 任何要用 source2video 跑批 / 改物料 / 提反馈的人
- 任何撞到"产物不可用、改了 prompt 还是不行"的人
- 任何想把框架接到新业务节点的人

不需要读你已经知道的章节，按"今天我要干什么"跳着读。

**首次启动？** → 先去 [`01-quickstart.md`](./01-quickstart.md) 跑通 toy，再回来进循环。

---

## 1. 日常循环：四个动作

```
═══════════════════════════════════════════════════════════════════
   ┌──────────────┐    ┌──────────────┐
   │  1. 跑批     │ ─► │  2. 审产物   │
   │  s2v run     │    │  反馈入库    │
   └──────────────┘    └──────┬───────┘
          ▲                   │
          │                   ▼
   ┌──────────────┐    ┌──────────────┐
   │  4. 验证     │ ◄─ │  3. 改物料   │
   │  双向 Gate   │    │  按 L0~L5    │
   └──────────────┘    └──────────────┘
═══════════════════════════════════════════════════════════════════
```

四个动作 = 一轮完整迭代。**每一轮必须四个都做**——跳任何一个都会埋坑。

### 动作 1 · 跑批（极简）

```bash
s2v run <node> --cases fixtures/cases/train/ --concurrency 4
s2v metrics summary <run_id>
```

完整命令清单 + 跑批产出三件套见 [`reference/cli.md`](./reference/cli.md) §3。

**先看 Eval 报告里的"一次过率"和"top 失败原因"**——这俩数决定下一步动哪一层（见下方 §改物料 §一次过率分诊）。

---

## 2. 动作 2 · 审产物 + 提反馈

### 2.1 审什么

打开 Per-Node Console（Streamlit）或直接读 `traces/artifacts/`，重点看：

- **artifact 字段**：是不是结构合规？关键字段（如 shot intent）对不对？
- **Eval Attribution**：fail 的维度——LLM 为啥判 fail？引用的规则段落对不对？
- **Decision Trace**：LLM thinking 摘要——它的逻辑你认可吗？

### 2.2 提反馈（不是写自由文本，是填结构化表单）

```bash
s2v feedback add \
  --artifact <id> \
  --location "shots[2].intent" \
  --verdict bad \
  --likely-cause prompt \
  --severity medium \
  --issue "intent 标为 recap，实际内容是引入新概念"
```

字段约束：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `location` | 路径（机器可索引） | ✅ | 精确指 artifact 内字段 |
| `verdict` | `good` / `bad` / `minor_nit` | ✅ | 不用 5 星评分 |
| `likely_cause` | `style` / `prompt` / `schema` / `rubric` / `exemplar` / `single-case` | ✅ | **聚类归因的命根子，受限标签** |
| `issue` | 自由文本 ≤ 200 字 | ✅ | 30 秒一句话 |
| `expected` | 自由文本 ≤ 200 字 | 选 | 应该是什么 |
| `severity` | `high` / `medium` / `low` | ✅ | 优先级 |
| `tags` | 自由 string list | 选 | 演化中的细分（如 `tts_pronunciation`） |

### 2.3 关键纪律：**单条反馈不立即改物料**

看到一条反馈想改 prompt？**忍住**。等反馈队列累积。

**何时触发改物料**：

```
反馈队列里 ≥ 3 条同 likely_cause 才触发改物料
（不变量 #15：单条反馈不触发，CI 拒绝引用 < N 条反馈的物料 bump）
```

**为什么**：单条反馈是噪声，三条同因是信号。改一次物料触发整轮 promote pipeline——成本不低，别拿噪声驱动。

---

## 3. 动作 3 · 改物料（按 L0–L5 升级路径） ★

**先看一次过率分诊。不要一上来就改 prompt**。

### 3.1 一次过率分诊表（决定起手动哪一层）

| 一次过率（train） | 诊断 | 起手做什么 |
|---|---|---|
| **0%** | 物料方向完全错 | **停！不要改 prompt**。重审任务边界。可能直接 L4/L5 |
| **10–40%** | 物料对了基础但关键路径错 | 失败聚类找 top 1 类问题 → 改对应层（多半 L1/L2） |
| **40–80%** | 多个并列失败 | **每次只改一个最高频类**，禁止一次改多个 |
| **80–95%** | 长尾问题 | 看 attribution：零散随机 → 标 `single-case`，不改全局物料 |
| **95%+** | 收敛 | 停止迭代，转新维度 |

### 3.2 L0–L5 升级路径（代价从轻到重）

```
═══════════════════════════════════════════════════════════════════
 L0  改 prompt 措辞           ← 最便宜，先试
       动作：改 nodes/<node>/prompts/<step>.md 文字
       例：加一句"避免学术腔"、改 anchor 措辞

 L1  加 / 改 exemplar
       动作：往 nodes/<node>/exemplars/<purpose>/ 加 few-shot
       例：用一份真实样本展示"我要的样子"

 L2  改 rubric 维度 / anchor（标杆例子）
       动作：改 nodes/<node>/rubrics/<name>.yaml
       例：维度漏了→加；anchor（标杆例子）描述模糊→收紧；反例不够→补
       (anchor = 每维度配 0/5/10 分各对应一个具体范例，给 judge 对照打分)

 L3  改 schema（输出结构错了）
       动作：改 nodes/<node>/schemas/<artifact>.py
       例：字段类型错、缺约束、可选字段太多
       注意：schema 改动要 migration 脚本 + 老数据回放

 L4  拆节点（任务太大，单节点搞不定）
       动作：在 nodes/ 加新 Node、把任务切成多步链
       注意：动节点代码——只对 IO 契约负责，不为审美变化动
       加新节点流程见 05-recipes.md §5.3

 L5  重新定义任务（LLM 可能根本不该干这事）
       动作：往回找业务设计文档（_future/business-design.md）
       承认"这一步当前模型能力做不到"或"任务定义本身错了"
       ← 最贵但最诚实
═══════════════════════════════════════════════════════════════════
```

### 3.3 Bounded Budget · 撞墙怎么办

**最关键的硬约束**：**同一层物料连续 K 次 bump 后 holdout 仍无改进 → 框架禁止继续改该层，必须升级**。

```
你在 L0 改 prompt：
  v1.0 → v1.1：holdout 没改进，K=1
  v1.1 → v1.2：holdout 没改进，K=2
  v1.2 → v1.3：holdout 没改进，K=3 ← 撞 Budget Cap

────────────────────────────────────────────
框架行为：CLI / CI 拒绝你提 L0 物料 bump
信息："L0 prompt 已 3 轮无改进，必须升级到 L1+"
────────────────────────────────────────────

你的选择：
  ✅ 升到 L1 加 exemplar
  ✅ 升到 L2 改 rubric
  ✅ 升到 L3+ 改 schema / 拆节点 / 重定义任务
  ❌ 继续改 prompt（被 CLI / CI 拦住）
```

**为什么这么硬**：
1. 死磕 prompt = 完美的过拟合（在 train 上越改越好，holdout 永远过不去）
2. 业务永远等不到能用版本
3. 撞墙强制升级 = 让你**诚实承认"这一层不够"**，而不是装作在工作

**撞墙后该怎么诊断哪一层升级**：

| Top 失败原因 | 推荐升级到 |
|---|---|
| LLM "理解了任务但说错话" | L1 加 exemplar / L2 收紧 rubric anchor |
| LLM 输出"看起来对但字段不对" | L3 改 schema |
| LLM "一次给不完所有要求"（reasoning 长 / 输出复杂） | L4 拆节点 |
| LLM "反复跑不出来即使全部 hint" | L5 任务边界本身错，承认 |

---

## 4. 动作 4 · 验证物料改动（双向 Gate）

### 4.1 流程

```bash
# Step 1: 跑当前版本做 baseline
s2v eval baseline --materials <node>/v1.0 --cases all

# Step 2: 改物料 bump → v1.1（编辑 nodes/<node>/...）

# Step 3: 跑 v1.1 并与 baseline 双向对比
s2v eval regression --materials <node>/v1.1 --baseline v1.0
```

### 4.2 双向 Gate 裁决

```
═══════════════════════════════════════════════════════════════════
 Train pass 率：  v1.0 = 65%  →  v1.1 = 78%   ✓ 改进 +13pp
 Holdout pass 率：v1.0 = 60%  →  v1.1 = 55%   ✗ 退化 -5pp
═══════════════════════════════════════════════════════════════════
 裁决：拒绝合并（过拟合的指纹）
 K 轮计数：+1（撞 Budget Cap 一步近）
 处置：回滚 v1.1，或升级到下一层
═══════════════════════════════════════════════════════════════════
```

### 4.3 通过判据（不变量 #14）

- ✅ Train pass 改进 ≥ Δ（默认 Δ=0，至少不退）
- ✅ Holdout pass 任一 rubric 维度不退化（pass 数不降）
- 任一不满足 → CI 红 → **PR 阻塞合并**

### 4.4 提交规范

```bash
git add nodes/<node>/
git commit -m "bump <node> v1.0 → v1.1

fix-of: [fb_2026_05_12_001, fb_2026_05_13_004, fb_2026_05_13_007]
layer: L1 (added exemplar 'ex_034')
gate: train 65→78 (+13), holdout 60→62 (+2)
"
```

`fix-of` / `layer` / `gate` 三个字段强制 — CI 检测，缺失即拒。

---

## 5. 常见错误与诊断

### 5.1 "改了 5 次 prompt 还是不行"

→ 你撞 Budget Cap 了。**框架会拦你**。看 §3.3：必须升级到 L1+。

### 5.2 "Train 95% 但 holdout 才 50%"

→ 你过拟合了。**双向 Gate 会拦你**。回滚最近几版物料，看哪一版开始 holdout 退化，从那里调整。

### 5.3 "我看到一条反馈很离谱想立刻改 prompt"

→ 忍住。等 ≥ 3 条同 `likely_cause` 才能改（不变量 #15）。单条 = 噪声。

### 5.4 "我想偷偷瞄一下 holdout 里的 case 长啥样"

→ CI 会检测 commit message / diff 是否引用 holdout case id（不变量 #13）。**别偷看**——偷看一次 holdout 就废了，等于又退回 train 集。

### 5.5 "Eval 报告说某条 rubric fail 但 attribution 字段为空"

→ judge 没正确输出 attribution。这是框架 bug，**该次执行直接判失败**（不变量 #3）。不要凭"看着应该是 X 错"自己脑补 attribution——这违反白盒化纪律。

### 5.6 "我想用真实业务数据跑框架，发现 fixtures 都是合成的"

→ 框架 MVP 只跑 synthetic（不变量隐含）。真实业务数据跑业务节点是**第二轮的事**，见 [`_future/business-design.md`](./_future/business-design.md) §9。

---

## 6. 工作流速查（决策树）

```
我要做什么？
├── 第一次启动 / 没准备好环境 → 01-quickstart.md
├── 加新 source case → 05-recipes.md §5.1
├── 加新物料（bootstrap） → 05-recipes.md §5.2
├── 加新节点 → 05-recipes.md §5.3
├── 直接跑批（前置就位） → reference/cli.md §3
├── 看到产物想反馈 → §2
├── 准备改物料 →
│     ├── 一次过率 0% → 停！重审任务（§3.1）
│     ├── 一次过率 10-95% → 按 §3 走 L0–L5
│     └── 撞 Budget Cap → §3.3 强制升级
├── 改完物料要提交 → §4 双向 Gate
├── 撞错 / 想偷懒 → §5 常见错误
└── 忘了某条命令 → reference/cli.md
```

---

## 7. 三条铁律（写在墙上）

| # | 铁律 | 为什么 |
|---|---|---|
| 1 | **看到一条反馈不立即改 prompt** | 单条 = 噪声 / ≥3 条 = 信号（不变量 #15） |
| 2 | **物料 bump 必须 train 改进 + holdout 不退化双满足** | 单向 = 过拟合（不变量 #14） |
| 3 | **撞 K 轮 Budget 不让你死磕，必须升级 L0→L5** | 死磕 = 假装在工作，业务永远等不到（不变量 #16） |

牢记这三条 = 80% 的"产物不可用怎么办"答案已经在手。
