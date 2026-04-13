import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataLifecycleManagerV2 } from '../public-data-lifecycle-manager-v2'

describe('PublicDataLifecycleManagerV2', () => {
  let manager: PublicDataLifecycleManagerV2

  beforeEach(() => {
    manager = new PublicDataLifecycleManagerV2()
  })

  it('데이터 등록 후 active 상태', () => {
    const data = manager.registerData('data-1', '민원데이터', 'personal', 1)
    expect(data.dataId).toBe('data-1')
    expect(data.status).toBe('active')
  })

  it('보존기간 만료 데이터 반환', () => {
    const pastDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString()
    manager.registerData('data-old', '오래된데이터', 'personal', 1, pastDate)
    const expired = manager.getExpiredData()
    expect(expired.map((d) => d.dataId)).toContain('data-old')
  })

  it('미만료 데이터는 만료 목록에 포함 안됨', () => {
    manager.registerData('data-new', '최신데이터', 'personal', 10)
    const expired = manager.getExpiredData()
    expect(expired.map((d) => d.dataId)).not.toContain('data-new')
  })

  it('disposeData 후 disposed 상태', () => {
    manager.registerData('data-1', '민원데이터', 'personal', 1)
    manager.disposeData('data-1')
    const active = manager.getActiveData()
    expect(active.map((d) => d.dataId)).not.toContain('data-1')
  })

  it('getActiveData: active 상태만 반환', () => {
    manager.registerData('data-1', 'A', 'personal', 10)
    manager.registerData('data-2', 'B', 'personal', 10)
    manager.disposeData('data-1')
    const active = manager.getActiveData()
    expect(active.map((d) => d.dataId)).toContain('data-2')
    expect(active.map((d) => d.dataId)).not.toContain('data-1')
  })

  it('C등급 데이터 전송 차단', () => {
    manager.registerData('data-1', '민원데이터', 'personal', 1)
    expect(() => manager.disposeData('data-1', 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    manager.registerData('data-1', '민원데이터', 'personal', 1)
    expect(() => manager.disposeData('data-1', 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    manager.registerData('data-1', '민원데이터', 'personal', 1)
    manager.disposeData('data-1')
    const log = manager.getAuditLog()
    expect(log.length).toBeGreaterThanOrEqual(2)
  })
})
