# 对话区域对标 cc-haha 升级计划（Phase 0~3）

## Context

zspark 桌面应用的对话区域是一个约 5000 行的单体 `App.tsx`，缺少语法高亮、Diff 视图、思考块等关键特性。目标是在保持 codex-rs 后端不变的前提下，参考 cc-haha 的组件设计升级对话区域体验。本次实施 Phase 0（架构拆分）+ Phase 1（富 Markdown）+ Phase 2（ThinkingBlock + StreamingIndicator）+ Phase 3（Tool Call 重构）。同时引入 Tailwind CSS 用于新组件。

## Task 1: 基础架构搭建（Phase 0.1）

1. 安装依赖：`zustand`、`tailwindcss`、`@tailwindcss/vite`、`prism-react-renderer`、`mermaid`、`katex`、`lucide-react`、`react-diff-viewer-continued`
2. 配置 Tailwind（`@tailwindcss/vite` 插件 + CSS 入口）
3. 创建目录结构：`components/`、`store/`

**关键文件**: `desktop/package.json`, `desktop/electron.vite.config.ts`, `desktop/src/renderer/styles.css`

## Task 2: 创建 ErrorBoundary（Phase 0.2）

参考 cc-haha 创建 `components/ErrorBoundary.tsx`，在 `main.tsx` 中包裹 `<App />`。

**新建**: `desktop/src/renderer/components/ErrorBoundary.tsx`

## Task 3: 提取内联组件（Phase 0.3）

从 App.tsx 中提取以下内联组件为独立文件（不改逻辑，纯文件移动）：

| 组件 | App.tsx 位置 | 目标文件 |
|------|-------------|---------|
| `Markdown` | 行 289-315 | `components/Markdown.tsx` |
| `MessageActions` | 行 420-461 | `components/MessageActions.tsx` |
| `MemoryCitationPill` | 行 464-473 | `components/MemoryCitationPill.tsx` |
| `ApprovalCard` | 行 600-860 | 已是独立组件，保持 |
| `ActivityDuration` | 行 268-276 | `components/ActivityDuration.tsx` |

**新建**: `desktop/src/renderer/components/Markdown.tsx`, `MessageActions.tsx`, `MemoryCitationPill.tsx`, `ActivityDuration.tsx`
**修改**: `desktop/src/renderer/App.tsx`（删除内联定义，改为 import）

## Task 4: 提取 MessageList + 子组件（Phase 0.4，最关键）

将 `blocks.map(...)` 渲染逻辑（行 4210-4334）拆分为独立组件树：

```
MessageList.tsx          -- blocks 遍历 + 空状态
  ├── UserBubble.tsx     -- 用户消息
  ├── AgentBubble.tsx    -- 代理回复（含 streaming + Markdown）
  ├── TurnCard.tsx       -- turn block 卡片（含 ActivityRow）
  ├── FilesCard.tsx      -- 文件变更卡片
  ├── EmptyState.tsx     -- 空状态页
  └── JumpToLatest.tsx   -- 跳转到底部按钮
```

Props 驱动，不直接访问 store。`streamRef` 通过 forwardRef 传入。

## Task 5: 创建 Zustand Store + 迁移状态（Phase 0.5）

### 5.1 chatStore.ts
- 核心状态：`blocks`, `streaming`, `submitting`, `messageActionBusy`
- 操作：`upsertTurnBlock`, `upsertUserBlock`, `updateTurn`, `ensureActivity`, `appendActivityDetail`, `appendAgentText`, `toggleTurn`, `resetLiveTurnState`
- 模块级变量（非 React state）：`currentTurn`, `agentForTurn`, `itemActivity`, `approvalRequests`

### 5.2 composerStore.ts
- 状态：`input`, `attachments`, `selectedSkills`, `suggestionType/Query/Index`, `loadedPreviews`, `zoomedImage`

