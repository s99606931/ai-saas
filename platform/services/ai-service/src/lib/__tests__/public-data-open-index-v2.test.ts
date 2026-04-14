import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataOpenIndexV2 } from '../public-data-open-index-v2'

describe('PublicDataOpenIndexV2', () => {
  let indexer: PublicDataOpenIndexV2
  beforeEach(() => { indexer = new PublicDataOpenIndexV2() })

  it('데이터셋 등록 후 조회', () => {
    const ds = indexer.registerDataset('ds-1', '민원DB', '행안부', 10000)
    expect(ds.datasetId).toBe('ds-1')
    expect(ds.totalRecords).toBe(10000)
  })

  it('개방 정보 없으면 개방 지수 0', () => {
    indexer.registerDataset('ds-1', '민원DB', '행안부', 10000)
    expect(indexer.getOpenIndex('ds-1')).toBe(0)
  })

  it('개방 지수 50%', () => {
    indexer.registerDataset('ds-1', '민원DB', '행안부', 1000)
    indexer.recordOpenData('ds-1', 500, ['csv', 'json'])
    expect(indexer.getOpenIndex('ds-1')).toBe(50)
  })

  it('개방 지수 100%', () => {
    indexer.registerDataset('ds-1', '민원DB', '행안부', 1000)
    indexer.recordOpenData('ds-1', 1000, ['csv'])
    expect(indexer.getOpenIndex('ds-1')).toBe(100)
  })

  it('getLowOpenDatasets: openIndex < 50', () => {
    indexer.registerDataset('ds-1', 'A', '기관', 1000)
    indexer.registerDataset('ds-2', 'B', '기관', 1000)
    indexer.recordOpenData('ds-1', 300, ['csv'])
    indexer.recordOpenData('ds-2', 800, ['csv'])
    const low = indexer.getLowOpenDatasets()
    expect(low.map(d => d.datasetId)).toContain('ds-1')
    expect(low.map(d => d.datasetId)).not.toContain('ds-2')
  })

  it('C등급 데이터 전송 차단', () => {
    indexer.registerDataset('ds-1', '민원DB', '행안부', 1000)
    expect(() => indexer.recordOpenData('ds-1', 500, ['csv'], 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    indexer.registerDataset('ds-1', '민원DB', '행안부', 1000)
    expect(() => indexer.recordOpenData('ds-1', 500, ['csv'], 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    indexer.registerDataset('ds-1', '민원DB', '행안부', 1000)
    indexer.recordOpenData('ds-1', 500, ['csv'])
    expect(indexer.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
