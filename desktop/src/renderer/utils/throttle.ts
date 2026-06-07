/**
 * Throttle function that limits how often a function can be called.
 * Uses requestAnimationFrame for smooth 60fps updates when available,
 * falls back to setTimeout for non-browser environments.
 */

type ThrottledFunction<T extends (...args: any[]) => void> = {
  (...args: Parameters<T>): void
  cancel: () => void
  flush: () => void
}

export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): ThrottledFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null
  let lastCallTime = 0

  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
      lastCallTime = Date.now()
    }
  }

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args
    const now = Date.now()
    const timeSinceLastCall = now - lastCallTime

    if (timeSinceLastCall >= delay) {
      // Enough time has passed, invoke immediately
      invoke()
    } else if (!timeoutId) {
      // Schedule invocation for the remaining time
      const remaining = delay - timeSinceLastCall
      timeoutId = setTimeout(() => {
        timeoutId = null
        invoke()
      }, remaining)
    }
  }) as ThrottledFunction<T>

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  throttled.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    invoke()
  }

  return throttled
}

/**
 * Batch throttle that collects calls and invokes once with the latest args.
 * Useful for batching state updates in React.
 */
export function batchThrottle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): ThrottledFunction<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastArgs: Parameters<T> | null = null

  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs)
      lastArgs = null
    }
  }

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        timeoutId = null
        invoke()
      }, delay)
    }
  }) as ThrottledFunction<T>

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    lastArgs = null
  }

  throttled.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    invoke()
  }

  return throttled
}
