// Design Ref: §R591 — AI기반 공공기관 에너지 효율 AI
// Plan SC: SVC-AI-ADV-R591-SC01

export type EquipmentType = 'SERVER' | 'COOLING' | 'LIGHTING' | 'UPS' | 'NETWORK'
export type WasteType = 'IDLE_WASTE' | 'OFF_HOURS' | 'OVERCOOLING' | 'REDUNDANT_POWER'

export interface Equipment {
  equipmentId: string
  name: string
  equipmentType: EquipmentType
  location: string
  ratedPowerKw: number          // 정격 소비 전력
  idlePowerKw: number           // 유휴 상태 소비 전력
  operatingHoursPerDay: number  // 일일 가동 시간
  businessHoursPerDay: number   // 업무 시간 (에너지 필요 시간)
}

export interface EnergyWaste {
  wasteId: string
  equipmentId: string
  wasteType: WasteType
  estimatedWasteKwh: number
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  detail: string
  savingAction: string
}

export interface EnergyOptimization {
  equipmentId: string
  action: string
  estimatedMonthlySavingKwh: number
  estimatedMonthlySavingKrw: number  // kWh × 120원 (평균 산업용 단가)
  carbonReductionKg: number           // kWh × 0.459 kg CO2
}

export interface EnergyReport {
  totalEquipment: number
  totalMonthlyConsumptionKwh: number
  totalCarbonEmissionKg: number
  wasteItems: EnergyWaste[]
  optimizations: EnergyOptimization[]
  estimatedMonthlySavingKrw: number
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  equipmentId: string
  detail: Record<string, unknown>
}

const KRW_PER_KWH = 120
const CO2_KG_PER_KWH = 0.459
const HOURS_PER_MONTH = 720

export class EnergyEfficiencyOptimizerAI {
  private equipment = new Map<string, Equipment>()
  private auditLog: AuditEntry[] = []

  registerEquipment(eq: Equipment): void {
    this.equipment.set(eq.equipmentId, eq)
    this.appendAudit('equipment.register', eq.equipmentId, { name: eq.name, type: eq.equipmentType, ratedPowerKw: eq.ratedPowerKw })
  }

  analyze(): EnergyWaste[] {
    const wastes: EnergyWaste[] = []
    for (const eq of this.equipment.values()) {
      // 유휴 전력 낭비: 유휴 전력이 정격의 10% 이상
      const idlePct = (eq.idlePowerKw / eq.ratedPowerKw) * 100
      if (idlePct > 10) {
        const dailyWasteKwh = eq.idlePowerKw * (24 - eq.operatingHoursPerDay)
        wastes.push({ wasteId: `WST-${eq.equipmentId}-IDLE`, equipmentId: eq.equipmentId, wasteType: 'IDLE_WASTE', estimatedWasteKwh: Math.round(dailyWasteKwh * 30), severity: idlePct > 30 ? 'HIGH' : 'MEDIUM', detail: `유휴 전력 ${eq.idlePowerKw}kW — 정격의 ${idlePct.toFixed(0)}%`, savingAction: '유휴 시간 자동 절전 모드 활성화' })
      }
      // 비업무 시간 가동
      const offHours = eq.operatingHoursPerDay - eq.businessHoursPerDay
      if (offHours > 2) {
        const wasteKwh = eq.idlePowerKw * offHours
        wastes.push({ wasteId: `WST-${eq.equipmentId}-OFFHRS`, equipmentId: eq.equipmentId, wasteType: 'OFF_HOURS', estimatedWasteKwh: Math.round(wasteKwh * 30), severity: offHours > 6 ? 'HIGH' : 'LOW', detail: `비업무 시간 ${offHours}시간 가동 중`, savingAction: '비업무 시간 자동 셧다운 스케줄 설정' })
      }
    }
    this.appendAudit('energy.analyze', 'system', { equipmentCount: this.equipment.size, wasteCount: wastes.length })
    return wastes
  }

  calculateCarbonEmission(): number {
    let totalKwh = 0
    for (const eq of this.equipment.values()) {
      totalKwh += eq.ratedPowerKw * HOURS_PER_MONTH
    }
    return Math.round(totalKwh * CO2_KG_PER_KWH)
  }

  generateReport(): EnergyReport {
    const wastes = this.analyze()
    const optimizations: EnergyOptimization[] = []
    let totalMonthlyConsumptionKwh = 0

    for (const eq of this.equipment.values()) {
      const monthlyKwh = eq.ratedPowerKw * HOURS_PER_MONTH
      totalMonthlyConsumptionKwh += monthlyKwh

      const saving = wastes.filter((w) => w.equipmentId === eq.equipmentId).reduce((s, w) => s + w.estimatedWasteKwh, 0)
      if (saving > 0) {
        optimizations.push({
          equipmentId: eq.equipmentId,
          action: '절전 모드 및 스케줄 자동화',
          estimatedMonthlySavingKwh: saving,
          estimatedMonthlySavingKrw: Math.round(saving * KRW_PER_KWH),
          carbonReductionKg: Math.round(saving * CO2_KG_PER_KWH),
        })
      }
    }

    const totalCarbonEmissionKg = this.calculateCarbonEmission()
    const estimatedMonthlySavingKrw = optimizations.reduce((s, o) => s + o.estimatedMonthlySavingKrw, 0)

    const recommendations: string[] = []
    if (wastes.some((w) => w.severity === 'HIGH')) recommendations.push('HIGH 에너지 낭비 항목 즉시 절전 설정 적용 필요')
    if (totalCarbonEmissionKg > 1000) recommendations.push(`월 탄소 배출 ${totalCarbonEmissionKg}kg — 탄소 저감 계획 수립 권고`)

    this.appendAudit('report.generate', 'system', { totalEquipment: this.equipment.size, totalMonthlyConsumptionKwh, totalCarbonEmissionKg })
    return { totalEquipment: this.equipment.size, totalMonthlyConsumptionKwh: Math.round(totalMonthlyConsumptionKwh), totalCarbonEmissionKg, wasteItems: wastes, optimizations, estimatedMonthlySavingKrw, recommendations, generatedAt: new Date().toISOString() }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }

  private appendAudit(action: string, equipmentId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, equipmentId, detail })
  }
}
