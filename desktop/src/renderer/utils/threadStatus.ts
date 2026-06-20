// 会话状态点分类 —— 对齐 CM(CodexMonitor)的 thread-status 四态。
//
// 数据来源:
//   - thread.status:codex 的 thread/status/changed 事件维护(`{ type, activeFlags? }`)
//   - thread.unread:客户端标记(后台 thread 收到 agent 完成消息时置位)
//
// 优先级(参考 CM utils/threadStatus.ts:11-28):
//   reviewing(active + waitingOnApproval/waitingOnUserInput) > processing(active) > unread > ready
//
// 备注:CM 的 reviewing 走 enteredReviewMode item,我们改用协议的 activeFlags
// 现成信号(waitingOnApproval),语义更接近"等待审批/输入",且无需额外消费 item 事件。
import type { ThreadSummary } from '../appTypes'

export type ThreadStatusClass = 'processing' | 'reviewing' | 'unread' | 'ready'

export function getThreadStatusClass(thread: ThreadSummary | undefined | null): ThreadStatusClass {
  if (!thread) return 'ready'
  const status = thread.status
  if (status?.type === 'active') {
    const flags = status.activeFlags ?? []
    // 等待审批/用户输入 → 最高优先级(reviewing 态)
    if (flags.includes('waitingOnApproval') || flags.includes('waitingOnUserInput')) {
      return 'reviewing'
    }
    return 'processing'
  }
  if (thread.unread) return 'unread'
  return 'ready'
}

export const THREAD_STATUS_LABELS: Record<ThreadStatusClass, string> = {
  processing: '运行中',
  reviewing: '等待审批',
  unread: '有新消息',
  ready: '就绪',
}
