import React, { useMemo, useState } from 'react'
import {
  IconNewChat, IconSearch, IconSkills, IconPlugins, IconAutomations,
  IconProject, IconClose, IconShield
} from './icons'
import { displayThreadPreview, formatThreadTime } from './appHelpers'
import { getThreadStatusClass, THREAD_STATUS_LABELS } from './utils/threadStatus'
import type {
  CollapsedSections,
  WorkspaceInfo,
  EnterpriseStatus,
  SharedWorkspace,
  ThreadSummary
} from './appTypes'

export interface SidebarProps {
  t: (key: string, options?: any) => string
  newChat: () => void
  openPanel: (panel: any) => void
  activeSharedWorkspace: string | null
  exitSharedWorkspace: () => void
  collapsedSections: CollapsedSections
  toggleSection: (key: keyof CollapsedSections) => void
  pickWorkspace: () => void
  recentWorkspaces: WorkspaceInfo[]
  switchWorkspace: (path: string) => void
  getWorkspacePreview: (path: string) => string
  workspaceBusy: boolean
  enterprise: EnterpriseStatus | null
  enterpriseBusy: boolean
  enterpriseError: string | null
  signInEnterprise: () => void
  createSharedWorkspace: () => void
  sharedWorkspaces: SharedWorkspace[]
  selectSharedWorkspace: (id: string) => void
  visibleThreads: ThreadSummary[]
  activeThreadId: string | null
  switchThread: (id: string) => void
  deleteThread: (id: string, e?: React.MouseEvent) => void
  onRenameThread: (id: string, newTitle: string) => Promise<void>
  onDeleteThreads: (ids: string[]) => Promise<void>
}