### 5.3 uiStore.ts
- 状态：`panel`, `showSettings`, `toasts`, `showPermissionMenu`, `showJumpToLatest`, `rightActiveTab`, `rightWidth`

### 5.4 runtimeStore.ts
- 状态：`thread`, `ready`, `runtime`, `tokenUsage`, `permissionLevel`, `threads`

**注意**: handle() 函数（500+ 行事件处理）保持原位，通过调用 store actions 更新状态。

## Task 6: 提取 ChatInput（Phase 0.6）

抽取输入区为独立 `components/ChatInput.tsx`：textarea、附件预览、slash 命令菜单、技能建议、发送/停止按钮。`taRef` 移入内部管理。

## Task 7: 提取剩余 UI 组件 + 迁移状态（Phase 0.7~0.8）

提取 `StatusCapsules.tsx`、`Toasts.tsx`、`ImageZoomOverlay.tsx`。将 UI/runtime 状态迁移至对应 store。

**Phase 0 完成标准**: App.tsx < 1500 行，`pnpm typecheck` 通过，所有对话功能正常。

## Task 8: 富 Markdown 渲染（Phase 1）

### 8.1 MarkdownRenderer 核心
参考 cc-haha 的 `MarkdownRenderer.tsx`（567 行），实现：
- marked 的 `renderer.code()` 拦截，占位符替换为 React 组件
- KaTeX 数学公式提取和渲染（`$...$` 和 `$$...$$`）
- 缓存层（finalized + streaming 两个 LRU）
- 链接安全处理

### 8.2 CodeViewer
从 cc-haha 适配 `CodeViewer.tsx`：
- prism-react-renderer 语法高亮
- 行号、复制按钮、折叠（默认 20 行）
- 语言标签头

### 8.3 MermaidRenderer
从 cc-haha 适配 Mermaid 图表渲染：
- 检测 mermaid 语言或内容模式
- 流式时显示占位符

### 8.4 CopyButton
创建 `components/shared/CopyButton.tsx`

**新建**: `components/markdown/MarkdownRenderer.tsx`, `components/chat/CodeViewer.tsx`, `components/chat/MermaidRenderer.tsx`, `components/shared/CopyButton.tsx`
**修改**: `components/Markdown.tsx`（替换为使用 MarkdownRenderer）

## Task 9: ThinkingBlock + StreamingIndicator（Phase 2）

### 9.1 ThinkingBlock
- 从 cc-haha 适配 `ThinkingBlock.tsx`（88 行）
- 可折叠、动画光标、compact markdown 渲染
- 在 `TurnCard.tsx` 中将 `kind='reasoning'` 的 Activity 路由到 ThinkingBlock（而非 ActivityRow）

### 9.2 StreamingIndicator
- 从 cc-haha 适配 `StreamingIndicator.tsx`（117 行）
- 状态动词推导：有命令→Running，有推理→Thinking，默认→Working
- 经过时间 = Date.now() - turn.startedAt
- 在 MessageList 的流式消息末尾显示

**新建**: `components/chat/ThinkingBlock.tsx`, `components/chat/StreamingIndicator.tsx`
**修改**: `components/chat/TurnCard.tsx`, `components/chat/MessageList.tsx`

## Task 10: Tool Call 展示重构（Phase 3）

### 背景
当前 `ActivityRow.tsx`（148行）以单行折叠方式展示所有 activity，terminal 风格已内联在 `renderTerminal()` 中。目标是将 command/file/tool/web 四种 activity 分别用专用富卡片渲染，参考 cc-haha 的设计。

### 当前架构
- `TurnCard.tsx` 遍历 `displayActivities(block.activities)`，对 `kind='reasoning'` 路由到 ThinkingBlock，其余路由到 `ActivityRow`
- `ActivityRow` 包含 `renderTerminal()`（内置终端渲染）、折叠逻辑、图标分发
- 已有 `.act-terminal` CSS 类（`styles.css` 行 713-834）
- 已有 `CodeViewer.tsx`（prism-react-renderer 高亮 + 折叠）、`CopyButton.tsx`
- 依赖已安装：`react-diff-viewer-continued@^4.2.2`

