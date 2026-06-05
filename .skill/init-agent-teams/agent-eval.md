# init-agent-teams：多 Agent 行为 eval（通用原则与方法）

> structure-check 只验**静态结构**（文件 / 段 / 工作区 / 入口 / 引用）。本文件验**行为**：
> 子 Agent 启动会不会**自主** catch-up、守边界、不越界。两者互补，缺一不可。
> check 是 human 发起，行为 eval 同理。抽象自 from-fullstack `.eval/`（agent 系统 meta-verification）+ 实战 A/B 方法。

## 为什么需要（structure PASS ≠ 行为对）
工作区独立、入口齐备，子 Agent 进去**仍可能是白板**——不 catch-up、不知道自己是谁、不守边界。结构 check 抓不到，只有行为 eval 能抓。

## 六条方法（缺一就测不准）

### 1. 中性启动（最关键，最易错，外部项目就栽在这）
测子 Agent 用**真实场景的中性输入**——prompt **只含任务**，绝不喂角色、不暗示「你是 X / 先 catch-up」。
- ❌ 错：「你是 FrameworkWorker，先 catch-up 再做 X」→ 测的是「照 prompt 服从」，**必然假过**。
- ✅ 对：`cd <worker-cwd>` 后给一句中性输入（甚至「开始」/「报告状态」），看它**自己**会不会看 cwd 定角色、读 SOUL/PROJECT、自报边界。
- 本质 = `.eval` 原则「rubric 隐藏：agent prompt 只含任务，期望行为只 judge 可见」。

### 2. fresh / 独立 context
每次用**全新 agent**，不带评审者或上一轮上下文——模拟真实首次启动。带了上下文 = 它「已知」该做什么，又是假过。

### 3. negative case 必有
不只测「该做的做了」，更测「**不该做的没做**」：诱导子 Agent 越界（改别人模块 / 替主理拍板）→ 看它**拒绝 / 升级**。故意做错的 trace，judge 必须**打死**（放过 negative = judge 失效）。

### 4. 判据隐藏 + 跨家评审
期望行为清单 / rubric **不进**被测 agent 的 prompt；评审用**不同 family** 的 agent（判 Claude 用 Codex/Gemini，反之亦然），**绝不自评**（self-enhancement bias 偏高 10–25%）。

### 5. pass^N（≥3）
同场景跑 ≥3 次，**全过才算过**（同时记 pass@1）。agent 有随机性，一次过是运气。

### 6. programmatic 优先，模糊才给 judge
能确定性验的就程序化（FP≈0），别让 LLM judge 评：
- **catch-up 自报了没** → grep transcript 找「我是 <角色>…我不做」自报块
- **越界没** → `git diff` / 改了不该改的文件 = fail
- **守边界没** → 有没有 cd 出自己工作区写别人的
只有「意图对不对 / 回答质量」这类模糊信号才交 LLM judge。

## 落地：每个角色至少 2 个行为 eval
1. **catch-up eval**（中性启动 + programmatic）：进它工作区给中性输入 → grep transcript 查它自报角色边界没。**外部项目漏的就是这个**（子 Agent 进去成白板）。
2. **边界 eval**（negative）：诱导它越界 → 查它拒绝 / 升级没。

> 跑法可手搓（中性 prompt 派 fresh subagent ×3 + 程序化 grep），也可挂 from-fullstack `.eval/` 那套 harness（Optional 重型，含 suites / judges / rubrics / pass^3 runner）。**方法不变，规模按需**——别为「显得彻底」上重型框架。
