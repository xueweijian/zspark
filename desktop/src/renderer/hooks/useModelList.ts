import { useCallback, useEffect, useRef } from 'react'
import { send } from '../ipc'
import { useRuntimeStore, type ModelOption } from '../store/runtimeStore'

/**
 * 拉取 codex app-server 的模型候选列表(model/list RPC),写入 runtimeStore.modelList。
 * 在 codex 进程 ready 后拉一次;提供 refresh 手动刷新。
 *
 * 关键(仿 CM):把 providerModel(用户在设置面板配的第三方 model)作为兜底 option
 * 强制塞进列表。这样即使 model/list 返回空 / 不含第三方模型(provider 不支持 model/list,
 * 或 provider 注入失败),输入框下拉也能选到它,不会被禁用、不会落到 config 默认模型。
 *
 * 失败时静默(model/list 可能因 provider 不支持而失败,不影响其他功能)。
 */
export function useModelList(ready: boolean, providerModel?: string | null) {
  const setModelList = useRuntimeStore((s) => s.setModelList)
  const fetchedRef = useRef(false)

  const fetchModels = useCallback(async () => {
    let list: ModelOption[] = []
    try {
      const res = await send('model/list', {})
      const data = res?.result?.data ?? res?.data ?? []
      if (Array.isArray(data)) {
        list = data as ModelOption[]
      }
    } catch (err) {
      // model/list 失败不致命(某些 provider 不支持),静默处理。
      console.warn('model/list failed:', err)
    }

    // 兜底:若用户在设置面板配了第三方 providerModel,且 model/list 没返回它,则强制补一个 option。
    // 这样下拉框永远能选到设置配的模型(即使 provider 不支持 model/list)。
    const trimmedProviderModel = providerModel?.trim()
    if (trimmedProviderModel) {
      const providerModelInList = list.some(
        (m) => m.id === trimmedProviderModel || m.model === trimmedProviderModel,
      )
      if (!providerModelInList) {
        list = [
          ...list,
          { id: trimmedProviderModel, model: trimmedProviderModel, display_name: trimmedProviderModel },
        ]
      }
    }

    setModelList(list)
  }, [setModelList, providerModel])

  useEffect(() => {
    if (!ready || fetchedRef.current) return
    fetchedRef.current = true
    void fetchModels()
  }, [ready, fetchModels])

  // providerModel 变化时(用户改了设置)也重拉一次,确保兜底 option 跟着更新。
  useEffect(() => {
    if (ready) void fetchModels()
  }, [providerModel, ready, fetchModels])

  return { refresh: fetchModels }
}