### 10.1 TerminalChrome.tsx（新建）
macOS 终端风格装饰外壳。纯展示组件，~40行。

```typescript
type Props = {
  title?: string           // 顶部标题（默认 "Terminal"）
  children: React.ReactNode // 终端内容
  status?: 'running' | 'done' | 'failed'
}
```

实现：
- macOS 三色圆点（红/黄/绿）标题栏
- 内容区使用 `var(--font-mono)` 字体
- 状态指示器（running 时显示脉冲动画）
- 复用现有 `.act-terminal-*` CSS 类名（而非新建样式），或使用 Tailwind 类

### 10.2 DiffViewer.tsx（新建）
文件变更 diff 视图。~120行。

```typescript
type Props = {
  oldCode?: string
  newCode?: string
  language?: string
  fileName?: string
  splitView?: boolean     // 默认 false（unified 模式）
}
```

实现：
- 使用 `react-diff-viewer-continued`（已安装）
- 暗色主题配置（匹配现有代码高亮色调）
- 顶部文件名标签（复用 CodeViewer 的 header 样式）
- 如果无 oldCode（新建文件），使用 CodeViewer 展示 newCode
- 如果无 newCode（删除文件），使用 CodeViewer 展示 oldCode + 删除标记

### 10.3 ToolCallBlock.tsx（新建）
根据 activity.kind 路由到不同的富卡片渲染。~100行。

```typescript
type Props = {
  activity: Activity & { displayTitle: string; repeatCount: number }
  isPlaceholder: boolean
}
```

路由逻辑：
- `kind='command'` → 使用 TerminalChrome 包裹命令/输出
  - 解析 `detail`：第一行为命令（$ 前缀），其余为输出
  - 复用 ActivityRow 中已有的 `parseTerminalContent()` 逻辑
  - 使用 `fmtDuration` 显示耗时
- `kind='file'` → 使用 DiffViewer 或 CodeViewer
  - detail 格式：`"Created path/to/file\nModified other/file"`
  - 如果 detail 含换行，解析每行变更并用简洁列表展示
  - `repeatCount > 1` 时显示聚合摘要
- `kind='web'` → 搜索摘要卡片
  - 显示搜索词 + 图标
  - detail 作为搜索结果摘要
- `kind='tool'` → 通用工具卡片
  - 显示工具名 + 状态 + detail
- `kind='memory'` → 保持现有 ActivityRow 行为（detail 直接展示）
- 其他 → 回退到 ActivityRow

所有卡片都支持：
- 可折叠（有 detail 时）
- `repeatCount > 1` 时显示 xN 标记
- 状态显示（running · · · / failed / 耗时）

### 10.4 更新 TurnCard.tsx
在 TurnCard 的 `visibleActivities.map()` 中，将非 reasoning 的 activity 从 `ActivityRow` 路由到 `ToolCallBlock`：

```tsx
// 之前：
return <ActivityRow key={a.id} activity={a} isPlaceholder={isPlaceholder} />
// 之后：
return <ToolCallBlock key={a.id} activity={a} isPlaceholder={isPlaceholder} />
```

### 10.5 TypeCheck 验证
运行 `cd desktop && npx tsc --noEmit` 确保无类型错误。

**新建**: `components/chat/TerminalChrome.tsx`, `components/chat/DiffViewer.tsx`, `components/chat/ToolCallBlock.tsx`
**修改**: `components/chat/TurnCard.tsx`（替换 ActivityRow 为 ToolCallBlock）

## 验证方案

每个 Task 完成后：
1. `cd desktop && pnpm run typecheck` — 类型检查通过
2. `pnpm run dev` — 启动开发服务器
3. 功能测试：发送消息、触发工具调用、检查渲染效果
4. Phase 3 完成后：长对话测试（20+ 轮），检查滚动和性能

