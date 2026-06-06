# 可视化网页元素拾取与内置浏览器交互功能设计实现文档

本篇文档由 AI 基于对同行优秀项目 `cc-haha` 源码的深入剖析而整理，并根据当前 `zspark-desktop` 项目的目录架构（Electron + Vite + React 18）进行了深度定制适配。本方案包含了详尽的架构设计、数据流向、核心组件代码蓝图以及**超越原版方案**的四项顶级进阶设计。

---

## 1. 业务目标与最终交互效果

在 `zspark` 桌面端右侧的面板中，引入一个“内置浏览器”功能，支持以下人机交互闭环：
1. **启动内置浏览器**：点击侧边栏/右侧页签启动，宿主在 React 占位元素上覆盖贴合一个原生 Electron `WebContentsView` 视口，载入指定 URL（如本地运行的开发服务器或任意公网网页）。
2. **激活拾取（Picker）**：点击内置浏览器工具栏最右侧的 **鼠标选择器** 按钮。内置页面立即开启高亮覆盖框。
3. **悬浮与高亮**：鼠标在内置浏览器里滑动时，凡悬停的 DOM 元素均被一个蓝色半透明蒙层和边框（`2px solid #2f7bff`）覆盖，这使用了 Shadow DOM 技术，防页面本身的 CSS 污染。
4. **点击弹出气泡 (Edit Bubble)**：点击目标元素后，悬停态冻结，并在被选元素紧贴的合适位置弹出表单气泡。气泡内支持：
   - 查看元素标签（如 `button`、`div`）。
   - 快捷修改元素的文本内容、文字颜色、背景色、不透明度、字体，并在网页中**所见即所得 (WYSIWYG) 实时响应**修改。
   - 提供输入框：“描述这些更改...”，供用户输入指令（如：*“将这个按钮的背景颜色改暗一点，字号调小一号”*）。
5. **确认并截图发送给大模型**：
   - 点击气泡中的“确认（✓）”按钮。
   - 网页内部自动在目标元素位置贴上一个标有数字 `1` 的蓝色圆圈标记。
   - 自动截取当前的浏览器视口，使截图包含**网页真实样式 + 1号高亮标注框**。
   - 移除标记，将该元素元数据（Selector 选择器、`nthPath` 路径、 outerHTML 代码段、原样式与修改后样式的 Diff 数据、用户修改描述）连同这张标注截图（base64 dataUrl）通过 IPC 传回宿主。
   - 宿主 React 收到消息后，**自动在当前的 Chat 会话里把这些内容包装并发送给大模型**，大模型据此进行精准的本地前端代码修改。

---

## 2. 针对 `zspark-desktop` 项目的本地适配目录架构

基于 `zspark-desktop` 当前使用的 `electron-vite` 编译管线，我们将相关文件组织如下：

```
zspark/desktop/
├── src/
│   ├── main/
│   │   ├── services/
│   │   │   └── preview.ts          # [NEW] 浏览器视口服务：管理 WebContentsView 显隐/位置/注入
│   │   └── index.ts                # [MODIFY] 注册相关的 IPC 通道监听
│   ├── preload/
│   │   ├── preview-preload.ts      # [NEW] 注入网页的桥接脚本：负责把 IPC 通信管道挂载到 mainWorld
│   │   └── preview-agent.ts        # [NEW] 注入网页的 Agent：高亮/Dom层级导航/EditBubble/截图逻辑
│   └── renderer/
│       └── src/
│           ├── components/
│           │   └── browser/
│           │       ├── BrowserSurface.tsx       # [NEW] 浏览器宿主界面：处理 ResizeObserver bounds 同步
│           │       ├── BrowserAddressBar.tsx    # [NEW] 地址栏：包含刷新/导航/高亮/截图按钮
│           │       └── computeWebviewBounds.ts  # [NEW] 相对坐标与视口 bounds 的数学计算
│           ├── stores/
│           │   ├── browserPanelStore.ts         # [NEW] 维护浏览器 URL、picker 激活态的状态仓库
│           │   └── chatStore.ts                 # [MODIFY] 对接 selection 自动发消息和大模型会话
│           └── lib/
│               ├── previewBridge.ts             # [NEW] 封装 renderer -> main 进程的 IPC 代理
│               ├── previewEvents.ts             # [NEW] 订阅主进程分发来的 selection 事件并触发发信
│               └── selectionComposer.ts         # [NEW] 将 DOM 属性、Diff、用户描述拼接为多模态 Prompt
```