export const Sidebar: React.FC<SidebarProps> = ({
  t,
  newChat,
  openPanel,
  activeSharedWorkspace,
  exitSharedWorkspace,
  collapsedSections,
  toggleSection,
  pickWorkspace,
  recentWorkspaces,
  switchWorkspace,
  getWorkspacePreview,
  workspaceBusy,
  enterprise,
  enterpriseBusy,
  enterpriseError,
  signInEnterprise,
  createSharedWorkspace,
  sharedWorkspaces,
  selectSharedWorkspace,
  visibleThreads,
  activeThreadId,
  switchThread,
  deleteThread,
  onRenameThread,
  onDeleteThreads
}) => {
  // 实时搜索最近会话的过滤词
  const [sessionSearchQuery, setSessionSearchQuery] = useState('')
  
  // 批量模式状态与被选中的会话 ID 集合
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set())

  // 双击就地重命名状态
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  // 局部状态：记录折叠的项目路径
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())

  // 局部状态：记录完全展开的项目路径
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // 过滤会话列表
  const filteredThreads = useMemo(() => {
    if (!sessionSearchQuery.trim()) return visibleThreads
    const query = sessionSearchQuery.toLowerCase()
    return visibleThreads.filter((thread) => {
      const title = displayThreadPreview(thread).toLowerCase()
      const previewText = (thread.preview || '').toLowerCase()
      return title.includes(query) || previewText.includes(query)
    })
  }, [visibleThreads, sessionSearchQuery])

  interface ProjectGroup {
    path: string
    name: string
    isActive: boolean
    lastUsed?: number
    threads: ThreadSummary[]
  }

  // 按照工作目录对会话进行分组并排序
  const projectGroups = useMemo(() => {
    // 1. 先根据 recentWorkspaces 创建已知工作区的分组
    const groups: ProjectGroup[] = recentWorkspaces.map((ws) => ({
      path: ws.path,
      name: ws.name,
      isActive: ws.isActive,
      lastUsed: ws.lastUsed,
      threads: []
    }))

    // 2. 遍历过滤后的会话，把它们分派到对应的工作区下
    filteredThreads.forEach((thread) => {
      if (!thread.cwd) {
        // 如果会话没有 cwd 字段，则归为“其他会话”分组
        let otherGroup = groups.find((g) => g.path === 'other_sessions')
        if (!otherGroup) {
          otherGroup = {
            path: 'other_sessions',
            name: '其他会话',
            isActive: false,
            threads: []
          }
          groups.push(otherGroup)
        }
        otherGroup.threads.push(thread)
        return
      }

      const normalizedCwd = thread.cwd.replace(/\\/g, '/').toLowerCase()
      const match = groups.find((g) => g.path.replace(/\\/g, '/').toLowerCase() === normalizedCwd)
      
      if (match) {
        match.threads.push(thread)
      } else {
        // 如果该会话的 cwd 没有记录在 recentWorkspaces，则自动为其建立一个分组
        const wsName = thread.cwd.split(/[\\/]/).pop() || '未命名工作区'
        const newGroup: ProjectGroup = {
          path: thread.cwd,
          name: wsName,
          isActive: false,
          threads: [thread]
        }
        groups.push(newGroup)
      }
    })

    // 3. 对分组进行排序：活跃工作区排最前，其余的按 lastUsed 排序，最后是没有任何 lastUsed 的工作区
    groups.sort((a, b) => {
      if (a.isActive) return -1
      if (b.isActive) return 1
      const aTime = a.lastUsed || 0
      const bTime = b.lastUsed || 0
      return bTime - aTime
    })

    return groups
  }, [recentWorkspaces, filteredThreads])

  // 双击启动重命名
  const startRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(id)
    setRenameValue(currentTitle)
  }

  // 结束重命名（失去焦点或按回车）
  const handleRenameFinish = async () => {
    if (renamingId && renameValue.trim()) {
      await onRenameThread(renamingId, renameValue.trim())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleRenameKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      await handleRenameFinish()
    } else if (e.key === 'Escape') {
      setRenamingId(null)
      setRenameValue('')
    }
  }

  // 批量全选与取消全选
  const handleToggleSelectAll = () => {
    if (selectedThreadIds.size === filteredThreads.length) {
      setSelectedThreadIds(new Set())
    } else {
      setSelectedThreadIds(new Set(filteredThreads.map((t) => t.id)))
    }
  }

  // 执行批量删除
  const handleBatchDelete = async () => {
    if (selectedThreadIds.size === 0) return
    await onDeleteThreads(Array.from(selectedThreadIds))
    setSelectedThreadIds(new Set())
    setIsBatchMode(false)
  }

  // 点击会话行处理
  const handleThreadClick = (id: string) => {
    if (isBatchMode) {
      setSelectedThreadIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
    } else {
      switchThread(id)
    }
  }

  const togglePathCollapse = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollapsedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  return (
    <aside className="sidebar">
      {/* 品牌 Logo */}
      <div className="brand">
        <div className="brand-mark">z</div>
        <div className="brand-copy">
          <strong>zspark</strong>
          <span>{t('brand.subtitle')}</span>
        </div>
      </div>

      {/* 导航菜单 */}
      <div className="nav-item active" onClick={newChat}>
        <IconNewChat />
        <span>{t('nav.newChat')}</span>
      </div>
      <div className="nav-item" onClick={() => openPanel('search')}>
        <IconSearch />
        <span>{t('nav.search')}</span>
      </div>
      <div className="nav-item" onClick={() => openPanel('skills')}>
        <IconSkills />
        <span>{t('nav.skills')}</span>
      </div>
      <div className="nav-item" onClick={() => openPanel('plugins')}>
        <IconPlugins />
        <span>{t('nav.plugins')}</span>
      </div>
      <div className="nav-item" onClick={() => openPanel('automations')}>
        <IconAutomations />
        <span>{t('nav.automations')}</span>
      </div>

      {activeSharedWorkspace && (
        <button className="local-workspace-btn" onClick={exitSharedWorkspace}>
          <IconProject />
          <span>Local workspace</span>
        </button>
      )}

      {/* 本地项目与会话嵌套列表 */}
      <div className="sidebar-section">
        <div className="sidebar-section-head" onClick={() => toggleSection('localWorkspaces')}>
          <span className="sidebar-section-toggle">{collapsedSections.localWorkspaces ? '▸' : '▾'}</span>
          <span className="sidebar-section-title">{t('workspace.local')}</span>
          
          <button
            className={`sidebar-section-batch-btn ${isBatchMode ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setIsBatchMode(!isBatchMode)
              setSelectedThreadIds(new Set())
            }}
            title="批量管理"
            style={{ marginRight: '6px' }}
          >
            {isBatchMode ? '取消' : '批量'}
          </button>

          <button
            className="sidebar-section-add"
            onClick={(e) => {
              e.stopPropagation()
              pickWorkspace()
            }}
            title={t('workspace.add')}
          >
            <span>+</span>
          </button>
        </div>

        {!collapsedSections.localWorkspaces && (
          <div className="workspace-list" style={{ gap: '0' }}>
            {/* 搜索框和批量条 */}
            <div className="session-search-wrapper" style={{ margin: '6px 8px 8px' }}>
              <input
                type="text"
                className="session-search-input"
                placeholder="搜索会话..."
                value={sessionSearchQuery}
                onChange={(e) => setSessionSearchQuery(e.target.value)}
              />
              {sessionSearchQuery && (
                <button className="session-search-clear" onClick={() => setSessionSearchQuery('')}>
                  <IconClose />
                </button>
              )}
            </div>

            {isBatchMode && (
              <div className="session-batch-bar" style={{ margin: '0 8px 8px' }}>
                <span className="session-batch-count">已选 {selectedThreadIds.size}</span>
                <div className="session-batch-actions">
                  <button className="session-batch-btn-all" onClick={handleToggleSelectAll}>
                    {selectedThreadIds.size === filteredThreads.length ? '全消' : '全选'}
                  </button>
                  <button
                    className="session-batch-btn-del"
                    disabled={selectedThreadIds.size === 0}
                    onClick={handleBatchDelete}
                  >
                    删除
                  </button>
                </div>
              </div>
            )}

            {/* 嵌套的项目与会话树 */}
            <div className="project-groups-list" style={{ padding: '0 8px' }}>
              {projectGroups.map((group) => {
                const isCollapsed = collapsedPaths.has(group.path)
                const hasThreads = group.threads.length > 0

                return (
                  <div key={group.path} className={`project-group-item${group.isActive ? ' active' : ''}`}>
                    {/* 项目文件夹标题行 */}
                    <div 
                      className={`project-group-header${group.isActive ? ' active' : ''}`}
                      onClick={() => !group.isActive && switchWorkspace(group.path)}
                      title={group.path}
                    >
                      <span 
                        className="project-collapse-toggle"
                        onClick={(e) => togglePathCollapse(group.path, e)}
                      >
                        {hasThreads ? (isCollapsed ? '▸' : '▾') : '·'}
                      </span>
                      
                      <span className="project-folder-icon">
                        {isCollapsed ? '📁' : '📂'}
                      </span>
                      
                      <span className="project-name">
                        {group.name}
                      </span>

                      {group.isActive ? (
                        <button
                          className="project-add-thread-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            newChat()
                          }}
                          title="新建会话"
                        >
                          +
                        </button>
                      ) : (
                        <span className="project-inactive-dot" title="点击切换至此工作区">●</span>
                      )}
                    </div>

                    {/* 项目嵌套会话列表 */}
                    {!isCollapsed && hasThreads && (() => {
                      const LIMIT = 5
                      const isExpanded = expandedPaths.has(group.path)
                      let visibleGroupThreads = group.threads
                      
                      if (!isExpanded && group.threads.length > LIMIT) {
                        const sliced = group.threads.slice(0, LIMIT)
                        const activeIndex = group.threads.findIndex((t) => t.id === activeThreadId)
                        if (activeIndex >= LIMIT) {
                          sliced.push(group.threads[activeIndex])
                        }
                        visibleGroupThreads = sliced
                      }

                      return (
                        <div className="project-threads-list">
                          {visibleGroupThreads.map((threadItem) => {
                            const isRenaming = renamingId === threadItem.id
                            const titleText = displayThreadPreview(threadItem)
                            const isSelected = selectedThreadIds.has(threadItem.id)

                            return (
                              <div
                                key={threadItem.id}
                                className={`nav-item nav-item-thread nested-thread-item${
                                  activeThreadId === threadItem.id ? ' active' : ''
                                }${isSelected ? ' selected' : ''}`}
                                onClick={() => handleThreadClick(threadItem.id)}
                                onDoubleClick={(e) => !isBatchMode && startRename(threadItem.id, titleText, e)}
                              >
                                {isBatchMode && (
                                  <input
                                    type="checkbox"
                                    className="thread-batch-checkbox"
                                    checked={isSelected}
                                    onChange={() => {}} // 由 handleThreadClick 统一处理
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}

                                {isRenaming ? (
                                  <input
                                    className="thread-rename-input"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={handleRenameFinish}
                                    onKeyDown={handleRenameKeyDown}
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <>
                                    <span className="thread-preview" title={titleText}>{titleText}</span>
                                    {(() => {
                                      const statusClass = getThreadStatusClass(threadItem)
                                      // ready 态不显示状态点,避免视觉噪音。
                                      if (statusClass === 'ready') return null
                                      return (
                                        <span
                                          className={`thread-status thread-status-${statusClass}`}
                                          title={THREAD_STATUS_LABELS[statusClass]}
                                          aria-label={THREAD_STATUS_LABELS[statusClass]}
                                        />
                                      )
                                    })()}
                                    {threadItem.updatedAt && (
                                      <span className="thread-time">
                                        {formatThreadTime(threadItem.updatedAt)}
                                      </span>
                                    )}
                                  </>
                                )}

                                {!isBatchMode && !isRenaming && (
                                  <button
                                    className="row-x"
                                    onClick={(e) => deleteThread(threadItem.id, e)}
                                    aria-label={t('sidebar.delete')}
                                    title={t('sidebar.delete')}
                                  >
                                    <IconClose />
                                  </button>
                                )}
                              </div>
                            )
                          })}

                          {group.threads.length > LIMIT && (
                            <div
                              className="thread-expand-toggle-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setExpandedPaths((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(group.path)) {
                                    next.delete(group.path)
                                  } else {
                                    next.add(group.path)
                                  }
                                  return next
                                })
                              }}
                            >
                              {isExpanded ? '收起会话' : `展开更多 (${group.threads.length - LIMIT})`}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}

              {filteredThreads.length === 0 && (
                <div className="nav-item" onClick={() => openPanel('history')} style={{ color: '#a1a1aa', padding: '6px 10px' }}>
                  <IconProject />
                  <span>
                    {sessionSearchQuery
                      ? '无匹配会话'
                      : activeSharedWorkspace
                      ? t('sidebar.noSharedYet')
                      : t('sidebar.noChatsYet')}
                  </span>
                </div>
              )}
            </div>

            <button className="workspace-picker-btn" onClick={pickWorkspace} disabled={workspaceBusy} style={{ margin: '8px' }}>
              <IconProject /> {t('workspace.selectDirectory')}
            </button>
          </div>
        )}
      </div>

      {/* 共享工作区 */}
      <div className="sidebar-section">
        <div className="sidebar-section-head" onClick={() => toggleSection('sharedWorkspaces')}>
          <span className="sidebar-section-toggle">{collapsedSections.sharedWorkspaces ? '▸' : '▾'}</span>
          <span className="sidebar-section-title">{t('workspace.shared')}</span>
          <button
            className="sidebar-section-action"
            onClick={(e) => {
              e.stopPropagation()
              openPanel('shared')
            }}
            title={t('workspace.shared')}
          >
            <IconShield />
          </button>
        </div>
        {!collapsedSections.sharedWorkspaces && (
          <div className="shared-workspace-content">
            {!enterprise?.signedIn ? (
              <button className="shared-signin" onClick={signInEnterprise} disabled={enterpriseBusy}>
                {enterpriseBusy ? t('workspace.connecting') : t('workspace.signIn')}
              </button>
            ) : sharedWorkspaces.length === 0 ? (
              <>
                <button className="shared-signin" onClick={createSharedWorkspace} disabled={enterpriseBusy}>
                  {enterpriseBusy ? t('workspace.creating') : t('workspace.create')}
                </button>
                {enterpriseError && <div className="shared-sidebar-error">{enterpriseError}</div>}
              </>
            ) : (
              <div className="shared-workspace-list">
                {sharedWorkspaces.slice(0, 5).map((workspace) => (
                  <button
                    key={workspace.id}
                    className={activeSharedWorkspace === workspace.id ? 'active' : ''}
                    onClick={() => selectSharedWorkspace(workspace.id)}
                    title={workspace.name}
                  >
                    <IconProject />
                    <span>{workspace.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}

