# CLI 速查

> **本文档定位**：所有 `s2v` 命令的查询手册。日常 4 动作循环见 [`../04-handbook.md`](../04-handbook.md)；第一次启动见 [`../01-quickstart.md`](../01-quickstart.md)；加新 X 的流程见 [`../05-recipes.md`](../05-recipes.md)。

---

## 1. Source 入仓

| 命令 | 用途 | 何时用 |
|---|---|---|
| `s2v cases lint <path>` | source 规则校验（schema / 大小 / encoding / 命名）| 写完 case markdown 后，register 之前。失败即拒 register。 |
| `s2v cases register --case <path> --split auto` | 注册 case，自动 70/30 哈希分到 train/holdout | lint 通过后调用。算 sha256、入 manifest、移到 train/ 或 holdout/ 目录。 |
| `s2v cases list --split <train\|holdout>` | 列已注册 case + schema 校验 | 看现有 case 集 / 确认 register 成功。 |
| `s2v cases manifest` | 看 manifest（含 sha256 / split / metadata） | 反查"某 case 从哪来 / 是哪个 split"。 |

完整 Source 入仓流程见 [`../05-recipes.md`](../05-recipes.md) §5.1。

---

## 2. 物料

| 命令 | 用途 | 何时用 |
|---|---|---|
| `s2v materials check <node>` | 校验该节点物料 5 类是否合规（缺必备直接报错） | 跑批前 / 加完新物料后兜底 / CI。 |
| `s2v materials reload` | 重新加载物料（cold reload） | 改完物料想立即让 runtime 看到新版本。 |
| `s2v materials promote <node> v1.0→v1.1` | 触发 promote pipeline（双向 Gate 裁决） | 物料 bump 后走正式上线流程。 |

物料 bump 的双向 Gate 见 [`../04-handbook.md`](../04-handbook.md) §验证；加新物料 bootstrap 见 [`../05-recipes.md`](../05-recipes.md) §5.2。

---

## 3. 跑批

### 3.1 命令

| 命令 | 用途 | 何时用 |
|---|---|---|
| `s2v run <node> --cases <set>` | 跑批某节点（全量或单 case 均可） | 日常迭代主命令。 |
| `s2v run <node> --cases fixtures/cases/train/<case>.md` | 跑单 case 调试 | smoke / 定位某 case 问题。 |
| `s2v run <node> --cases fixtures/cases/train/` | 跑全量 train 集 | 物料改完跑回归 / baseline。 |
| `s2v run <node> --cases fixtures/cases/train/ --concurrency 4` | 全量并发跑 | train 集 ≥ 5 case 时省时间。 |
| `s2v run <node> --materials <node>/v1.2 --cases <set>` | 用指定物料版本跑 | 物料版本对比 / 回滚验证。 |
| `s2v run <node> --cases fixtures/cases/holdout/` | 跑 holdout 集 | **仅** CI / promote gate；日常迭代期 CLI 会警告（不变量 #13）。 |

### 3.2 跑批结束你会拿到三样东西

| 输出 | 在哪里 | 看什么 |
|---|---|---|
| Artifacts | `traces/artifacts/<case_id>.yaml` | 主产物（含内嵌物料版本号） |
| Decision Trace | `traces/decisions/<case_id>.yaml` | LLM 凭啥这么写（模板渲染 / 注入物料 / thinking） |
| Eval 报告 | `reports/eval_<run_id>.md` | 各 rubric 维度 pass/fail 分布 + attribution 聚类 |

**先看 Eval 报告里的"一次过率"和"top 失败原因"**。这俩数决定下一步动哪一层（见 [`../04-handbook.md`](../04-handbook.md) §改物料 L0–L5）。

---

## 4. 反馈

| 命令 | 用途 | 何时用 |
|---|---|---|
| `s2v feedback add ...` | 提结构化反馈（location / verdict / likely_cause / severity / issue 必填） | 审产物时发现问题——单条不立即改物料，等聚类。 |
| `s2v feedback list --artifact <id>` | 列出某 artifact 的反馈 | 查某个产物已被标了哪些问题。 |
| `s2v feedback triage` | 看反馈聚类（按 likely_cause 分组） | 决定该改哪一层物料（≥ 3 条同 cause 才触发）。 |

反馈字段约束 + 不变量 #15（单条反馈不触发改物料）见 [`../04-handbook.md`](../04-handbook.md) §审产物。

---

## 5. Eval

| 命令 | 用途 | 何时用 |
|---|---|---|
| `s2v eval baseline --materials <node>/v1.0 --cases all` | 跑 baseline 存档 | 物料 bump 前先固定 baseline，再改新版本。 |
| `s2v eval regression --materials <node>/v1.1 --baseline v1.0` | 跑回归 + 双向 Gate 裁决（train + holdout）| 物料 bump 后验证不退化 → 决定能否合并。 |
| `s2v eval calibrate --sample N` | 抽样人工评审校准 | 治理实践（业务侧第二轮+），看 judge 是否漂移。 |
| `s2v eval correlate` | 算 judge ↔ 真实质量相关性 | 治理实践，下游成品累积到阈值时跑。 |

双向 Gate 通过判据（不变量 #14）见 [`../04-handbook.md`](../04-handbook.md) §验证。

---

## 6. 状态

| 命令 | 用途 | 何时用 |
|---|---|---|
| `s2v budget status <node>` | 看当前节点在哪一层 + 还剩几轮 budget | 改物料前查 K 轮计数，避免撞 Bounded Budget Cap。 |
| `s2v metrics summary <run_id>` | 看跑批聚合（一次过率 / top 失败类） | 跑批结束第一件事，决定下一步动哪一层。 |

Bounded Budget 机制（不变量 #16）见 [`../04-handbook.md`](../04-handbook.md) §改物料 L0–L5。

---

## 7. 不允许的操作（CLI 强制拦截）

| 反模式 | 框架怎么拦 |
|---|---|
| 直接把文件丢到 `fixtures/cases/train/` 跳过 register | pre-commit hook 检测无 manifest 入口 → 拒绝 commit |
| 物料迭代期间偷改 holdout case 内容 | git diff 检测 → 拒绝（不变量 #13） |
| 用 Web UI 上传（绕过 git） | 第一版**没有 Web UI**，设计上排除（ADRs/021.md） |
| source 没经过 lint 就 register | `register` 命令内部强制先调 `lint` |
| 跑批时引用未 register 的 case | `run` 命令检查 manifest，未 register 即报错 |
| 第一次就跑全量 train | 不强拦，但**强烈建议先 smoke 单 case** |
