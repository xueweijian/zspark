# 对话区域对标 cc-haha 升级方案

## Context

zspark 桌面应用的对话区域（中间聊天面板）在功能和体验上与 cc-haha（Claude Code 桌面端）有较大差距。当前实现是一个约 5000 行的单体 App.tsx，缺少语法高亮、Diff 视图、思考块、虚拟滚动等关键特性。本方案目标是在保持 codex-rs 后端不变的前提下，尽可能复制 cc-haha 的对话区域体验。

## 功能差距总览

### 已有功能（zspark 已具备）
- Markdown 渲染（marked + DOMPurify）
- 图片粘贴 + 文件附件
- Slash 命令自动补全
- Token 用量圆形指示器
- 发送/停止二合一按钮
- 审批卡片（Approve/Approve All/Deny）
- Activity 折叠卡片（命令输出、文件变更等）
- 自动滚动 + 跳转到最新

### 缺失功能分类

#### A. 可直接抄（纯前端，后端无关）
| 功能 | 说明 |
|------|------|
| 语法高亮代码块 | prism-react-renderer，只需代码字符串+语言 |
| Mermaid 图表渲染 | mermaid 包，纯前端 SVG 渲染 |
| KaTeX 数学公式 | katex 包，同步渲染 |
| DiffViewer 组件 | react-diff-viewer-continued，接收新旧字符串 |
| CodeViewer（行号+折叠+复制按钮） | 纯展示组件 |
| ErrorBoundary | React 标准模式 |
| 虚拟滚动 | 自定义算法，无库依赖 |
| React.memo + 流式节流 | 性能优化模式 |
| 草稿持久化 | localStorage/electron-store |
| IME 输入法处理 | 前端事件处理 |

#### B. 需要适配（前端功能，需适配 codex-rs 事件模型）
| 功能 | 适配说明 |
|------|---------|
| ThinkingBlock | zspark 已有 `item/reasoning/textDelta`，需从 ActivityRow 独立出来 |
| StreamingIndicator | 需从活动状态推导动词（Thinking/Running/Working） |
| ToolCallBlock（工具特定渲染） | 映射 Activity.kind → 工具类型，Bash=terminal, file=Edit/Write |
| ToolCallGroup | 活动已有序，需分组逻辑 |
| DiffViewer for Bash 审批 | 审批事件已带 commandPreview |
| Context Compaction UI | 已有 `thread/compacted` 事件，需改为分割卡片 |
| @ 文件提及 | 需新增 IPC 方法扫描目录 |
| Slash 命令模糊匹配 | 前端逻辑，数据源已有 |
| 选择文本添加到对话 | 纯 DOM selection API |

#### C. 被阻塞（需要 codex-rs 后端改动）
| 功能 | 阻塞原因 |
|------|---------|
| 消息分支/Fork | 需要 codex-rs 会话 fork API |
| 回退/Undo per Turn | 需要 codex-rs checkpoint API |
| AskUserQuestion | 需要 codex-rs 结构化问答事件 |
| Agent 任务时间线 | 需要 codex-rs agent task 事件 |
| Goal/Memory 事件卡片 | 需要 codex-rs 相应事件 |
| Computer Use 权限 | codex-rs 不支持 computer use |

## 实施计划

### Phase 0: 基础架构拆分
**目标**: 拆分单体 App.tsx，建立组件化架构

- 从 App.tsx 抽取 `Markdown` 组件 → `components/markdown/MarkdownRenderer.tsx`
- 从 App.tsx 抽取消息列表渲染逻辑 → `components/chat/MessageList.tsx`
- 创建 Zustand store 持有 Block[]、streaming state 等当前 useState 管理的状态
- 添加 npm 依赖: `zustand`, `prism-react-renderer`, `mermaid`, `katex`, `lucide-react`, `react-diff-viewer-continued`
- 创建组件目录结构: `components/chat/`, `components/markdown/`, `components/shared/`
- 创建 ErrorBoundary

**关键文件**:
- 修改: `desktop/src/renderer/App.tsx`
- 新建: `desktop/src/renderer/stores/chatStore.ts`
- 新建: `desktop/src/renderer/components/markdown/MarkdownRenderer.tsx`
- 新建: `desktop/src/renderer/components/chat/MessageList.tsx`
- 新建: `desktop/src/renderer/components/ErrorBoundary.tsx`
- 修改: `desktop/package.json`

**注意**: Store 应沿用 zspark 现有的 Block 模型（appTypes.ts），不要引入 cc-haha 的 UIMessage 模型。只做容器迁移，不改数据结构。

### Phase 1: 富 Markdown 渲染（最高视觉冲击）
**目标**: 彻底改变 AI 消息的展示效果

- 增强 MarkdownRenderer：拦截 marked 的 `renderer.code()`，用占位符替换代码块，再替换为 React 组件
- 实现语法高亮代码块（prism-react-renderer）
- 添加代码块复制按钮、行号、折叠（默认显示 20 行）
- 添加 Mermaid 图表渲染（mermaid 包）
- 添加 KaTeX 数学公式渲染
- 代码块语言别名映射（复制 cc-haha 的 normalizeCodeLanguage）

**可从 cc-haha 直接复制的文件**:
- `components/chat/CodeViewer.tsx` — 几乎直接复制，仅替换主题获取方式
- `components/chat/MermaidRenderer.tsx` — 几乎直接复制
- `components/shared/CopyButton.tsx` — 直接复制
- `components/markdown/MarkdownRenderer.tsx` — 核心解析逻辑可复制，需适配主题

### Phase 2: ThinkingBlock + StreamingIndicator（高视觉冲击）
**目标**: 让用户清晰看到 AI 在做什么

