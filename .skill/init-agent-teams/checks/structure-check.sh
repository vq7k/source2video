#!/usr/bin/env bash
# init-agent-teams check 模式 B1：结构完整性硬校验
# 用法：bash structure-check.sh <目标项目根>
set -uo pipefail
ROOT="${1:?用法: structure-check.sh <目标项目根>}"
cd "$ROOT" || { echo "FAIL: 无法进入 $ROOT"; exit 2; }

fail=0
chk() { # chk <描述> <test 命令...>
  if eval "${@:2}" >/dev/null 2>&1; then echo "PASS: $1"; else echo "FAIL: $1"; fail=1; fi
}

echo "== B2-1 结构完整性 =="
chk ".agent/SOUL.md 存在"   "test -f .agent/SOUL.md"
chk ".agent/STATUS.md 存在" "test -f .agent/STATUS.md"
chk ".agent/TODO.md 存在"   "test -f .agent/TODO.md"
chk "PROJECT.md 存在"       "test -f PROJECT.md"
chk "CLAUDE.md 存在"        "test -f CLAUDE.md"
chk "AGENTS.md 存在"        "test -f AGENTS.md"
chk ".skill/catch-up 存在"  "test -f .skill/catch-up/SKILL.md"
chk ".skill/status-update 存在" "test -f .skill/status-update/SKILL.md"
chk "CLAUDE.md → PROJECT.md 互指" "grep -q 'PROJECT.md' CLAUDE.md"
chk "PROJECT.md → SOUL/catch-up 互指" "grep -qE 'SOUL.md|catch-up' PROJECT.md"

echo "== B2-1 SOUL 四段齐 =="
chk "SOUL 含『我是谁』" "grep -q '## 我是谁' .agent/SOUL.md"
chk "SOUL 含『我不做』" "grep -q '## 我不做' .agent/SOUL.md"
chk "SOUL 含『我做』"   "grep -q '## 我做' .agent/SOUL.md"
chk "SOUL 含『我的边界』" "grep -q '## 我的边界' .agent/SOUL.md"

echo "== B2-2 STATUS 结构（不强求固定段名，宿主既有命名优先） =="
total=$(grep -cE '^## ' .agent/STATUS.md 2>/dev/null || echo 0)
chk "STATUS 分段 ≥4（实得 ${total}）" "test \"$total\" -ge 4"
chk "STATUS 含 catch-up readiness 锚点段" "grep -qiE '^## .*(actionable|当前|下一步|next|current|现在|now|todo)' .agent/STATUS.md"

echo "== B2-3 工作区独立性（每角色 SOUL = <工作区>/.agent[s]/SOUL.md，不嵌套/不耦合根） =="
nested=$(find . \( -path '*/node_modules' -o -path './.git' \) -prune -o -name SOUL.md -print 2>/dev/null | while IFS= read -r s; do
  p=$(basename "$(dirname "$s")")
  if [ "$p" != ".agent" ] && [ "$p" != ".agents" ]; then echo "$s"; fi
done)
if [ -z "$nested" ]; then
  echo "PASS: 所有 SOUL.md 直接位于某 .agent[s]/ 工作区下（无嵌套耦合）"
else
  echo "FAIL: 下列 SOUL.md 嵌在 .agent[s]/ 子目录里 = 工作区耦合（子 Agent 无法独立进入工作区）："
  echo "$nested" | sed 's/^/    /'
  fail=1
fi

echo "== B2-4 Worker 工作区入口齐备（非根 worker 应有本地 CLAUDE.md + AGENTS.md；WARN，不计 FAIL） =="
miss_entry=$(find . \( -path '*/node_modules' -o -path '*/.git' -o -path '*/.venv' -o -path '*/.claude' -o -path '*/.next' -o -path '*/worktrees' -o -path '*/dist' -o -path '*/build' \) -prune -o -name SOUL.md -print 2>/dev/null | while IFS= read -r s; do
  d=$(dirname "$s"); p=$(basename "$d"); ws=$(dirname "$d")
  { [ "$p" != ".agent" ] && [ "$p" != ".agents" ]; } && continue
  [ "$ws" = "." ] && continue
  m=""; [ -f "$ws/CLAUDE.md" ] || m="$m CLAUDE.md"; [ -f "$ws/AGENTS.md" ] || m="$m AGENTS.md"
  [ -n "$m" ] && echo "$ws 缺:$m"
done)
if [ -z "$miss_entry" ]; then
  echo "PASS: 所有 worker 工作区入口齐备（或仅根角色）"
else
  echo "WARN: 下列 worker 工作区缺本地入口（进去 catch-up『cat CLAUDE.md』落空 / 非 Claude runtime 无 AGENTS.md 引导）："
  echo "$miss_entry" | sed 's/^/    /'
fi

echo "== B2-5 引用一致性（改名后旧状态路径残留；WARN，不计 FAIL） =="
if [ -d .agent ]; then otherp='\.agents'; else otherp='\.agent'; fi
stale=$(grep -rlnE "${otherp}([^a-zA-Z0-9]|$)" . 2>/dev/null | grep -vE 'node_modules|/\.git/|/\.venv|/\.claude|/\.next|/\.idea|/worktrees/|site-packages|dist-info|/sessions/|retired-workers|/\.skill/init-agent-teams/' || true)
if [ -z "$stale" ]; then
  echo "PASS: 无明显旧状态路径残留"
else
  echo "WARN: 下列活跃文件引用了非主范式状态路径（疑改名后断链，human 核对）："
  echo "$stale" | sed 's/^/    /'
fi

echo "----"
if [ "$fail" -eq 0 ]; then echo "✅ structure-check 全 PASS"; else echo "❌ structure-check 有 FAIL（见上，按 SKILL.md B3 出待修复动作）"; fi
exit "$fail"
