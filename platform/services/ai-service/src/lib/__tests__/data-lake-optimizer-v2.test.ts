// Plan SC: SVC-AI-ADV-R457-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { DataLakeOptimizerV2, type DataLakeObject } from '../data-lake-optimizer-v2'

describe('DataLakeOptimizerV2', () => {
  let optimizer: DataLakeOptimizerV2

  beforeEach(() => {
    optimizer = new DataLakeOptimizerV2()
  })

  const hotObj: DataLakeObject = {
    objectId: 'OBJ-1',
    sizeBytes: 1024 * 1024 * 1024,  // 1GB
    storageTier: 'HOT',
    lastAccessedDaysAgo: 5,
    accessFrequencyPerMonth: 20,
    grade: 'O',
    compressed: false,
  }

  it('N2SF: C등급 객체 등록 차단', () => {
    expect(() => optimizer.registerObject({ ...hotObj, objectId: 'O-C', grade: 'C' })).toThrow('BLOCKED')
  })

  it('N2SF: S등급 객체 등록 차단', () => {
    expect(() => optimizer.registerObject({ ...hotObj, objectId: 'O-S', grade: 'S' })).toThrow('BLOCKED')
  })

  it('객체 없을 때 빈 결과', () => {
    const report = optimizer.optimize()
    expect(report.totalObjects).toBe(0)
    expect(report.recommendations).toHaveLength(0)
  })

  it('HOT 티어 90일 이상 미접근 → MOVE_TO_COLD 권장', () => {
    optimizer.registerObject({ ...hotObj, objectId: 'OBJ-COLD', lastAccessedDaysAgo: 100, accessFrequencyPerMonth: 0 })
    const report = optimizer.optimize()
    const rec = report.recommendations.find((r) => r.objectId === 'OBJ-COLD')
    expect(rec?.action).toBe('MOVE_TO_COLD')
    expect(rec?.estimatedSavingKrw).toBeGreaterThan(0)
  })

  it('HOT 티어 30~90일 미접근 → MOVE_TO_WARM 권장', () => {
    optimizer.registerObject({ ...hotObj, objectId: 'OBJ-WARM', lastAccessedDaysAgo: 45, accessFrequencyPerMonth: 2 })
    const report = optimizer.optimize()
    const rec = report.recommendations.find((r) => r.objectId === 'OBJ-WARM')
    expect(rec?.action).toBe('MOVE_TO_WARM')
  })

  it('활성 HOT 2GB 비압축 → COMPRESS 권장', () => {
    optimizer.registerObject({ ...hotObj, objectId: 'OBJ-COMPRESS', sizeBytes: 2 * 1024 * 1024 * 1024, compressed: false })
    const report = optimizer.optimize()
    const rec = report.recommendations.find((r) => r.objectId === 'OBJ-COMPRESS')
    expect(rec?.action).toBe('COMPRESS')
  })

  it('WARM 180일 이상 미접근 → ARCHIVE 권장', () => {
    optimizer.registerObject({ ...hotObj, objectId: 'OBJ-ARCH', storageTier: 'WARM', lastAccessedDaysAgo: 200 })
    const report = optimizer.optimize()
    const rec = report.recommendations.find((r) => r.objectId === 'OBJ-ARCH')
    expect(rec?.action).toBe('ARCHIVE')
  })

  it('estimatedTotalSavingKrw 합산 정확', () => {
    optimizer.registerObject({ ...hotObj, objectId: 'O1', lastAccessedDaysAgo: 100, accessFrequencyPerMonth: 0 })
    optimizer.registerObject({ ...hotObj, objectId: 'O2', storageTier: 'WARM', lastAccessedDaysAgo: 200 })
    const report = optimizer.optimize()
    const sum = report.recommendations.reduce((s, r) => s + r.estimatedSavingKrw, 0)
    expect(report.estimatedTotalSavingKrw).toBe(sum)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerObject(hotObj)
    optimizer.optimize()
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', objectId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