- 创建 ThinkingBlock 组件：可折叠、动画光标/点、compact markdown 内容
- 将 `item/reasoning/textDelta` 事件路由到 ThinkingBlock（而非 ActivityRow）
- 创建 StreamingIndicator 药丸：状态动词 + 经过时间 + 输出 token 数
- 状态动词推导：有运行中的命令→"Running"，有推理→"Thinking"，默认→"Working"
- 经过时间 = `Date.now() - currentTurn.startedAt`

**需适配的 cc-haha 文件**:
- `components/chat/ThinkingBlock.tsx` — UI 结构可复制，数据源从 UIMessage 改为 Activity
- `components/chat/StreamingIndicator.tsx` — 布局复制，statusVerb 改为从活动状态推导

### Phase 3: Tool Call 展示重构（高视觉冲击）
**目标**: 从通用 ActivityRow 升级为工具特定的富卡片

- 创建 ToolCallBlock：工具图标 + 名称 + 文件路径摘要 + 展开/折叠
- Bash 工具 → TerminalChrome 样式（$ 前缀 + 终端风格）
- Edit/Write 工具 → DiffViewer 展示新旧内容
- Read 工具 → 简要摘要 + 代码查看器
- 创建 ToolCallGroup：连续同类工具调用分组（如 "Read 3 files"）
- 扩展 Activity 类型添加 `metadata` 字段存储工具特定数据

**可复制的 cc-haha 文件**:
- `components/chat/DiffViewer.tsx` — 几乎直接复制
- `components/chat/TerminalChrome.tsx` — 直接复制
- `components/chat/ToolCallBlock.tsx` — 渲染逻辑可复用，数据映射需改写
- `components/chat/ToolCallGroup.tsx` — 分组逻辑可复用

**关键映射**: `kind='command'` → Bash, `kind='file'` → Edit/Write/Read, `kind='tool'` → 通用, `kind='web'` → WebSearch

### Phase 4: 输入区增强（中等视觉冲击）
**目标**: 提升输入体验

- 从 App.tsx 抽取 ChatInput 为独立组件
- 添加拖拽文件支持（ComposerDropOverlay）
- Slash 命令增强：模糊匹配（复制 cc-haha 的 filterSlashCommands）
- @ 文件提及：输入 @ 触发文件搜索菜单
- 草稿持久化：按 session 保存/恢复输入内容
- IME 输入法处理：compositionStart/End 事件

**可复制的 cc-haha 文件**:
- `components/chat/ComposerDropOverlay.tsx` — 适配文件处理为 IPC
- `components/chat/FileSearchMenu.tsx` — 需新增 IPC 获取文件列表
- `components/chat/composerUtils.ts` — 模糊匹配逻辑直接复制

### Phase 5: 虚拟滚动 + 性能优化（基础设施）
**目标**: 支持长对话不卡顿

- 实现自定义虚拟滚动（120+ 条消息或 120000+ 字符触发）
- ResizeObserver 测量实际高度，LRU 缓存（最多 16 个会话）
- 所有消息组件 React.memo 包装
- 流式更新 50ms 节流
- 切换会话时恢复滚动位置

**可复制的 cc-haha 文件**:
- `components/chat/virtualHeightCache.ts` — 直接复制
- `components/chat/MessageList.tsx` — 虚拟化算法可复制，渲染逻辑需映射到 Block 模型

### Phase 6: 审批对话框增强
- 增强审批卡片：工具特定图标 + 颜色
- Edit/Write 审批展示 DiffViewer 预览
- Bash 审批展示终端预览
- 可复用 Phase 3 的 DiffViewer

### Phase 7: 收尾打磨
- Context Compaction 分割卡片
- 用户消息 AttachmentGallery
- 工具输出中的 InlineImageGallery
- 选择文本添加到对话
- ContextUsageIndicator 增强（hover 显示 token 分类）

## 依赖关系

```
Phase 0 (基础架构)
  ├──→ Phase 1 (富 Markdown)  ──→ Phase 3 (Tool Call) ──→ Phase 6 (审批增强)
  ├──→ Phase 2 (Thinking+Streaming)                        ──→ Phase 7 (打磨)
  ├──→ Phase 4 (输入区增强)
  └──→ Phase 5 (虚拟滚动)
```

Phase 1/2/4 可在 Phase 0 后并行推进。Phase 3 依赖 Phase 1 的 DiffViewer。

## 关键源文件索引

| 用途 | zspark 文件 | cc-haha 参考文件 |
|------|------------|-----------------|
| 主组件 | `desktop/src/renderer/App.tsx` | `cc-haha-main/desktop/src/components/chat/MessageList.tsx` |
| 类型定义 | `desktop/src/renderer/appTypes.ts` | `cc-haha-main/desktop/src/types/chat.ts` |
| Markdown | 需新建 `components/markdown/` | `cc-haha-main/desktop/src/components/markdown/MarkdownRenderer.tsx` |
| 活动行 | `desktop/src/renderer/ActivityRow.tsx` | `cc-haha-main/desktop/src/components/chat/ToolCallBlock.tsx` |
| 状态管理 | 需新建 stores/ | `cc-haha-main/desktop/src/stores/chatStore.ts` |
| IPC | `desktop/src/preload/index.ts` | N/A (不同架构) |

## 验证方案

每个 Phase 完成后：
1. `cd desktop && pnpm run typecheck` — 类型检查通过
2. `pnpm run dev` — 启动开发服务器
3. 实际对话测试：发送消息、触发工具调用、检查 Markdown 渲染效果
4. 长对话测试：连续对话 20+ 轮，检查滚动和性能
5. `pnpm test` — 单元测试通过（如有新增测试）
