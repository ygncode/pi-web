# pi-web 开发 Handoff

> 仓库: `D:/Workstation/pi-web` (fork from `NOirBRight/pi-web`, branch `fix/ask-question-multi-select`)
> 上游: `ygncode/pi-web` (remote `upstream`)

## 当前状态

- ✅ fork 完成，remote `origin` = `NOirBRight/pi-web`
- ✅ upstream 添加完成，remote `upstream` = `ygncode/pi-web`
- ✅ npm install 完成（`--ignore-scripts` 跳过安装脚本）
- ✅ 前端测试大部分通过（242/246，4 个预存在的 storage 测试失败）
- ✅ feature branch `fix/ask-question-multi-select` 已创建

## 待开发问题

### 问题 1: AskQuestion 多选 Bug

**优先级**: 🔴 高  
**类型**: Bug 修复  
**目标 PR 分支**: `fix/ask-question-multi-select`（已创建）

#### 根因

`chat-composer-runner.js` 第 496 行：

```js
if (questionCount === 1) {
  // 单问题：点击立即发送 — 忽略了 q.multiple
  sendChatMessage(...)
}
```

`session-entry-renderer.js` 第 137 行：

```js
const isMulti = questions.length > 1;  // 只看 question 数量，不看 q.multiple
```

pi 的 AskUserQuestion 工具支持单个 question 内 `multiSelect: true`，但 pi-web：
- 单 question 时点击即发送（不管 `multiple`）
- 不渲染多选 toggle 行为

#### 修改文件清单

1. **`web/src/session/render/session-entry-renderer.js`** — 渲染层
   - `isMulti` 判断加 `q.multiple` 条件
   - 给 `ask-question-block` 加 `data-multiple` 属性
   - 多选选项用 `toggle` 样式（点已有 selected 的取消），单选用 `exclusive` 样式
   - 多选选项显示 checkbox 样式标记

2. **`web/src/session/live/live-renderer.js`** — live 渲染层（同样逻辑）
   - 同上的改动

3. **`web/src/session/chat/chat-composer-runner.js`** — 交互层
   - `questionCount === 1` 分支增加 `qMultiple` 检查
   - `qMultiple` 时改为 toggle selected + 显示 Submit 按钮
   - Submit 按钮对多选答案用逗号拼接格式

4. **`internal/ui/live_templates/session.css`** — 样式
   - 可能需要新增 `.ask-question-option.multiselect` 样式（虚线边框、多选光标）

5. **测试文件** (对应每个改动):
   - `web/src/session/render/session-entry-renderer.test.js`
   - `web/src/session/chat/chat-composer-runner.test.js`  
   - `web/src/session/live/live-renderer.test.js`

#### 实现细节

**渲染 (`session-entry-renderer.js`)**：

```js
// 第 137 行改为：
const isMulti = questions.length > 1 || questions.some(q => q.multiple);

// 第 164 行附近，给 block 加 data-multiple：
const qMultiple = q.multiple === true;
html += `<div class="ask-question-block" data-question-text="${escapeHtml(questionText)}" data-multiple="${qMultiple}">`;

// 第 170 行，给选项加 multiSelect class：
const multiSelectClass = qMultiple ? ' ask-question-multiselect' : '';
html += `<${tag} class="ask-question-option${selected ? ' selected' : ''}${actionClass}${multiSelectClass}"${dataAttrs}>`;
```

**交互 (`chat-composer-runner.js`)**：

```js
// 第 496 行附近，替换 single-question 立即发送逻辑：
const qMultiple = block.dataset.multiple === 'true';

if (questionCount === 1 && !qMultiple) {
  // 单问题单选：点击立即发送
  const question = option.dataset.question;
  const answer = option.dataset.answer;
  option.disabled = true;
  const sent = await sendChatMessage(`"${question}" = "${answer}"`, []);
  if (!sent) option.disabled = false;
  return;
}

// 多选或多问题：toggle selected + show submit
if (qMultiple) {
  option.classList.toggle('selected');
} else {
  block.querySelectorAll('.ask-question-option-action').forEach(b => b.classList.remove('selected'));
  option.classList.add('selected');
}
const actions = card?.querySelector('.ask-question-actions');
if (actions) actions.style.display = '';
```

