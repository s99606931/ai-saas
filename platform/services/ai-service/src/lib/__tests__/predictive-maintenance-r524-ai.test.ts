// Plan SC: SVC-AI-ADV-R524-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { PredictiveMaintenanceR524AI, type ComponentHealth } from '../predictive-maintenance-r524-ai'

describe('PredictiveMaintenanceR524AI', () => {
  let maintenance: PredictiveMaintenanceR524AI

  const healthyComponent: ComponentHealth = {
    componentId: 'COMP-1',
    componentType: 'SERVER',
    name: '웹 서버 01',
    ageMonths: 12,
    lastMaintenanceDaysAgo: 30,
    errorCountLast30Days: 0,
  }

  beforeEach(() => {
    maintenance = new PredictiveMaintenanceR524AI()
  })

  it('미등록 컴포넌트 예측 시 오류 발생', () => {
    expect(() => maintenance.predict('UNKNOWN')).toThrow('Unknown component')
  })

  it('건강한 컴포넌트 → LOW 장애 확률, SCHEDULED 긴급도', () => {
    maintenance.registerComponent(healthyComponent)
    const prediction = maintenance.predict('COMP-1')
    expect(prediction.failureProbability).toBe('LOW')
    expect(prediction.urgency).toBe('SCHEDULED')
  })

  it('노후 장비 (60개월+) → 높은 위험, 교체 권고 포함', () => {
    maintenance.registerComponent({ ...healthyComponent, componentId: 'COMP-OLD', ageMonths: 72 })
    const prediction = maintenance.predict('COMP-OLD')
    expect(prediction.predictedIssues.some((i) => i.includes('노후'))).toBe(true)
    expect(prediction.recommendedActions.some((a) => a.includes('교체'))).toBe(true)
  })

  it('과열 (85°C 이상) → 냉각 점검 권고', () => {
    maintenance.registerComponent({ ...healthyComponent, componentId: 'COMP-HOT', cpuTemperatureCelsius: 90 })
    const prediction = maintenance.predict('COMP-HOT')
    expect(prediction.predictedIssues.some((i) => i.includes('온도'))).toBe(true)
    expect(prediction.recommendedActions.some((a) => a.includes('냉각'))).toBe(true)
  })

  it('디스크 건강도 20% 미만 → CRITICAL, IMMEDIATE 긴급도', () => {
    maintenance.registerComponent({ ...healthyComponent, componentId: 'COMP-DISK', diskHealthPct: 10, ageMonths: 70, errorCountLast30Days: 15 })
    const prediction = maintenance.predict('COMP-DISK')
    expect(prediction.failureProbability).toBe('CRITICAL')
    expect(prediction.urgency).toBe('IMMEDIATE')
  })

  it('generatePlan: 즉시 조치 목록 분류 정확', () => {
    maintenance.registerComponent(healthyComponent)
    maintenance.registerComponent({ ...healthyComponent, componentId: 'COMP-URGENT', ageMonths: 72, errorCountLast30Days: 15, diskHealthPct: 5 })
    const plan = maintenance.generatePlan()
    expect(plan.immediateActions.some((p) => p.componentId === 'COMP-URGENT')).toBe(true)
    expect(plan.healthySystems).toContain('COMP-1')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    maintenance.registerComponent(healthyComponent)
    maintenance.predict('COMP-1')
    const log1 = maintenance.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', componentId: 'X', detail: {} })
    const log2 = maintenance.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
