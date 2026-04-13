// Design Ref: §R416 — AI기반 공공 데이터 활용 지수 산출
import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataUtilizationIndexAi } from '../public-data-utilization-index-ai'

describe('PublicDataUtilizationIndexAi', () => {
  let service: PublicDataUtilizationIndexAi

  beforeEach(() => {
    service = new PublicDataUtilizationIndexAi()
  })

  it('N2SF: C등급 데이터 등록 차단', () => {
    expect(() => service.registerDataset({ datasetId: 'ds-c', name: '기밀', category: 'gov', dataGrade: 'C', accessCount: 100, downloadCount: 50, lastAccessedAt: '2026-04-01' }))
      .toThrow('BLOCKED')
  })

  it('N2SF: S등급 데이터 등록 차단', () => {
    expect(() => service.registerDataset({ datasetId: 'ds-s', name: '보안', category: 'gov', dataGrade: 'S', accessCount: 100, downloadCount: 50, lastAccessedAt: '2026-04-01' }))
      .toThrow('BLOCKED')
  })

  it('HIGH_UTILIZATION: 접근/다운로드 최대값 → 100점', () => {
    service.registerDataset({ datasetId: 'ds-1', name: '인기 데이터', category: 'economy', dataGrade: 'O', accessCount: 1000, downloadCount: 500, lastAccessedAt: '2026-04-01' })
    const report = service.calculate()
    expect(report.datasets[0]?.utilizationLevel).toBe('HIGH_UTILIZATION')
  })

  it('LOW_UTILIZATION: 접근/다운로드 0 → 저활용', () => {
    service.registerDataset({ datasetId: 'ds-high', name: '기준', category: 'economy', dataGrade: 'O', accessCount: 1000, downloadCount: 500, lastAccessedAt: '2026-04-01' })
    service.registerDataset({ datasetId: 'ds-low', name: '비인기', category: 'economy', dataGrade: 'O', accessCount: 0, downloadCount: 0, lastAccessedAt: '2026-04-01' })
    const report = service.calculate()
    expect(report.lowUtilizationDatasets).toContain('ds-low')
  })

  it('빈 데이터셋: 평균 점수 0', () => {
    const report = service.calculate()
    expect(report.totalDatasets).toBe(0)
    expect(report.averageScore).toBe(0)
  })

  it('권고사항: LOW_UTILIZATION → 홍보 강화 권고', () => {
    service.registerDataset({ datasetId: 'ds-max', name: '최대', category: 'test', dataGrade: 'O', accessCount: 100, downloadCount: 100, lastAccessedAt: '2026-04-01' })
    service.registerDataset({ datasetId: 'ds-zero', name: '제로', category: 'test', dataGrade: 'O', accessCount: 0, downloadCount: 0, lastAccessedAt: '2026-04-01' })
    const report = service.calculate()
    const lowDs = report.datasets.find((d) => d.datasetId === 'ds-zero')
    expect(lowDs?.recommendations.some((r) => r.includes('홍보'))).toBe(true)
  })

  it('감사 로그에 utilization.calculate 기록', () => {
    service.calculate()
    const logs = service.getAuditLog()
    expect(logs.some((l) => l.action === 'utilization.calculate')).toBe(true)
  })
})
