import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import {
  pending,
  rejectPendingRequests,
  send,
  sendRpcResult,
  sendRpcError,
  isMissingRolloutError,
  shouldAutoToastRpcError,
  errorMessage
} from './ipc'

describe('ipc', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      zspark: {
        send: vi.fn(),
      },
    })
    pending.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('send', () => {
    test('successfully sends message and resolves when pending is resolved externally', async () => {
      const mockSend = vi.mocked(window.zspark.send)
      mockSend.mockResolvedValue(true)

      const promise = send('testMethod', { foo: 'bar' })

      // Verify window.zspark.send was called with correct payload
      expect(mockSend).toHaveBeenCalledTimes(1)
      const sentPayload = JSON.parse(mockSend.mock.calls[0][0])
      expect(sentPayload.jsonrpc).toBe('2.0')
      expect(sentPayload.method).toBe('testMethod')
      expect(sentPayload.params).toEqual({ foo: 'bar' })
      expect(typeof sentPayload.id).toBe('number')

      const id = sentPayload.id
      expect(pending.has(id)).toBe(true)

      // Resolve the pending promise externally
      pending.get(id)?.resolve('mockResult')

      const result = await promise
      expect(result).toBe('mockResult')
    })

    test('rejects with error when window.zspark.send returns false', async () => {
      const mockSend = vi.mocked(window.zspark.send)
      mockSend.mockResolvedValue(false)

      const promise = send('testMethod', { foo: 'bar' })

      expect(mockSend).toHaveBeenCalledTimes(1)
      const sentPayload = JSON.parse(mockSend.mock.calls[0][0])
      const id = sentPayload.id

      await expect(promise).rejects.toThrow('Codex process is not running')
      expect(pending.has(id)).toBe(false)
    })

    test('rejects with error when window.zspark.send throws/rejects', async () => {
      const mockSend = vi.mocked(window.zspark.send)
      const testError = new Error('IPC sending failure')
      mockSend.mockRejectedValue(testError)

      const promise = send('testMethod', { foo: 'bar' })

      expect(mockSend).toHaveBeenCalledTimes(1)
      const sentPayload = JSON.parse(mockSend.mock.calls[0][0])
      const id = sentPayload.id

      await expect(promise).rejects.toThrow('IPC sending failure')
      expect(pending.has(id)).toBe(false)
    })
  })

  describe('rejectPendingRequests', () => {
    test('rejects all pending requests and clears the map', () => {
      const rejectMock1 = vi.fn()
      const resolveMock1 = vi.fn()
      const rejectMock2 = vi.fn()
      const resolveMock2 = vi.fn()

      pending.set(1, { resolve: resolveMock1, reject: rejectMock1 })
      pending.set(2, { resolve: resolveMock2, reject: rejectMock2 })

      rejectPendingRequests('Terminated')

      expect(rejectMock1).toHaveBeenCalledTimes(1)
      expect(rejectMock1).toHaveBeenCalledWith(expect.any(Error))
      expect(rejectMock1.mock.calls[0][0].message).toBe('Terminated')

      expect(rejectMock2).toHaveBeenCalledTimes(1)
      expect(rejectMock2).toHaveBeenCalledWith(expect.any(Error))
      expect(rejectMock2.mock.calls[0][0].message).toBe('Terminated')

      expect(pending.size).toBe(0)
    })

    test('does nothing when pending map is empty', () => {
      expect(() => rejectPendingRequests('Terminated')).not.toThrow()
    })
  })

  describe('sendRpcResult', () => {
    test('sends successful jsonrpc result payload', async () => {
      const mockSend = vi.mocked(window.zspark.send)
      mockSend.mockResolvedValue(true)

      await sendRpcResult(42, { success: true })

      expect(mockSend).toHaveBeenCalledTimes(1)
      const sentPayload = JSON.parse(mockSend.mock.calls[0][0])
      expect(sentPayload).toEqual({
        jsonrpc: '2.0',
        id: 42,
        result: { success: true }
      })
    })
  })

  describe('sendRpcError', () => {
    test('sends jsonrpc error payload', async () => {
      const mockSend = vi.mocked(window.zspark.send)
      mockSend.mockResolvedValue(true)

      await sendRpcError(42, -32600, 'Invalid Request')

      expect(mockSend).toHaveBeenCalledTimes(1)
      const sentPayload = JSON.parse(mockSend.mock.calls[0][0])
      expect(sentPayload).toEqual({
        jsonrpc: '2.0',
        id: 42,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
      })
    })
  })

  describe('isMissingRolloutError', () => {
    test('returns true for messages starting with no rollout found for thread id', () => {
      expect(isMissingRolloutError('no rollout found for thread id 123')).toBe(true)
      expect(isMissingRolloutError('no rollout found for thread id')).toBe(true)
    })

    test('returns false for other messages', () => {
      expect(isMissingRolloutError('no rollout found for thread')).toBe(false)
      expect(isMissingRolloutError('random error')).toBe(false)
      expect(isMissingRolloutError(undefined)).toBe(false)
      expect(isMissingRolloutError('')).toBe(false)
    })
  })

  describe('shouldAutoToastRpcError', () => {
    test('returns false for ignored errors', () => {
      expect(shouldAutoToastRpcError('Not initialized')).toBe(false)
      expect(shouldAutoToastRpcError('Already initialized')).toBe(false)
    })

    test('returns false for missing rollout errors', () => {
      expect(shouldAutoToastRpcError('no rollout found for thread id abc')).toBe(false)
    })

    test('returns false for falsy/empty messages', () => {
      expect(shouldAutoToastRpcError(undefined)).toBe(false)
      expect(shouldAutoToastRpcError('')).toBe(false)
    })

    test('returns true for all other valid error messages', () => {
      expect(shouldAutoToastRpcError('Failed to fetch resource')).toBe(true)
      expect(shouldAutoToastRpcError('Internal error')).toBe(true)
    })
  })

  describe('errorMessage', () => {
    test('extracts message from Error object', () => {
      expect(errorMessage(new Error('something went wrong'))).toBe('something went wrong')
    })

    test('stringifies objects without message property', () => {
      expect(errorMessage({ code: 500 })).toBe('[object Object]')
    })

    test('stringifies primitives', () => {
      expect(errorMessage('error string')).toBe('error string')
      expect(errorMessage(404)).toBe('404')
      expect(errorMessage(null)).toBe('null')
      expect(errorMessage(undefined)).toBe('undefined')
    })
  })
})
