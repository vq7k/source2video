# source2video 测试用例附录

> **位置**：_future/test-cases.md。**业务侧（PPT→视频）设计**，第二轮才动手开发。
> MVP 过线前**不读**。框架 MVP 出口判据见 [`../07-acceptance.md`](../07-acceptance.md) §5。
>
> 配套：[`../07-acceptance.md`](../07-acceptance.md) §3 测试用例与 Fixtures（含设计原则 / 目录结构 / 回归基线 / CI 集成）、[`./user-stories.md`](./user-stories.md)（每个 case 关联的 US）。
>
> **冲突优先级**：07-acceptance §3 设计原则 + §3.6 CI > 本文档 case 细节。

---

## 1. 测试用例设计表

每个 case 设计一种边界条件，框架必须**全部跑通且 attribution 完整**才算通过。

| Case ID | 文件 | 设计意图（覆盖边界） | 长度 | 关联 US | 期望框架行为 |
|---|---|---|---|---|---|
| **TC-01** | `01_basic.md` | baseline：普通段落 + 列表，无边界压力 | ~300 字 | US-09, US-10 | Schema 合规；rubric 3 维度全 pass 或带 attribution 的 fail；Decision Trace 完整 |
| **TC-02** | `02_short.md` | 极短：≤ 50 字，信息密度低 | ≤50 字 | US-09, US-11 | LLM 可能拿不出 5 个要点 → schema 允许 `points ≥ 1` 不强制 5；不报错 |
| **TC-03** | `03_long.md` | 极长：≥ 3000 字，要点抽取必须收敛 | ≥3000 字 | US-09, US-11 | 不超 token 限制；输出仍 ≤ 5 要点；Decision Trace 显示模板渲染未爆 |
| **TC-04** | `04_with_code.md` | 含三处 fenced code block + inline code | ~500 字 | US-09 | parse 不被代码块干扰；要点抽取不把代码当文本切碎 |
| **TC-05** | `05_unicode.md` | 中英混排 + emoji + 数学符号 + 全角标点 | ~400 字 | US-09 | 编码不挂；token 边界不切断字符；LLM thinking 摘要正常落字段 |
| **TC-NEG-01** | (运行时构造) | 缺失 materials version 字段的物料 | — | US-02 (AC-02.4) | 启动直接报错，**不允许裸跑** |
| **TC-NEG-02** | (运行时构造) | judge 输出缺 attribution 字段 | — | US-10 (AC-10.2) | 该次执行直接判失败 |
| **TC-NEG-03** | (运行时构造) | LLM 返回不合 schema 的 JSON | — | US-09 | tenacity retry ≤ 2 次后入失败队列，不阻塞其他 case |

## 2. 测试用例内容详述

每个 case 给：**意图 + 内容骨架 + 验证点**。完整文件在 `fixtures/cases/` 下，框架实施时按下列规范生成。

---

#### TC-01 · `cases/01_basic.md`

**意图**：baseline。普通讲解性 markdown，无任何边界压力，所有维度应顺利通过。

**内容骨架**：

```markdown
# 关于一种合成饮料的制作

合成饮料是一种由水、糖、香精和食用色素调配而成的饮品。它的核心特点是
成本低、保质期长、口味多样。

## 主要成分

- 水：占总体积约 80%
- 糖：提供甜味，约 10%
- 香精：决定口味，约 5%
- 色素：影响外观，约 5%

## 制作步骤

1. 取过滤水
2. 按比例加入糖
3. 加入香精与色素
4. 搅拌均匀后冷藏
```

**验证点**：
- artifact `points` 数量 ∈ [3, 5]
- 每条 rubric 维度均有 attribution（即使 pass 也要 thinking）
- LLM thinking 提到"成分 / 步骤" 任一关键词

---

#### TC-02 · `cases/02_short.md`

**意图**：极短输入。信息密度极低，测试框架对"输出不足 N 个要点"的容忍度。

**内容骨架**：

```markdown
今天下雨。我没出门。看了一本书。
```

**验证点**：
- schema 允许 `len(points) ≥ 1`，不强制 5
- 不抛 schema error；framework 不挂
- judge 给"coverage"维度评 fail 时 attribution 必须指向 anchor "信息密度不足"

---

#### TC-03 · `cases/03_long.md`

**意图**：长文本压力。≥ 3000 字（建议 4000–5000 字技术说明文，结构性强）。验证模板渲染 / token 边界 / 要点收敛。

**内容骨架**（仅示意，完整版在 fixtures）：

```markdown
# 一种合成系统的概述

（第 1 节～第 8 节，每节 500 字左右，议论性 + 列表 + 表格混排）

## 1. 系统组成
## 2. 工作流程
...
## 8. 已知风险
```

**验证点**：
- 不超 token 限制（OpenAI 兼容端点 context window 内）
- 输出 `points` 仍 ≤ 5（验证收敛）
- Decision Trace 的 `rendered_prompt_diff` 不为空且能 parse

---

#### TC-04 · `cases/04_with_code.md`

**意图**：测试 parser 对代码块的处理。框架不应把代码当文本拆开混进要点。

**内容骨架**：

```markdown
# 一个合成的脚本说明

这个脚本读取输入并打印问候语：

​```python
def greet(name: str) -> str:
    return f"Hello, {name}!"
​```

主要用途：

- 测试问候模板
- 演示函数定义
- 配合 `inline code` 使用

​```bash
$ python greet.py
​```
```

**验证点**：
- 要点中不出现 `def greet(name: str)` 这种代码片段当作要点
- artifact 字段类型仍是字符串（不被代码 fenced block 混淆为对象）

---

#### TC-05 · `cases/05_unicode.md`

**意图**：编码 + token 边界 stress。

**内容骨架**：

```markdown
# 关于 π 与 ∑ 的随笔 ✨

数学常数 π ≈ 3.14159，符号 ∑ 表示求和。

中英 mixed: this is a 测试 case for tokenizer 边界 conditions.

😀 表情符号：🎉 庆祝、⚠️ 警告、❌ 错误。

全角标点：你好，世界！这是中文句号。
```

**验证点**：
- 不抛 UnicodeEncodeError / 序列化错误
- artifact 字段保留原字符（不被错误转义为 `\u...`）
- LLM thinking 摘要内文字编码正常

---

#### TC-NEG-* · 运行时构造的负例

不放静态文件，**由测试代码动态构造**：

| Case | 构造方式 |
|---|---|
| TC-NEG-01 | 复制 `materials/toy/v1.0/prompts/extract.md` 去掉头部 version 字段 → 启动 → 期望报错 |
| TC-NEG-02 | mock judge LLM 返回缺 `attribution` 的 JSON → 期望该次 ToyNode 执行直接判失败 |
| TC-NEG-03 | mock generator LLM 返回缺 `points` 的 JSON → 期望 tenacity retry 2 次后入失败队列，其他 case 继续 |
