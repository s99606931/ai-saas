import { describe, it, expect, beforeEach } from 'vitest'
import { FailurePatternLibraryAi, type FailurePattern, type IncidentReport } from '../failure-pattern-library-ai'

describe('FailurePatternLibraryAi', () => {
  let library: FailurePatternLibraryAi

  const pattern: FailurePattern = {
    patternId: 'PAT001',
    name: 'OOM 메모리 부족',
    symptoms: ['메모리 사용량 급증', 'OutOfMemory 오류', '서비스 재시작'],
    rootCauses: ['메모리 누수', '급격한 트래픽 증가'],
    resolutionSteps: ['JVM 힙 증설', '메모리 누수 코드 수정'],
    preventionMeasures: ['메모리 알림 임계값 설정', '부하 테스트 정기 실행'],
    severity: 'HIGH',
    category: 'MEMORY',
  }

  const incident: IncidentReport = {
    incidentId: 'INC001',
    observedSymptoms: ['메모리 사용량 급증', 'OutOfMemory 오류'],
    serviceId: 'SVC001',
    timestamp: Date.now(),
  }

  beforeEach(() => {
    library = new FailurePatternLibraryAi()
    library.registerPattern(pattern)
  })

  it('패턴 등록 감사 로그', () => {
    const log = library.getAuditLog()
    expect(log.some((e) => e.action === 'pattern.register')).toBe(true)
  })

  it('증상 일치 → 패턴 매칭', () => {
    const result = library.diagnose(incident)
    expect(result.isRecognized).toBe(true)
    expect(result.topMatches.length).toBeGreaterThan(0)
    expect(result.topMatches[0]?.patternId).toBe('PAT001')
  })

  it('매칭 점수 계산', () => {
    const result = library.diagnose(incident)
    // 2/3 symptoms matched → 67%
    expect(result.topMatches[0]?.matchScore).toBeGreaterThan(50)
  })

  it('해결 방법 제공', () => {
    const result = library.diagnose(incident)
    expect(result.topMatches[0]?.suggestedResolutions.length).toBeGreaterThan(0)
  })

  it('예방 조치 제공', () => {
    const result = library.diagnose(incident)
    expect(result.topMatches[0]?.preventionMeasures.length).toBeGreaterThan(0)
  })

  it('증상 불일치 → isRecognized false', () => {
    const unknownIncident: IncidentReport = {
      incidentId: 'INC002',
      observedSymptoms: ['완전히 다른 현상'],
      serviceId: 'SVC001',
      timestamp: Date.now(),
    }
    const result = library.diagnose(unknownIncident)
    expect(result.isRecognized).toBe(false)
    expect(result.recommendedEscalation).toBe(true)
  })

  it('topMatches 최대 3개', () => {
    for (let i = 2; i <= 5; i++) {
      library.registerPattern({ ...pattern, patternId: `PAT00${i}`, name: `패턴${i}` })
    }
    const result = library.diagnose(incident)
    expect(result.topMatches.length).toBeLessThanOrEqual(3)
  })

  it('진단 후 감사 로그', () => {
    library.diagnose(incident)
    const log = library.getAuditLog()
    expect(log.some((e) => e.action === 'incident.diagnose')).toBe(true)
  })
})
