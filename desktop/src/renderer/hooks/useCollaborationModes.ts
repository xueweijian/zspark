import { useCallback, useEffect, useRef } from 'react'
import { send } from '../ipc'
import { useRuntimeStore, type CollaborationModePreset } from '../store/runtimeStore'

/**
 * 拉取 codex app-server 的协作模式预设(collaborationMode/list RPC,experimental),
 * 写入 runtimeStore.collaborationModes。在 codex ready 后拉一次。
 *
 * 降级策略:collaborationMode/list 是 experimental,若 app-server 未开启对应 gate
 * 会失败。此时 collaborationModes 为空数组,plan toggle 降级为硬编码 plan mask
 * (见 buildCollaborationModePayloadForPlan)。
 */
export function useCollaborationModes(ready: boolean) {
  const setCollaborationModes = useRuntimeStore((s) => s.setCollaborationModes)
  const fetchedRef = useRef(false)

  const fetchModes = useCallback(async () => {
    try {
      const res = await send('collaborationMode/list', {})
      const data = res?.result?.data ?? res?.data ?? []
      if (Array.isArray(data)) {
        setCollaborationModes(data as CollaborationModePreset[])
      }
    } catch (err) {
      // experimental gate 未开启时会失败,静默降级。
      console.warn('collaborationMode/list failed (likely experimental gate off):', err)
      setCollaborationModes([])
    }
  }, [setCollaborationModes])

  useEffect(() => {
    if (!ready || fetchedRef.current) return
    fetchedRef.current = true
    void fetchModes()
  }, [ready, fetchModes])

  return { refresh: fetchModes }
}
