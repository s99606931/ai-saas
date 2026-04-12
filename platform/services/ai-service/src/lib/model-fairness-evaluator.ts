// Design Ref: §R253 — AI 모델 공정성 평가기
// Plan SC: SVC-AI-ADV-R253-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type FairnessGrade = 'FAIR' | 'BORDERLINE' | 'BIASED'

export interface ModelProfile {
  modelId: string
  name: string
  protectedAttribute: string  // 예: 성별, 연령대, 지역
  grade?: DataGrade
}

export interface PredictionRecord {
  modelId: string
  group: string  // 보호속성 값 (예: '남성', '여성')
  predicted: 0 | 1
  actual: 0 | 1
}

export interface GroupMetric {
  group: string
  value: number  // 0~1
  sampleSize: number
}

export interface GroupMetricsResult {
  modelId: string
  metric: 'DEMOGRAPHIC_PARITY' | 'EQUAL_OPPORTUNITY'
  groups: GroupMetric[]
  maxMinRatio: number
}

export interface FairnessReport {
  modelId: string
  grade: FairnessGrade
  disparateImpactRatio: number
  passesEightyPercentRule: boolean
  demographicParity: GroupMetric[]
  equalOpportunity: GroupMetric[]
}

export interface MitigationAdvice {
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  category: 'DATA' | 'MODEL' | 'POSTPROCESS'
  action: string
}

interface AuditEntry {
  timestamp: string
  action: string
  modelId: string
  detail: Record<string, unknown>
}

export class ModelFairnessEvaluator {
  private models = new Map<string, ModelProfile>()
  private predictions = new Map<string, PredictionRecord[]>()
  private auditLog: AuditEntry[] = []

  registerModel(profile: ModelProfile): void {
    if (profile.grade === 'C' || profile.grade === 'S') {
      throw new Error(`BLOCKED: ${profile.grade}등급 모델 데이터는 AI 평가 금지 (N2SF N-05)`)
    }
    this.models.set(profile.modelId, profile)
    this.predictions.set(profile.modelId, [])
    this.appendAudit('model.register', profile.modelId, { name: profile.name })
  }

  recordPrediction(record: PredictionRecord): void {
    if (!this.models.has(record.modelId)) throw new Error(`Unknown model: ${record.modelId}`)
    const list = this.predictions.get(record.modelId) ?? []
    list.push(record)
    this.predictions.set(record.modelId, list)
  }

  calculateDemographicParity(modelId: string): GroupMetricsResult {
    const records = this.predictions.get(modelId) ?? []
    if (records.length === 0) throw new Error(`No predictions for model: ${modelId}`)

    const groups = new Map<string, { positive: number; total: number }>()
    for (const r of records) {
      const g = groups.get(r.group) ?? { positive: 0, total: 0 }
      g.total += 1
      if (r.predicted === 1) g.positive += 1
      groups.set(r.group, g)
    }

    const groupMetrics: GroupMetric[] = []
    for (const [group, counts] of groups.entries()) {
      groupMetrics.push({
        group,
        value: Math.round((counts.positive / counts.total) * 10000) / 10000,
        sampleSize: counts.total,
      })
    }
    const ratio = this.computeMinMaxRatio(groupMetrics)
    this.appendAudit('demographic.parity', modelId, { ratio })
    return { modelId, metric: 'DEMOGRAPHIC_PARITY', groups: groupMetrics, maxMinRatio: ratio }
  }

  calculateEqualOpportunity(modelId: string): GroupMetricsResult {
    const records = this.predictions.get(modelId) ?? []
    if (records.length === 0) throw new Error(`No predictions for model: ${modelId}`)

    const groups = new Map<string, { tp: number; totalPositive: number }>()
    for (const r of records) {
      const g = groups.get(r.group) ?? { tp: 0, totalPositive: 0 }
      if (r.actual === 1) {
        g.totalPositive += 1
        if (r.predicted === 1) g.tp += 1
      }
      groups.set(r.group, g)
    }

    const groupMetrics: GroupMetric[] = []
    for (const [group, counts] of groups.entries()) {
      const tpr = counts.totalPositive === 0 ? 0 : counts.tp / counts.totalPositive
      groupMetrics.push({
        group,
        value: Math.round(tpr * 10000) / 10000,
        sampleSize: counts.totalPositive,
      })
    }
    const ratio = this.computeMinMaxRatio(groupMetrics)
    this.appendAudit('equal.opportunity', modelId, { ratio })
    return { modelId, metric: 'EQUAL_OPPORTUNITY', groups: groupMetrics, maxMinRatio: ratio }
  }

  evaluateDisparateImpact(modelId: string): FairnessReport {
    const dp = this.calculateDemographicParity(modelId)
    const eo = this.calculateEqualOpportunity(modelId)
    const ratio = dp.maxMinRatio
    const passes = ratio >= 0.8
    let grade: FairnessGrade = 'BIASED'
    if (ratio >= 0.9) grade = 'FAIR'
    else if (ratio >= 0.8) grade = 'BORDERLINE'

    const report: FairnessReport = {
      modelId,
      grade,
      disparateImpactRatio: Math.round(ratio * 100) / 100,
      passesEightyPercentRule: passes,
      demographicParity: dp.groups,
      equalOpportunity: eo.groups,
    }
    this.appendAudit('disparate.impact', modelId, { grade, ratio: report.disparateImpactRatio })
    return report
  }

  recommendMitigation(modelId: string): MitigationAdvice[] {
    const report = this.evaluateDisparateImpact(modelId)
    const advice: MitigationAdvice[] = []

    if (report.grade === 'BIASED') {
      advice.push({
        priority: 'HIGH',
        category: 'DATA',
        action: '학습 데이터 그룹별 재샘플링 (오버샘플링/언더샘플링)',
      })
      advice.push({
        priority: 'HIGH',
        category: 'MODEL',
        action: '공정성 제약 조건 추가 학습 (Fair Representation Learning)',
      })
      advice.push({
        priority: 'MEDIUM',
        category: 'POSTPROCESS',
        action: '그룹별 임계값 조정 (Reject Option Classification)',
      })
    } else if (report.grade === 'BORDERLINE') {
      advice.push({
        priority: 'MEDIUM',
        category: 'DATA',
        action: '추가 데이터 수집으로 그룹 대표성 강화',
      })
      advice.push({
        priority: 'LOW',
        category: 'POSTPROCESS',
        action: '정기 공정성 모니터링 강화',
      })
    } else {
      advice.push({
        priority: 'LOW',
        category: 'MODEL',
        action: '현재 공정성 유지, 분기별 재측정',
      })
    }

    this.appendAudit('mitigation.recommend', modelId, { grade: report.grade, count: advice.length })
    return advice
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private computeMinMaxRatio(metrics: GroupMetric[]): number {
    if (metrics.length < 2) return 1
    const values = metrics.map((m) => m.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    if (max === 0) return 1
    return min / max
  }

  private appendAudit(action: string, modelId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      modelId,
      detail,
    })
  }
}
