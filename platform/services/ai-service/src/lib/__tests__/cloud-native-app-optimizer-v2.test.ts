import { describe, it, expect, beforeEach } from 'vitest'
import { CloudNativeAppOptimizerV2 } from '../cloud-native-app-optimizer-v2'

describe('CloudNativeAppOptimizerV2', () => {
  let optimizer: CloudNativeAppOptimizerV2
  beforeEach(() => { optimizer = new CloudNativeAppOptimizerV2() })

  it('앱 등록 후 조회', () => {
    const app = optimizer.registerApp('app-1', '민원앱', 'spring', 3)
    expect(app.appId).toBe('app-1')
    expect(app.replicaCount).toBe(3)
  })

  it('사용률 없으면 optimal', () => {
    optimizer.registerApp('app-1', '민원앱', 'spring', 3)
    expect(optimizer.getOptimizationRecommendation('app-1')).toBe('optimal')
  })

  it('scale-up: cpu > 70', () => {
    optimizer.registerApp('app-1', '민원앱', 'spring', 3)
    optimizer.recordUsage('app-1', 80, 50)
    expect(optimizer.getOptimizationRecommendation('app-1')).toBe('scale-up')
  })

  it('scale-down: cpu < 30 AND mem < 30', () => {
    optimizer.registerApp('app-1', '민원앱', 'spring', 3)
    optimizer.recordUsage('app-1', 10, 20)
    expect(optimizer.getOptimizationRecommendation('app-1')).toBe('scale-down')
  })

  it('optimal: 중간 사용률', () => {
    optimizer.registerApp('app-1', '민원앱', 'spring', 3)
    optimizer.recordUsage('app-1', 50, 50)
    expect(optimizer.getOptimizationRecommendation('app-1')).toBe('optimal')
  })

  it('getOverProvisionedApps: scale-down 앱만', () => {
    optimizer.registerApp('app-1', '과다', 'spring', 3)
    optimizer.registerApp('app-2', '정상', 'spring', 3)
    optimizer.recordUsage('app-1', 5, 5)
    optimizer.recordUsage('app-2', 60, 60)
    const over = optimizer.getOverProvisionedApps()
    expect(over.map(a => a.appId)).toContain('app-1')
    expect(over.map(a => a.appId)).not.toContain('app-2')
  })

  it('C등급 데이터 전송 차단', () => {
    optimizer.registerApp('app-1', '민원앱', 'spring', 3)
    expect(() => optimizer.recordUsage('app-1', 50, 50, 'C')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    optimizer.registerApp('app-1', '민원앱', 'spring', 3)
    optimizer.recordUsage('app-1', 50, 50)
    expect(optimizer.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
