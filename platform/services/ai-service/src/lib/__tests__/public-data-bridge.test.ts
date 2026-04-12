/**
 * 공공 데이터 연계 브릿지 단위 테스트 — SVC-AI-ADV-R155
 * Plan SC: FR-R155.1 ~ FR-R155.5
 */

import { describe, it, expect } from 'vitest'
import { PublicDataBridge, DataGrade } from '../public-data-bridge'

describe('PublicDataBridge — R155', () => {
  it('FR-R155.1: 엔드포인트 등록 및 audit log', () => {
    const bridge = new PublicDataBridge(DataGrade.O, async () => [])
    bridge.registerEndpoint({ id: 'ep1', url: 'https://data.go.kr/api/test', mappings: [] })
    const log = bridge.getAuditLog()
    expect(log[0]?.action).toBe('endpointRegistered')
    expect(log[0]?.endpointId).toBe('ep1')
  })

  it('FR-R155.2: 데이터 패치 및 정규화', async () => {
    const mockData = [{ name: 'test', value: '42' }]
    const bridge = new PublicDataBridge(DataGrade.O, async () => mockData)
    bridge.registerEndpoint({
      id: 'ep1',
      url: 'https://api.example.go.kr/data',
      mappings: [
        { from: 'name', to: 'label' },
        { from: 'value', to: 'amount', transform: 'number' },
      ],
    })
    const result = await bridge.fetch('ep1')
    expect(result.endpointId).toBe('ep1')
    expect(result.normalized[0]).toMatchObject({ label: 'test', amount: 42 })
  })

  it('FR-R155.3: 재시도 — fetchFn 실패 시 retries 횟수 재시도', async () => {
    let callCount = 0
    const bridge = new PublicDataBridge(DataGrade.O, async () => {
      callCount++
      throw new Error('network error')
    })
    bridge.registerEndpoint({ id: 'ep1', url: 'https://api.go.kr', mappings: [], retries: 2 })
    await expect(bridge.fetch('ep1')).rejects.toThrow('network error')
    expect(callCount).toBe(3) // initial + 2 retries
  })

  it('FR-R155.4: PII 마스킹 — 이메일 필드 마스킹', async () => {
    const mockData = [{ email: 'user@example.com', name: 'Hong' }]
    const bridge = new PublicDataBridge(DataGrade.O, async () => mockData)
    bridge.registerEndpoint({
      id: 'ep1',
      url: 'https://api.go.kr',
      mappings: [
        { from: 'email', to: 'contact' },
        { from: 'name', to: 'name' },
      ],
    })
    const result = await bridge.fetch('ep1')
    expect(result.normalized[0]?.contact).toBe('[EMAIL]')
    expect(result.normalized[0]?.name).toBe('Hong')
  })

  it('FR-R155.5: audit log append-only', async () => {
    const bridge = new PublicDataBridge(DataGrade.O, async () => [])
    bridge.registerEndpoint({ id: 'ep1', url: 'https://api.go.kr', mappings: [] })
    const log1 = bridge.getAuditLog()
    ;(log1 as unknown[]).push({ action: 'tampered' })
    const log2 = bridge.getAuditLog()
    expect(log2).toHaveLength(1)
  })

  it('C등급 차단', () => {
    expect(() => new PublicDataBridge(DataGrade.C)).toThrow('BLOCKED')
  })

  it('S등급 차단', () => {
    expect(() => new PublicDataBridge(DataGrade.S)).toThrow('BLOCKED')
  })

  it('빈 id 등록 throw', () => {
    const bridge = new PublicDataBridge(DataGrade.O, async () => [])
    expect(() => bridge.registerEndpoint({ id: '', url: 'https://api.go.kr', mappings: [] })).toThrow('must not be empty')
  })

  it('미등록 엔드포인트 fetch throw', async () => {
    const bridge = new PublicDataBridge(DataGrade.O, async () => [])
    await expect(bridge.fetch('nonexistent')).rejects.toThrow('unknown endpoint')
  })
})