---

## 完成情况总结

### ✅ 全部完成（Phase 0~7）

**Phase 0: 基础架构拆分（Tasks 1-7）**
- 依赖安装（zustand, tailwind, prism-react-renderer, mermaid, katex, react-diff-viewer-continued 等）
- Tailwind CSS 配置
- ErrorBoundary 组件
- 5 个 Zustand Store（chatStore, composerStore, uiStore, runtimeStore, index）
- 内联组件提取：Markdown, MessageActions, MemoryCitationPill, ActivityDuration, Toasts, ImageZoomOverlay
- 消息列表组件树：MessageList, UserBubble, AgentBubble, TurnCard, FilesCard, EmptyState
- ChatInput 独立组件

**Phase 1: 富 Markdown 渲染（Task 8）**
- MarkdownRenderer（marked + DOMPurify + KaTeX + code block placeholder）
- CodeViewer（prism-react-renderer 语法高亮 + 行号 + 折叠 + 复制）
- MermaidRenderer
- CopyButton

**Phase 2: ThinkingBlock + StreamingIndicator（Task 9）**
- ThinkingBlock（可折叠 + 动画光标 + compact markdown）
- StreamingIndicator（状态动词 + 经过时间）
- TurnCard 路由：reasoning → ThinkingBlock
- MessageList 流式末尾显示 StreamingIndicator

**Phase 3: Tool Call 展示重构（Task 10）**
- TerminalChrome（macOS 三色圆点终端风格外壳）
- DiffViewer（react-diff-viewer-continued + 暗色主题）
- ToolCallBlock（command/file/tool/web 四种富卡片路由）
- TurnCard 路由：非 reasoning → ToolCallBlock

**Phase 4: 输入区增强**
- ComposerDropOverlay（拖拽文件到输入区上传）
- Slash 命令模糊匹配（fuzzyMatch 工具函数）
- 草稿持久化（per-thread localStorage + 7天自动清理）
- IME 输入法处理（compositionStart/End）

**Phase 5: 虚拟滚动 + 性能优化**
- React.memo 包装（UserBubble, AgentBubble, TurnCard, FilesCard）
- 流式更新 50ms 节流（throttle 工具函数）
- 虚拟滚动（VirtualList + VirtualHeightCache LRU）

**Phase 6: 审批对话框增强**
- 审批卡片工具图标（command/file/permissions/tool）
- 命令预览（TerminalChrome）
- 文件变更预览（DiffViewer）

**Phase 7: 收尾打磨**
- ContextCompactionDivider（上下文压缩分割卡片）
- AttachmentGallery（用户消息附件网格预览）
- InlineImageGallery（工具输出内联图片展示）

---

### ❌ 未完成功能

#### B 类未完成功能（需适配）
| 功能 | 说明 | 当前状态 |
|------|------|----------|
| @ 文件提及 | 需新增 IPC 扫描目录 | 未实现 |
| 选择文本添加到对话 | 纯 DOM selection API | 未实现 |
| ContextUsageIndicator 增强 | hover 显示 token 分类详情 | 未实现 |
| 滚动位置恢复 | 切换会话时恢复滚动位置 | 未实现 |

#### C 类被阻塞功能（需 codex-rs 后端改动）
| 功能 | 阻塞原因 |
|------|----------|
| 消息分支/Fork | 需要 codex-rs 会话 fork API |
| 回退/Undo per Turn | 需要 codex-rs checkpoint API |
| AskUserQuestion | 需要 codex-rs 结构化问答事件 |
| Agent 任务时间线 | 需要 codex-rs agent task 事件 |
| Goal/Memory 事件卡片 | 需要 codex-rs 相应事件 |
| Computer Use 权限 | codex-rs 不支持 computer use |