**Submit 按钮 (`chat-composer-runner.js`)** — 收集多选答案：

```js
// 第 473 行附近的 submit 按钮逻辑：
card.querySelectorAll('.ask-question-block').forEach(block => {
  const questionText = block.dataset.questionText || '';
  const qMultiple = block.dataset.multiple === 'true';
  
  if (qMultiple) {
    const selectedOptions = block.querySelectorAll('.ask-question-option-action.selected');
    const answers = Array.from(selectedOptions).map(sel => sel.dataset.answer || '');
    if (answers.length > 0 && questionText) {
      parts.push(`"${questionText}" = "${answers.join(', ')}"`);
    }
  } else {
    const sel = block.querySelector('.ask-question-option-action.selected');
    if (sel && questionText) {
      parts.push(`"${questionText}" = "${sel.dataset.answer || ''}"`);
    }
  }
});
```

---

### 问题 3: `/` 命令列表

**优先级**: 🟡 低  
**类型**: 新功能  
**目标 PR 分支**: `feature/command-list`（待创建）

#### 概述

pi 终端的 `/` 命令列表在 pi-web 手机界面上没有对应功能。需要：
1. 后端新增 API 获取 pi 的注册命令列表
2. 前端新增 `/` 触发的命令面板

#### 修改文件清单

**后端（Go）：**

1. `internal/rpc/client.go` — 新增 `BuildListCommandsCommand`
2. `internal/rpc/worker.go` — 处理 `list_commands` 响应
3. `internal/server/server.go` — 在 Register 中加 `/api/commands` 端点
4. `internal/server/handlers.go` — 实现 `handleCommands` handler

**前端（JS）：**

1. `web/src/session/live/command-menu.js` — 新增命令面板 UI
2. `web/src/session/chat/chat-composer-runner.js` — 输入 `/` 触发命令面板

#### 依赖

需要 pi 核心的 `pi --mode rpc` 支持 `list_commands` 命令。当前 RPC 协议只支持：
- `prompt`, `switch_session`, `set_model`, `set_thinking_level`, `abort`, `get_state`

**方案 A**（推荐）：先在 pi-web 后端做一个**本地命令映射**，硬编码 pi 的内置命令列表 + 扫描已注册扩展的命令。无需修改 pi 核心。

**方案 B**（长期）：给 pi 核心 RPC 协议提 PR，新增 `list_commands` 命令。

方案 A 可以先做，后续再升级到方案 B。

#### 本地命令映射实现思路

```go
// internal/server/commands.go
var builtinCommands = []CommandInfo{
    {Name: "/compact", Description: "Compact conversation history"},
    {Name: "/clear", Description: "Clear conversation"},
    {Name: "/model", Description: "Switch model"},
    // ...
}
```

扫描 `~/.pi/agent/extensions/` 和 npm 扩展中的命令注册，通过静态分析或简单的协议查询获取。

---

## 问题 2 说明（非 bug）

问题 2（/refresh 不存在）不是 pi-web bug，是本地安装问题：
- Windows 上 `install.sh` 不支持 MINGW → 二进制未自动下载
- `.pi/extensions/` 目录缺少 `index.ts` → 已通过创建 `index.ts` 修复

这两个问题应该作为单独的 PR 提给上游：
1. `install.sh` Windows 支持
2. `index.ts` 缺失修复

但不属于当前开发分支。

---

## 分支规划

```
main (upstream/ygncode/pi-web)
  │
  ├── fix/ask-question-multi-select  ← 问题 1 (当前分支)
  │
  ├── fix/extensions-index-entry     ← 问题 2 (install.sh + index.ts)
  │
  └── feature/command-list          ← 问题 3
```

---

## 验证命令

```bash
cd /d/Workstation/pi-web

# 前端测试
cd web && npx vitest run

# 全量检查（需要 Go）
make check

# 构建前端
cd web && npm run build

# 提交前
git diff --stat
```

---

## 当前 Git 状态

```
分支: fix/ask-question-multi-select
最近提交: e955baa chore: npm install (dev dependencies)
与上游同步: git fetch upstream && git rebase upstream/main
```