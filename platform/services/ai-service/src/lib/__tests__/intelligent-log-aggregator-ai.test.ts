// Plan SC: SVC-AI-ADV-R394-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { IntelligentLogAggregatorAI } from '../intelligent-log-aggregator-ai'

describe('IntelligentLogAggregatorAI', () => {
  let aggregator: IntelligentLogAggregatorAI

  beforeEach(() => {
    aggregator = new IntelligentLogAggregatorAI()
  })

  it('N2SF: C등급 로그 수집 차단', () => {
    expect(() =>
      aggregator.ingest({ logId: 'L1', serviceId: 'SVC1', level: 'INFO', message: '테스트', timestamp: Date.now(), grade: 'C' })
    ).toThrow('BLOCKED')
  })

  it('N2SF: S등급 로그 수집 차단', () => {
    expect(() =>
      aggregator.ingest({ logId: 'L2', serviceId: 'SVC1', level: 'INFO', message: '테스트', timestamp: Date.now(), grade: 'S' })
    ).toThrow('BLOCKED')
  })

  it('수집 로그 없을 때 빈 결과 반환', () => {
    const result = aggregator.aggregate('SVC1')
    expect(result.totalLogs).toBe(0)
    expect(result.topPatterns).toHaveLength(0)
    expect(result.anomalyDetected).toBe(false)
  })

  it('FATAL 로그 존재 시 anomalyDetected=true', () => {
    aggregator.ingest({ logId: 'L3', serviceId: 'SVC1', level: 'FATAL', message: '치명적 오류 발생', timestamp: Date.now(), grade: 'O' })
    const result = aggregator.aggregate('SVC1')
    expect(result.anomalyDetected).toBe(true)
    expect(result.fatalCount).toBe(1)
  })

  it('오류율 20% 이상 시 anomalyDetected=true', () => {
    for (let i = 0; i < 8; i++) {
      aggregator.ingest({ logId: `L${i}`, serviceId: 'SVC1', level: 'INFO', message: `정상 메시지 ${i}`, timestamp: Date.now(), grade: 'O' })
    }
    for (let i = 0; i < 2; i++) {
      aggregator.ingest({ logId: `E${i}`, serviceId: 'SVC1', level: 'ERROR', message: `오류 발생 서비스 ${i}`, timestamp: Date.now(), grade: 'O' })
    }
    const result = aggregator.aggregate('SVC1')
    expect(result.anomalyDetected).toBe(true)
  })

  it('패턴 집계: 동일 메시지 첫 5단어 기준 그룹화', () => {
    // 첫 5단어 동일: '사용자 로그인 성공 처리 완료' — 6번째 단어만 다름
    aggregator.ingest({ logId: 'P1', serviceId: 'SVC1', level: 'INFO', message: '사용자 로그인 성공 처리 완료 userId=100', timestamp: Date.now(), grade: 'O' })
    aggregator.ingest({ logId: 'P2', serviceId: 'SVC1', level: 'INFO', message: '사용자 로그인 성공 처리 완료 userId=200', timestamp: Date.now(), grade: 'O' })
    aggregator.ingest({ logId: 'P3', serviceId: 'SVC1', level: 'ERROR', message: '데이터베이스 연결 실패 오류 코드 500', timestamp: Date.now(), grade: 'O' })
    const result = aggregator.aggregate('SVC1')
    const loginPattern = result.topPatterns.find((p) => p.pattern.includes('사용자 로그인 성공 처리 완료'))
    expect(loginPattern?.count).toBe(2)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    aggregator.ingest({ logId: 'A1', serviceId: 'SVC1', level: 'INFO', message: '감사 테스트', timestamp: Date.now(), grade: 'O' })
    aggregator.aggregate('SVC1')
    const log1 = aggregator.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', serviceId: 'X', detail: {} })
    const log2 = aggregator.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })

  it('복수 서비스 독립 분석', () => {
    aggregator.ingest({ logId: 'M1', serviceId: 'SVC-A', level: 'FATAL', message: 'A 서비스 치명 오류', timestamp: Date.now(), grade: 'O' })
    aggregator.ingest({ logId: 'M2', serviceId: 'SVC-B', level: 'INFO', message: 'B 서비스 정상', timestamp: Date.now(), grade: 'O' })
    const resultA = aggregator.aggregate('SVC-A')
    const resultB = aggregator.aggregate('SVC-B')
    expect(resultA.anomalyDetected).toBe(true)
    expect(resultB.anomalyDetected).toBe(false)
  })
})
