// PlanPanel —— 右栏下段的执行计划面板,对齐 CM 的 PlanPanel。
// 数据来自 codex 的 turn/plan/updated 通知(经 App.tsx 写入 runtimeStore.threadPlan)。
// 渲染:explanation + steps 列表(每步 status 图标 + 进度 completed/total)。
import React, { useMemo } from 'react'
import { useRuntimeStore, type TurnPlanStep } from '../store/runtimeStore'

const STATUS_ICON: Record<TurnPlanStep['status'], string> = {
  completed: '✓',
  inProgress: '▸',
  pending: '○',
}

const STATUS_LABEL: Record<TurnPlanStep['status'], string> = {
  completed: '已完成',
  inProgress: '进行中',
  pending: '待执行',
}

export function PlanPanel() {
  const threadPlan = useRuntimeStore((s) => s.threadPlan)

  const progress = useMemo(() => {
    if (!threadPlan || threadPlan.steps.length === 0) return null
    const completed = threadPlan.steps.filter((s) => s.status === 'completed').length
    return { completed, total: threadPlan.steps.length }
  }, [threadPlan])

  if (!threadPlan || threadPlan.steps.length === 0) {
    return (
      <div className="plan-panel plan-panel-empty">
        <div className="plan-panel-title">计划</div>
        <div className="plan-panel-empty-hint">暂无执行计划。开启 Plan 模式发送消息后,这里会显示分步计划。</div>
      </div>
    )
  }

  return (
    <div className="plan-panel">
      <div className="plan-panel-header">
        <span className="plan-panel-title">计划</span>
        {progress && (
          <span className="plan-panel-progress">
            {progress.completed}/{progress.total}
          </span>
        )}
      </div>
      {threadPlan.explanation && (
        <div className="plan-panel-explanation">{threadPlan.explanation}</div>
      )}
      <ol className="plan-steps">
        {threadPlan.steps.map((step, idx) => (
          <li key={idx} className={`plan-step plan-step-${step.status}`}>
            <span className="plan-step-icon" aria-label={STATUS_LABEL[step.status]}>
              {STATUS_ICON[step.status]}
            </span>
            <span className="plan-step-text">{step.step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
