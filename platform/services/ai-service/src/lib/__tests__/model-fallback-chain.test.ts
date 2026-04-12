/**
 * Tests — SVC-AI-ADV-R149 Model Fallback Chain
 */

import { describe, it, expect } from 'vitest'
import { ModelFallbackChain } from '../model-fallback-chain'

function makeChain() {
  let t = 1_700_000_000_000
  return {
    chain: new ModelFallbackChain({
      now: () => t,
      defaultCooldownMs: 1000,
    }),
    advance: (ms: number) => {
      t += ms
    },
    nowRef: () => t,
  }
}

describe('ModelFallbackChain', () => {
  it('1순위 성공 → 바로 반환', async () => {
    const { chain } = makeChain()
    chain.register('gpt-4', 1)
    chain.register('claude', 2)
    const result = await chain.execute({ grade: 'O' }, async (m) => `ok:${m}`)
    expect(result.modelId).toBe('gpt-4')
    expect(result.result).toBe('ok:gpt-4')
    expect(result.attempts.length).toBe(0)
  })

  it('1순위 실패 → 2순위 성공', async () => {
    const { chain } = makeChain()
    chain.register('a', 1)
    chain.register('b', 2)
    const result = await chain.execute({}, async (m) => {
      if (m === 'a') throw new Error('a_down')
      return 'b_ok'
    })
    expect(result.modelId).toBe('b')
    expect(result.attempts.length).toBe(1)
    expect(result.attempts[0]!.modelId).toBe('a')
  })

  it('전체 실패 → chain_exhausted', async () => {
    const { chain } = makeChain()
    chain.register('a', 1)
    chain.register('b', 2)
    await expect(
      chain.execute({}, async () => {
        throw new Error('down')
      }),
    ).rejects.toThrow('chain_exhausted')
  })

  it('빈 체인 no_models', async () => {
    const { chain } = makeChain()
    await expect(chain.execute({}, async () => 'x')).rejects.toThrow('no_models')
  })

  it('markUnhealthy 후 skip', async () => {
    const { chain } = makeChain()
    chain.register('a', 1)
    chain.register('b', 2)
    chain.markUnhealthy('a', 5000)
    const result = await chain.execute({}, async (m) => m)
    expect(result.modelId).toBe('b')
  })

  it('cooldown 경과 후 재사용', async () => {
    const { chain, advance } = makeChain()
    chain.register('a', 1)
    chain.markUnhealthy('a', 1000)
    expect(chain.isHealthy('a')).toBe(false)
    advance(1500)
    expect(chain.isHealthy('a')).toBe(true)
  })

  it('우선순위 정렬 (낮을수록 먼저)', async () => {
    const { chain } = makeChain()
    chain.register('high', 10)
    chain.register('low', 1)
    const result = await chain.execute({}, async (m) => m)
    expect(result.modelId).toBe('low')
  })

  it('동일 우선순위 tiebreaker localeCompare', async () => {
    const { chain } = makeChain()
    chain.register('b-model', 1)
    chain.register('a-model', 1)
    const result = await chain.execute({}, async (m) => m)
    expect(result.modelId).toBe('a-model')
  })

  it('중복 register 거부', () => {
    const { chain } = makeChain()
    chain.register('a', 1)
    expect(() => chain.register('a', 2)).toThrow('duplicate_model')
  })

  it('실패 후 자동 unhealthy 표시', async () => {
    const { chain } = makeChain()
    chain.register('a', 1)
    chain.register('b', 2)
    await chain.execute({}, async (m) => {
      if (m === 'a') throw new Error('x')
      return m
    })
    expect(chain.isHealthy('a')).toBe(false)
  })

  it('빈 modelId 거부', () => {
    const { chain } = makeChain()
    expect(() => chain.register('', 1)).toThrow('invalid_input')
  })

  it('markUnhealthy 미등록 모델 not_found', () => {
    const { chain } = makeChain()
    expect(() => chain.markUnhealthy('ghost')).toThrow('not_found')
  })

  it('C/S등급 차단', async () => {
    const { chain } = makeChain()
    chain.register('a', 1)
    await expect(chain.execute({ grade: 'C' }, async (m) => m)).rejects.toThrow('grade_blocked')
    await expect(chain.execute({ grade: 'S' }, async (m) => m)).rejects.toThrow('grade_blocked')
  })

  it('getAuditLog', async () => {
    const { chain } = makeChain()
    chain.register('a', 1)
    await chain.execute({}, async (m) => m)
    const log = chain.getAuditLog()
    expect(log.some((e) => e.event === 'model_registered')).toBe(true)
    expect(log.some((e) => e.event === 'execute_success')).toBe(true)
  })

  it('list 반환', () => {
    const { chain } = makeChain()
    chain.register('a', 1)
    chain.register('b', 2)
    expect(chain.list().length).toBe(2)
  })
})
