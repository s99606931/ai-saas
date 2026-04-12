import { describe, it, expect, beforeEach } from 'vitest'
import {
  PredictiveMaintenanceAI,
  type EquipmentProfile,
  type SensorReading,
  type SensorMetric,
} from '../predictive-maintenance-ai'

describe('PredictiveMaintenanceAI', () => {
  let ai: PredictiveMaintenanceAI

  const pump: EquipmentProfile = {
    equipmentId: 'EQ-PUMP-001',
    type: '상수도 펌프',
    installedAt: '2024-01-01',
    thresholds: {
      VIBRATION: { warn: 5, critical: 10 },
      TEMPERATURE: { warn: 70, critical: 90 },
      PRESSURE: { warn: 8, critical: 12 },
      CURRENT: { warn: 20, critical: 30 },
    },
    grade: 'O',
  }

  const reading = (metric: SensorMetric, value: number): SensorReading => ({
    equipmentId: 'EQ-PUMP-001',
    metric,
    value,
    timestamp: Date.now(),
  })

  beforeEach(() => {
    ai = new PredictiveMaintenanceAI()
    ai.registerEquipment(pump)
  })

  it('C등급 설비 차단', () => {
    expect(() =>
      ai.registerEquipment({ ...pump, equipmentId: 'EQ2', grade: 'C' })
    ).toThrow('BLOCKED')
  })

  it('미등록 설비 센서 기록 거부', () => {
    expect(() =>
      ai.recordSensor({ ...reading('VIBRATION', 5), equipmentId: 'UNKNOWN' })
    ).toThrow('Unknown equipment')
  })

  it('정상 범위 → 이상 없음', () => {
    ai.recordSensor(reading('VIBRATION', 3))
    ai.recordSensor(reading('TEMPERATURE', 50))
    const anomalies = ai.detectAnomalies('EQ-PUMP-001')
    expect(anomalies).toHaveLength(0)
  })

  it('critical 임계값 초과 → HIGH 이상', () => {
    ai.recordSensor(reading('VIBRATION', 12))
    const anomalies = ai.detectAnomalies('EQ-PUMP-001')
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]?.severity).toBe('HIGH')
  })

  it('warn 초과 → MEDIUM 이상', () => {
    ai.recordSensor(reading('TEMPERATURE', 75))
    const anomalies = ai.detectAnomalies('EQ-PUMP-001')
    expect(anomalies[0]?.severity).toBe('MEDIUM')
  })

  it('고장 확률 예측 — 다중 이상 → HIGH/CRITICAL', () => {
    ai.recordSensor(reading('VIBRATION', 12))
    ai.recordSensor(reading('TEMPERATURE', 95))
    ai.recordSensor(reading('PRESSURE', 13))
    const prediction = ai.predictFailureProbability('EQ-PUMP-001')
    expect(prediction.probability).toBeGreaterThan(0.5)
    expect(['HIGH', 'CRITICAL']).toContain(prediction.riskLevel)
  })

  it('정비 권고 — IMMEDIATE for high probability', () => {
    for (let i = 0; i < 3; i++) {
      ai.recordSensor(reading('VIBRATION', 15))
      ai.recordSensor(reading('TEMPERATURE', 100))
      ai.recordSensor(reading('PRESSURE', 14))
    }
    const rec = ai.recommendMaintenance('EQ-PUMP-001')
    expect(rec.urgency).toBe('IMMEDIATE')
    expect(rec.recommendedActions.length).toBeGreaterThan(0)
  })

  it('정상 상태 → SCHEDULED', () => {
    ai.recordSensor(reading('VIBRATION', 2))
    ai.recordSensor(reading('TEMPERATURE', 40))
    const rec = ai.recommendMaintenance('EQ-PUMP-001')
    expect(rec.urgency).toBe('SCHEDULED')
  })

  it('감사 로그 — register/detect/predict/recommend 기록', () => {
    ai.recordSensor(reading('VIBRATION', 12))
    ai.detectAnomalies('EQ-PUMP-001')
    ai.predictFailureProbability('EQ-PUMP-001')
    ai.recommendMaintenance('EQ-PUMP-001')
    const log = ai.getAuditLog()
    expect(log.some((e) => e.action === 'equipment.register')).toBe(true)
    expect(log.some((e) => e.action === 'anomaly.detect')).toBe(true)
    expect(log.some((e) => e.action === 'failure.predict')).toBe(true)
    expect(log.some((e) => e.action === 'maintenance.recommend')).toBe(true)
  })
})
