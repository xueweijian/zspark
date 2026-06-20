import { useCallback, useEffect, useRef } from 'react'
import { send } from '../ipc'
import { useRuntimeStore, type ModelOption } from '../store/runtimeStore'

/**
 * 拉取 codex app-server 的模型候选列表(model/list RPC),写入 runtimeStore.modelList。
 * 在 codex 进程 ready 后拉一次;提供 refresh 手动刷新。
 * 失败时静默(model/list 可能因 provider 不支持而失败,不影响其他功能)。
 */
export function useModelList(ready: boolean) {
  const setModelList = useRuntimeStore((s) => s.setModelList)
  const fetchedRef = useRef(false)

  const fetchModels = useCallback(async () => {
    try {
      const res = await send('model/list', {})
      const data = res?.result?.data ?? res?.data ?? []
      if (Array.isArray(data)) {
        setModelList(data as ModelOption[])
      }
    } catch (err) {
      // model/list 失败不致命(某些 provider 不支持),静默处理。
      console.warn('model/list failed:', err)
    }
  }, [setModelList])

  useEffect(() => {
    if (!ready || fetchedRef.current) return
    fetchedRef.current = true
    void fetchModels()
  }, [ready, fetchModels])

  return { refresh: fetchModels }
}
