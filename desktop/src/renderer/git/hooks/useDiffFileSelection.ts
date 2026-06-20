// desktop/src/renderer/git/hooks/useDiffFileSelection.ts

import { useState, useCallback } from 'react'

interface DiffFileSelectionResult {
  selectedFiles: Set<string>
  handleFileClick: (path: string, event: { ctrlKey: boolean; metaKey: boolean }) => void
  clearSelection: () => void
}

export function useDiffFileSelection(files: { path: string }[]): DiffFileSelectionResult {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  const handleFileClick = useCallback(
    (path: string, event: { ctrlKey: boolean; metaKey: boolean }) => {
      const multiSelect = event.ctrlKey || event.metaKey
      setSelectedFiles((prev) => {
        if (multiSelect) {
          const next = new Set(prev)
          if (next.has(path)) {
            next.delete(path)
          } else {
            next.add(path)
          }
          return next
        }
        // Single click: select only this file
        if (prev.size === 1 && prev.has(path)) return prev
        return new Set([path])
      })
    },
    [],
  )

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set())
  }, [])

  return { selectedFiles, handleFileClick, clearSelection }
}
