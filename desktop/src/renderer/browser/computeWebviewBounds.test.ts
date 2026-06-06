// desktop/src/renderer/browser/computeWebviewBounds.test.ts

import { describe, expect, test } from 'vitest'
import { computeWebviewBounds } from './computeWebviewBounds'

describe('computeWebviewBounds 坐标换算测试', () => {
  test('应该能将 DOMRect 的浮点数值取整并过滤高度宽度为负数的值', () => {
    // 模拟常规 DOMRect 坐标
    const rect1 = {
      left: 10.4,
      top: 20.6,
      width: 100.2,
      height: 200.7,
      right: 110.6,
      bottom: 221.3,
      x: 10.4,
      y: 20.6,
      toJSON: () => {}
    } as DOMRect

    const result1 = computeWebviewBounds(rect1)
    expect(result1.x).toBe(10) // 10.4 四舍五入为 10
    expect(result1.y).toBe(21) // 20.6 四舍五入为 21
    expect(result1.width).toBe(100) // 100.2 四舍五入为 100
    expect(result1.height).toBe(201) // 200.7 四舍五入为 2101 (此处四舍五入为 201)

    // 模拟负数尺寸防错处理
    const rect2 = {
      left: 0,
      top: 0,
      width: -50,
      height: -100,
      right: -50,
      bottom: -100,
      x: 0,
      y: 0,
      toJSON: () => {}
    } as DOMRect

    const result2 = computeWebviewBounds(rect2)
    expect(result2.width).toBe(0) // 宽度负数应该被 Math.max(0) 规避，限制在 0
    expect(result2.height).toBe(0) // 高度负数应该被 Math.max(0) 规避，限制在 0
  })
})
