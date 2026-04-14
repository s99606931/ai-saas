import { describe, it, expect, beforeEach } from 'vitest'
import { PublicDataQualityPredictorV2 } from '../public-data-quality-predictor-v2'

describe('PublicDataQualityPredictorV2', () => {
  let predictor: PublicDataQualityPredictorV2

  beforeEach(() => { predictor = new PublicDataQualityPredictorV2() })

  it('should register a dataset with 0 initial score', () => {
    predictor.registerDataset('ds1', 'Population', 'census')
    expect(predictor.getQualityScore('ds1')).toBe(0)
  })

  it('should compute quality score as (completeness+accuracy)/2 of latest record', () => {
    predictor.registerDataset('ds1', 'Pop', 'census')
    predictor.recordQuality('ds1', 80, 90)
    expect(predictor.getQualityScore('ds1')).toBe(85)
  })

  it('should use only the latest record for score', () => {
    predictor.registerDataset('ds1', 'Pop', 'census')
    predictor.recordQuality('ds1', 100, 100) // ignored
    predictor.recordQuality('ds1', 60, 70)   // latest
    expect(predictor.getQualityScore('ds1')).toBe(65)
  })

  it('should identify low quality datasets (score < 70)', () => {
    predictor.registerDataset('ds1', 'Low', 'x')
    predictor.registerDataset('ds2', 'High', 'x')
    predictor.recordQuality('ds1', 50, 60) // 55
    predictor.recordQuality('ds2', 80, 90) // 85
    const low = predictor.getLowQualityDatasets()
    expect(low.map((d: { datasetId: string }) => d.datasetId)).toContain('ds1')
    expect(low.map((d: { datasetId: string }) => d.datasetId)).not.toContain('ds2')
  })

  it('should block C grade data', () => {
    predictor.registerDataset('ds1', 'X', 'x')
    expect(() => predictor.recordQuality('ds1', 80, 80, 'C')).toThrow('BLOCKED')
  })

  it('should block S grade data', () => {
    predictor.registerDataset('ds1', 'X', 'x')
    expect(() => predictor.recordQuality('ds1', 80, 80, 'S')).toThrow('BLOCKED')
  })

  it('should maintain audit log', () => {
    predictor.registerDataset('ds1', 'X', 'x')
    predictor.recordQuality('ds1', 75, 80)
    expect(predictor.getAuditLog().length).toBeGreaterThan(0)
  })
})