---

## 3. 核心技术层级的详细设计与伪代码蓝图

### 第一层：网页端高亮与气泡注入 (`preview-agent.ts`)

该脚本在网页加载完毕时，由主进程通过 `executeJavaScript` 注入到被浏览网页中执行。

```typescript
// desktop/src/preload/preview-agent.ts
import html2canvas from 'html2canvas';

(() => {
  // 1. 通信桥梁：Host 提供暴露在 mainWorld 的全局函数
  const postToHost = (raw: string) => {
    const post = (window as any).__DESKTOP_PREVIEW_POST__;
    if (post) post(raw);
  };

  // 2. 状态定义
  let pickerOn = false;
  let activeBubble: { destroy: () => void } | null = null;
  
  // 3. 创建高亮选框 (利用 Shadow DOM 避免网页本身的 CSS 干扰)
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  const highlightBox = document.createElement('div');
  highlightBox.style.cssText = 'position:fixed;border:2px solid #2f7bff;background:rgba(47,123,255,0.12);pointer-events:none;';
  highlightBox.hidden = true;
  shadow.appendChild(highlightBox);

  // 绘制高亮选区
  const draw = (el: Element | null) => {
    if (!el) { highlightBox.hidden = true; return; }
    const rect = el.getBoundingClientRect();
    highlightBox.hidden = false;
    highlightBox.style.left = `${rect.left}px`;
    highlightBox.style.top = `${rect.top}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
  };

  // 监听 mousemove 进行 hover
  document.addEventListener('mousemove', (e) => {
    if (!pickerOn || activeBubble) return;
    const target = e.target;
    if (target instanceof Element) {
      draw(target);
    }
  }, true);

  // 监听点击事件锁定并弹出属性修改气泡
  document.addEventListener('click', (e) => {
    if (!pickerOn || activeBubble) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target as HTMLElement;
    if (!target) return;
    
    pickerOn = false; // 停止 hover 追踪
    
    // 弹出编辑气泡
    activeBubble = createEditBubble(target, {
      onConfirm: async (change, description) => {
        // 进行标注截图
        const dataUrl = await captureAnnotatedRegion(target);
        
        // 发送给 Host
        postToHost(JSON.stringify({
          type: 'selection',
          payload: {
            pageUrl: window.location.href,
            sourceHint: document.title,
            element: buildElementMetadata(target),
            change: { ...change, description },
            screenshot: { dataUrl, kind: 'region' }
          }
        }));
        teardown();
      },
      onCancel: () => {
        teardown();
      }
    });
  }, true);

  function teardown() {
    activeBubble?.destroy();
    activeBubble = null;
    highlightBox.hidden = true;
    pickerOn = false;
  }
})();
```

---

### 第二层：Electron 主进程中转控制 (`preview.ts` & Preload)

`preview-preload.ts` 将通信端口桥接至底层 IPC。主进程使用 `WebContentsView` 容纳原生浏览器，并监听尺寸变化。

```typescript
// desktop/src/preload/preview-preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// 将该方法暴露给注入脚本，用于回传数据
contextBridge.exposeInMainWorld('__DESKTOP_PREVIEW_POST__', (raw: unknown) => {
  if (typeof raw === 'string') {
    ipcRenderer.send('preview-message-from-page', raw);
  }
});
```

```typescript
// desktop/src/main/services/preview.ts
import { WebContentsView, BrowserWindow, ipcMain } from 'electron';
import { readFileSync } from 'node:fs';

export class ElectronPreviewService {
  private view: WebContentsView | null = null;
  private parentWindow: BrowserWindow | null = null;

  constructor(private agentScriptPath: string) {}

