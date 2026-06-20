// 构建 turn/start 的运行时覆盖参数(model / effort / collaborationMode)。
//
// codex app-server 协议:这三项都在 turn/start.params 里逐 turn 覆盖。
// 关键规则:collaborationMode 一旦设置,优先级高于同 turn 的 model/effort
// (协议注释明确写 "Takes precedence over model, reasoning_effort")。
// 所以 plan 模式开启时,要把 model/effort 合并进 collaborationMode.settings,
// 而不是在顶层再发 model/effort(会被 collaboration 覆盖)。
//
// 参考 CM 的 usePlanReadyActions.ts:buildCollaborationModePayloadFor。

import type { CollaborationModePreset, ReasoningEffort } from '../store/runtimeStore'

export interface TurnOverrideParams {
  /** 顶层 model 覆盖(plan 模式下不设,合并进 collaborationMode)。 */
  model?: string
  /** 顶层 effort 覆盖(plan 模式下不设)。 */
  effort?: ReasoningEffort
  /** collaborationMode 覆盖(plan 模式时设置)。 */
  collaborationMode?: { mode: string; settings: { model?: string | null; reasoning_effort?: string | null; developer_instructions?: string | null } }
}

/** plan 模式开启时的硬编码预设(experimental gate 未开启时降级用)。 */
const PLAN_FALLBACK_PRESET: CollaborationModePreset = {
  id: 'plan',
  name: 'plan',
  mode: 'plan',
  settings: {
    model: null,
    reasoning_effort: 'medium',
    developer_instructions: 'You are planning. Think step by step and produce a clear plan before executing.',
  },
}

/**
 * 从 collaborationModes 里找 plan 预设;找不到用硬编码降级。
 */
export function findPlanPreset(modes: CollaborationModePreset[]): CollaborationModePreset {
  return (
    modes.find((m) => m.mode === 'plan' || m.id === 'plan' || m.name === 'plan') ??
    PLAN_FALLBACK_PRESET
  )
}

export interface BuildTurnOverridesArgs {
  selectedModel: string | null
  selectedEffort: ReasoningEffort | null
  planModeEnabled: boolean
  collaborationModes: CollaborationModePreset[]
  /**
   * model 兜底值(优先级低于 selectedModel):用户没在下拉里主动选过(selectedModel=null)时,
   * 用这个兜底,避免丢失覆盖导致老 thread 粘住旧 model / 落到 config 默认。
   * 通常传 runtime.provider?.model ?? runtime.model(设置面板配的或 codex 上报的)。
   */
  fallbackModel?: string | null
}

/**
 * 构建 turn/start 的覆盖参数。返回空对象表示不带任何覆盖。
 *
 * 行为:
 * - plan 关闭:始终带 model(仿 CM)——selectedModel ?? fallbackModel;effort 若有选中则带。不带 collaborationMode。
 * - plan 开启:从预设构建 collaborationMode,把当前 model/effort 合并进 settings;
 *   不在顶层带 model/effort(避免被 collaboration 覆盖且产生歧义)。
 */
export function buildTurnOverrides({
  selectedModel,
  selectedEffort,
  planModeEnabled,
  collaborationModes,
  fallbackModel = null,
}: BuildTurnOverridesArgs): TurnOverrideParams {
  // 解析出最终生效的 model:用户下拉选中(selectedModel)优先,否则用兜底(设置配的 / codex 上报的)。
  const effectiveModel = selectedModel ?? fallbackModel ?? null

  if (!planModeEnabled) {
    const params: TurnOverrideParams = {}
    // 始终带 model(即使为 null 也显式带,覆盖老 thread 的 sticky model)。
    if (effectiveModel) params.model = effectiveModel
    if (selectedEffort) params.effort = selectedEffort
    return params
  }

  const preset = findPlanPreset(collaborationModes)
  const settings = {
    // 预设的 model/instructions 优先,用户的 effectiveModel/effort 作为补充(用户没选则用预设)。
    model: effectiveModel ?? preset.settings?.model ?? null,
    reasoning_effort: selectedEffort ?? preset.settings?.reasoning_effort ?? null,
    developer_instructions: preset.settings?.developer_instructions ?? null,
  }
  return {
    collaborationMode: {
      mode: preset.mode ?? 'plan',
      settings,
    },
  }
}
