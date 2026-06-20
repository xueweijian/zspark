// PlanPanel —— 右栏下段的执行计划面板,className 完全对齐 CM(CodexMonitor/src/features/plan/components/PlanPanel.tsx)。
// 数据来自 codex 的 turn/plan/updated 通知(经 App.tsx 写入 runtimeStore.threadPlan)。
// 渲染:plan-header(标题 + 进度) + plan-explanation + plan-list(steps,每步 status 图标)。
// 无 plan 时渲染 plan-empty 空态(收起由父级 .plan-collapsed 控制)。
import React from 'react'
import { useRuntimeStore, type TurnPlan, type TurnPlanStep } from '../store/runtimeStore'

// CM 的 status 图标:纯文本 [x]/[>]/[ ](不是 unicode 字符)。
function statusLabel(status: TurnPlanStep['status']): string {
  if (status === 'completed') return '[x]'
  if (status === 'inProgress') return '[>]'
  return '[ ]'
}

function formatProgress(plan: TurnPlan): string {
  const total = plan.steps.length
  if (!total) return ''
  const completed = plan.steps.filter((s) => s.status === 'completed').length
  return `${completed}/${total}`
}

export function PlanPanel() {
  const threadPlan = useRuntimeStore((s) => s.threadPlan)
  const isProcessing = useRuntimeStore((s) => s.ready)

  const progress = threadPlan ? formatProgress(threadPlan) : ''
  const steps = threadPlan?.steps ?? []
  const showEmpty = steps.length === 0 && !threadPlan?.explanation
  const emptyLabel = isProcessing ? 'Waiting on a plan...' : 'No active plan.'

  return (
    <aside className="plan-panel">
      <div className="plan-header">
        <span>Plan</span>
        {progress && <span className="plan-progress">{progress}</span>}
      </div>
      {threadPlan?.explanation && (
        <div className="plan-explanation">{threadPlan.explanation}</div>
      )}
      {showEmpty ? (
        <div className="plan-empty">{emptyLabel}</div>
      ) : (
        <ol className="plan-list">
          {steps.map((step, index) => (
            <li key={`${step.step}-${index}`} className={`plan-step ${step.status}`}>
              <span className="plan-step-status" aria-hidden>
                {statusLabel(step.status)}
              </span>
              <span className="plan-step-text">{step.step}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
