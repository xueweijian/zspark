// CenterDiffLayer —— 中栏的 diff 层(第二层),对齐 CM 的中栏 diff 视图。
// 复用 gitController 提供的数据(diffs/selectedDiffPath/文件列表),把 diff 查看从右栏 Git tab
// 提升到中栏,支持单看(只看 diff)与分屏(chat 左 / diff 右)。
// 布局:顶部工具条(返回聊天 + 分屏切换 + 文件计数)+ 左侧文件列表 + 右侧 GitDiffViewer。
import React from 'react'
import { GitDiffViewer } from './GitDiffViewer'
import { DiffFileRow, type GitFileStatus } from './GitPanelShared'

interface CenterDiffLayerProps {
  /** 工作区改动文件(staged + unstaged 合并去重后的列表)。 */
  files: GitFileStatus[]
  /** 展开后的 diff 条目(path/status/diff),由 useGitDiffs 提供。 */
  diffs: Array<{ path: string; status: string; diff: string }>
  /** 当前选中的文件 path(与右栏 Git tab 共享同一 gitController 实例,会联动)。 */
  selectedPath: string | null
  /** 选中文件。 */
  onSelect: (path: string) => void
  /** 返回聊天层(单看模式)。 */
  onExit: () => void
  /** 是否分屏模式(影响工具条按钮文案:分屏时隐藏「返回聊天」改为提示)。 */
  splitMode: boolean
  /** 切换分屏开关。 */
  onToggleSplit: () => void
  /** diff 加载中。 */
  isLoading: boolean
  /** diff 错误信息。 */
  error: string | null
}

export function CenterDiffLayer({
  files, diffs, selectedPath, onSelect, onExit, splitMode, onToggleSplit, isLoading, error,
}: CenterDiffLayerProps) {
  const selectedSet = new Set(selectedPath ? [selectedPath] : [])
  const activeDiff = selectedPath ? diffs.find((d) => d.path === selectedPath) : null
  const hasChanges = files.length > 0

  return (
    <div className="center-diff-layer">
      <div className="center-diff-toolbar">
        <div className="center-diff-toolbar-left">
          {!splitMode && (
            <button type="button" className="center-diff-back" onClick={onExit} title="返回聊天">
              <span className="center-diff-back-arrow" aria-hidden>←</span>
              <span>聊天</span>
            </button>
          )}
          <span className="center-diff-title">Diff</span>
          {hasChanges && <span className="center-diff-count">{files.length} 个文件</span>}
        </div>
        <div className="center-diff-toolbar-right">
          <button
            type="button"
            className={`center-diff-split-toggle${splitMode ? ' is-on' : ''}`}
            onClick={onToggleSplit}
            title={splitMode ? '关闭分屏' : '分屏显示聊天与 Diff'}
          >
            {splitMode ? '分屏:开' : '分屏'}
          </button>
        </div>
      </div>

      {!hasChanges ? (
        <div className="center-diff-empty">工作区无改动。Agent 修改文件后,这里会显示分文件 diff。</div>
      ) : (
        <div className="center-diff-body">
          <div className="center-diff-filelist">
            {files.map((f) => (
              <DiffFileRow
                key={f.path}
                file={f}
                isSelected={selectedSet.has(f.path)}
                section="unstaged"
                onClick={() => onSelect(f.path)}
              />
            ))}
          </div>
          <div className="center-diff-viewer">
            <GitDiffViewer
              diffs={diffs}
              selectedPath={selectedPath}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      )}
    </div>
  )
}
