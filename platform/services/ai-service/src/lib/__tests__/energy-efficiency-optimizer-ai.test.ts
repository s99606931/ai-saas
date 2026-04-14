// Plan SC: SVC-AI-ADV-R591-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { EnergyEfficiencyOptimizerAI, type Equipment } from '../energy-efficiency-optimizer-ai'

describe('EnergyEfficiencyOptimizerAI', () => {
  let optimizer: EnergyEfficiencyOptimizerAI

  const efficientEquipment: Equipment = {
    equipmentId: 'EQ-1', name: '서버 A', equipmentType: 'SERVER',
    location: '데이터센터', ratedPowerKw: 10, idlePowerKw: 0.5,
    operatingHoursPerDay: 9, businessHoursPerDay: 9,
  }

  const wastefulEquipment: Equipment = {
    equipmentId: 'EQ-2', name: '서버 B (낭비)', equipmentType: 'SERVER',
    location: '데이터센터', ratedPowerKw: 10, idlePowerKw: 4,
    operatingHoursPerDay: 20, businessHoursPerDay: 9,
  }

  beforeEach(() => {
    optimizer = new EnergyEfficiencyOptimizerAI()
  })

  it('장비 없을 때 → 낭비 없음', () => {
    const wastes = optimizer.analyze()
    expect(wastes).toHaveLength(0)
  })

  it('효율적 장비 → 낭비 없음', () => {
    optimizer.registerEquipment(efficientEquipment)
    const wastes = optimizer.analyze()
    expect(wastes.filter((w) => w.equipmentId === 'EQ-1')).toHaveLength(0)
  })

  it('유휴 전력 > 10% → IDLE_WASTE 감지', () => {
    optimizer.registerEquipment(wastefulEquipment)
    const wastes = optimizer.analyze()
    expect(wastes.some((w) => w.wasteType === 'IDLE_WASTE' && w.equipmentId === 'EQ-2')).toBe(true)
  })

  it('비업무 시간 2시간 초과 가동 → OFF_HOURS 감지', () => {
    optimizer.registerEquipment(wastefulEquipment)
    const wastes = optimizer.analyze()
    expect(wastes.some((w) => w.wasteType === 'OFF_HOURS' && w.equipmentId === 'EQ-2')).toBe(true)
  })

  it('탄소 배출량 계산 — kWh × 0.459', () => {
    optimizer.registerEquipment(efficientEquipment)
    const carbon = optimizer.calculateCarbonEmission()
    const expectedKwh = 10 * 720
    const expectedCarbon = Math.round(expectedKwh * 0.459)
    expect(carbon).toBe(expectedCarbon)
  })

  it('generateReport: 낭비 항목 + 절감 비용 포함', () => {
    optimizer.registerEquipment(wastefulEquipment)
    const report = optimizer.generateReport()
    expect(report.wasteItems.length).toBeGreaterThan(0)
    expect(report.estimatedMonthlySavingKrw).toBeGreaterThan(0)
    expect(report.totalCarbonEmissionKg).toBeGreaterThan(0)
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerEquipment(efficientEquipment)
    optimizer.generateReport()
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', equipmentId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
