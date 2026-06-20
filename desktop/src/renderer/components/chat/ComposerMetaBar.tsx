import React, { useMemo } from 'react'
import { useRuntimeStore, type ReasoningEffort } from '../../store/runtimeStore'
import { computeContextRing } from '../../utils/contextRing'

const ALL_EFFORTS: ReasoningEffort[] = ['minimal', 'low', 'medium', 'high', 'xhigh']

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'X-High',
}

/**
 * ComposerMetaBar —— 输入框上方的元信息栏,对齐 CodexMonitor。
 *
 * 包含:
 *  - 模型下拉(model/list 候选;选中后下一条消息用新模型)
 *  - reasoning effort 下拉(按当前模型的 supported_reasoning_efforts 过滤)
 *  - plan mode toggle(开启后下一条消息进 plan 模式;开启时 effort 跟随 plan 预设)
 *  - context usage ring(剩余上下文 %,hover 展开详情)
 *
 * 数据全部从 runtimeStore 订阅。切换只改本地 state,真正下发在 turn/start
 * (由 App.tsx 的 submit 通过 buildTurnOverrides 拼装)。
 */
export function ComposerMetaBar() {
  const {
    modelList,
    collaborationModes,
    selectedModel,
    selectedEffort,
    planModeEnabled,
    runtime,
    tokenUsage,
    permissionLevel,
    ready,
    setSelectedModel,
    setSelectedEffort,
    setPlanModeEnabled,
    setPermissionLevel,
  } = useRuntimeStore()

  // 当前模型对象(用于取 supported_reasoning_efforts 过滤 effort 选项)。
  const currentModel = useMemo(() => {
    const id = selectedModel ?? runtime.provider?.model ?? runtime.model
    return modelList.find((m) => m.model === id || m.id === id) ?? null
  }, [modelList, selectedModel, runtime])

  // effort 候选:模型声明了 supported 就用声明的,否则全档可选。
  const effortOptions = useMemo<ReasoningEffort[]>(() => {
    const supported = currentModel?.supported_reasoning_efforts
    if (Array.isArray(supported) && supported.length > 0) {
      return ALL_EFFORTS.filter((e) => (supported as string[]).includes(e))
    }
    return ALL_EFFORTS
  }, [currentModel])

  // 当前选中 effort(显示用)。plan 模式下显示预设的 effort。
  const displayEffort: ReasoningEffort | null = planModeEnabled
    ? (collaborationModes.find((m) => m.mode === 'plan' || m.id === 'plan')?.settings?.reasoning_effort as ReasoningEffort | undefined) ?? 'medium'
    : selectedEffort

  // context ring(从原 model-capsule 迁来,用 CM 的 last-优先算法)。
  const ring = useMemo(() => computeContextRing(tokenUsage), [tokenUsage])

  // plan 开启时禁用 model/effort 下拉(避免被 collaboration 覆盖产生歧义;
  // 实际值已合并进 collaborationMode.settings,见 buildTurnOverrides)。
  const planLocked = planModeEnabled

  return (
    <div className="composer-meta-bar">
      <div className="composer-meta">
        {/* plan mode toggle */}
        <button
          type="button"
          className={`meta-plan-toggle${planModeEnabled ? ' is-on' : ''}`}
          onClick={() => setPlanModeEnabled(!planModeEnabled)}
          title={planModeEnabled ? '退出 Plan 模式' : '进入 Plan 模式(先规划再执行)'}
          aria-pressed={planModeEnabled}
        >
          {planModeEnabled ? '✓ Plan' : 'Plan'}
        </button>

        {/* 模型下拉 */}
        <label className="meta-select-wrap" title="模型">
          <select
            className="meta-select"
            value={selectedModel ?? runtime.provider?.model ?? runtime.model ?? ''}
            disabled={planLocked || modelList.length === 0}
            onChange={(e) => setSelectedModel(e.target.value || null)}
          >
            {modelList.length === 0 ? (
              <option value={selectedModel ?? runtime.provider?.model ?? runtime.model ?? ''}>
                {selectedModel ?? runtime.provider?.model ?? runtime.model ?? '—'}
              </option>
            ) : (
              modelList.map((m) => {
                const val = m.model ?? m.id ?? ''
                const label = m.display_name ?? m.model ?? m.id ?? ''
                return <option key={val || label} value={val}>{label}</option>
              })
            )}
          </select>
        </label>

        {/* reasoning effort 下拉 */}
        <label className="meta-select-wrap" title="Reasoning effort">
          <select
            className="meta-select"
            value={displayEffort ?? ''}
            disabled={planLocked || effortOptions.length === 0}
            onChange={(e) => setSelectedEffort((e.target.value || null) as ReasoningEffort | null)}
          >
            {displayEffort === null && <option value="">默认</option>}
            {effortOptions.map((eff) => (
              <option key={eff} value={eff}>{EFFORT_LABELS[eff]}</option>
            ))}
          </select>
        </label>

        {/* Permission 下拉(审批策略) */}
        <label className="meta-select-wrap" title="审批策略">
          <select
            className="meta-select meta-select--permission"
            value={permissionLevel}
            disabled={planLocked || !ready}
            onChange={(e) => setPermissionLevel(e.target.value as 'default' | 'auto' | 'full')}
          >
            <option value="default">Default</option>
            <option value="auto">Auto</option>
            <option value="full">Full</option>
          </select>
        </label>
      </div>

      {/* context ring(右侧) */}
      <div className="composer-context">
        <div className="composer-context-ring-wrap" title={`剩余上下文 ${ring.freePercent}%`}>
          <span
            className="composer-context-ring"
            style={{ background: `conic-gradient(var(--accent) ${ring.usedPercent * 3.6}deg, var(--cm-border-strong) 0deg)` }}
          >
            <span className="composer-context-ring-inner">{ring.freePercent}%</span>
          </span>
        </div>
      </div>
    </div>
  )
}