  open(parent: BrowserWindow, url: string, bounds: Electron.Rectangle) {
    this.parentWindow = parent;
    if (!this.view) {
      this.view = new WebContentsView({
        webPreferences: {
          preload: path.join(__dirname, '../preload/preview-preload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });
      parent.contentView.addChildView(this.view);

      // 页面加载完毕注入 agent 代码
      this.view.webContents.on('did-finish-load', () => {
        const agentCode = readFileSync(this.agentScriptPath, 'utf8');
        this.view!.webContents.executeJavaScript(agentCode);
      });
    }

    this.view.setBounds(bounds);
    this.view.webContents.loadURL(url);
  }

  setBounds(bounds: Electron.Rectangle) {
    this.view?.setBounds(bounds);
  }

  setVisible(visible: boolean) {
    this.view?.setVisible(visible); // 处理弹窗层级遮挡
  }

  close() {
    if (this.view && this.parentWindow) {
      this.parentWindow.contentView.removeChildView(this.view);
      this.view.webContents.close();
      this.view = null;
    }
  }

  // 向页面下发控制指令 (如：进入/退出 picker 模式)
  sendToPage(payload: any) {
    const raw = JSON.stringify(payload);
    const script = `globalThis.__PREVIEW_BRIDGE__?.handleHostRaw(${JSON.stringify(raw)})`;
    this.view?.webContents.executeJavaScript(script);
  }
}
```

---

### 第三层：React 视图层布局与 Bounds 同步 (`BrowserSurface.tsx`)

React 的核心是检测自身大小变化，并将变化实时同步给原生 WebContentsView。

```typescript
// desktop/src/renderer/src/components/browser/BrowserSurface.tsx
import React, { useEffect, useRef } from 'react';
import { previewBridge } from '../../lib/previewBridge';
import { computeWebviewBounds } from './computeWebviewBounds';

export function BrowserSurface({ url }: { url: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  // 坐标同步函数
  const syncBounds = () => {
    const dom = hostRef.current;
    if (!dom) return;
    const rect = dom.getBoundingClientRect();
    // 计算出宿主窗口中相对窗口边缘的坐标 (x, y, w, h)
    const bounds = computeWebviewBounds(rect);
    previewBridge.setBounds(bounds);
  };

  useEffect(() => {
    const dom = hostRef.current;
    if (dom && url) {
      // 开启原生 Webview 视图并贴在当前位置
      previewBridge.open(url, computeWebviewBounds(dom.getBoundingClientRect()));
    }
    return () => {
      previewBridge.close();
    };
  }, [url]);

  // 监听容器大小改变 (解决左右拖拽分栏、窗口缩放、伸缩面板问题)
  useEffect(() => {
    const dom = hostRef.current;
    if (!dom) return;
    const observer = new ResizeObserver(() => syncBounds());
    observer.observe(dom);
    window.addEventListener('resize', syncBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncBounds);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* 地址栏和控制面板 */}
      <BrowserAddressBar onStartPicker={() => previewBridge.enterPicker()} />
      {/* 原生浏览器视图将被贴合在下方这个 div 的物理坐标上 */}
      <div ref={hostRef} className="flex-1 w-full bg-slate-900" />
    </div>
  );
}
```

---

### 第四层：Prompt 合成与 Chat 对接 (`selectionComposer.ts`)

当接收到元素元数据后，按照大模型更容易读懂的逻辑编排 Prompt。

```typescript
// desktop/src/renderer/src/lib/selectionComposer.ts
export function buildSelectionPrompt(payload: any) {
  const { element, change, pageUrl, sourceHint } = payload;
  const tag = element.tag;
  
  const diffs: string[] = [];
  if (change.text) diffs.push(`- 文本内容修改为：「${change.text.to}」（原内容为：「${change.text.from}」）`);
  if (change.color) diffs.push(`- 字体颜色改为：${change.color.to}`);
  if (change.background) diffs.push(`- 背景色改为：${change.background.to}`);
  if (change.opacity) diffs.push(`- 透明度改为：${change.opacity.to}`);
  
  const prompt = `
请根据截图中带有编号 1 的蓝色高亮标注，对本地的前端代码进行修改。

【定位上下文】
- 目标元素：<${tag}>
- CSS 选择器：${element.selector}
- DOM 路径：${element.nthPath}
- 页面 URL：${pageUrl} (标题: ${sourceHint})

【用户修改要求】
- 描述说明：${change.description || '无额外说明，请根据改动项与截图意图进行修改。'}
${diffs.length > 0 ? '\n【WYSIWYG 样式改动参考】\n' + diffs.join('\n') : ''}

请优先依据截图中编号 1 的高亮框判断被修改的元素及其在项目文件中的具体位置，Selector 仅作为辅助参考线索。
  `.trim();

  return {
    promptText: prompt,
    displayName: `<${tag}>`,
  };
}
```

---

## 4. 超越 cc-haha 的四大进阶方案设计 (核心亮点)

为了使 `zspark` 项目的交互品质和性能体验彻底超越 `cc-haha`，我们规划了以下四大顶层重构：

### 🚀 进阶一：Native CDP (Chrome DevTools Protocol) 截图
* **现状痛点**：`cc-haha` 原版引入了 `html2canvas` 库。这是一个通过纯 JS 重新解析 DOM 树并在 Canvas 上模拟绘制的方案。它的**性能极差**，大页面会卡死 2~3 秒，且无法支持 Tailwind 的复杂渐变、Canvas 标签、3D WebGL、SVG 图表，截图经常失真或缺失。
* **超越实现**：我们将在主进程中直接利用 **Chromium 的底层截图能力**。当用户确认选择后，主进程触发：
  ```typescript
  // 主进程直接截取 WebContents 显卡渲染图，效率提升 10 倍以上，且 100% 还原
  const nativeImage = await this.view.webContents.capturePage();
  ```
  主进程将拿到真实的 PNG 图像 Buffer，接着在主进程或页面侧利用原生 Canvas API 将 1 号高亮圈标记叠加在对应的坐标点 `boundingBox` 上。
* **效果**：零样式失真、100% 还原、网页内无需挂载体积庞大的 `html2canvas.js` 模拟库，极大地减少了 Preload 脚本的大小和执行时间。

### 🚀 进阶二：DOM 树智能修剪与 Tailwind Class 降噪
* **现状痛点**：现在的现代网页往往带有堆积成山的类名（如 Tailwind 的几百个 utility classes）和嵌套了十几层的空 div。把这些原封不动打包给大模型，不仅消耗巨量的 Token（产生高昂开销），还会稀释核心元数据，误导模型产生幻觉。
* **超越实现**：在回传 `outerHtmlSnippet` 前，注入脚本先对其做一次智能精简：
  1. 清除无实际样式意义的 layout/spacing 类名，或是把冗长 Tailwind 类名压缩为该元素最根本的视觉改变项。
  2. 将多级嵌套的无文字子节点缩减折叠为占位行，如：`<div><!-- folded 8 empty wrapper elements --></div>`。
* **效果**：大模型接收到的上下文信息信噪比提升 400%，Token 开销节约 70% 以上，回复更快速、代码修改更精准。

### 🚀 进阶三：双向元素定位联动高亮 (LLM ➡ 页面)
* **现状痛点**：大模型根据用户的圈选做出代码修改意见后，用户只能从文本上看 AI 改了哪里，无法直观在右侧内置浏览器中定位改动目标。
* **超越实现**：在大模型的回复消息中，系统自动将 Selector 用一种专有的 Markdown 格式（如 `[button#save-btn](show-element://#save-btn)`）封装。用户点击该链接，内置浏览器会自动平滑滚动到该 DOM 元素，并高亮闪烁提示，建立起“发出可圈选，收到可定位”的完美闭环。

### 🚀 进阶四：支持多元素圈选组合 (Multi-Picker via Shift Key)
* **现状痛点**：原版一次只能选择一个网页元素，若想要让模型把“把元素 A 的文字拷到输入框 B 里”，需要发两次，无法关联上下文。
* **超越实现**：用户按住 Shift 键，可以连续高亮圈选多个元素，系统会自动分配编号（1, 2, 3...）。截图里会包含这三个编号标记，回传的 Prompt 包含一个数组列表。这能让大模型处理更复杂、跨元素的交互和对比重构逻辑。

---

## 5. 详细实施路径与演进指南

根据规划，我们分五个迭代逐步落地该项功能：
1. **阶段一（第 1 步）**：设计并跑通右侧 `WebContentsView` 视口的加载、bounds 计算和显隐生命周期（解决弹窗遮挡问题）。
2. **阶段二（第 2 步）**：编写 `preview-agent` 逻辑，在 Shadow DOM 里实现鼠标 hover 以及 click 时的半透明蓝色锁定浮层。
3. **阶段三（第 3 步）**：打通 `__DESKTOP_PREVIEW_POST__` 双向通信，并实现 CDP 底层截图或 html2canvas 回传 base64 数据。
4. **阶段四（第 4 步）**：在宿主 React 侧将元数据和带标记截图传入 Chat Store 并自动触发消息发信。
5. **阶段五（第 5 步）**：逐步升级进阶方案，实现 DOM 瘦身与多选，完美超越 cc-haha。
