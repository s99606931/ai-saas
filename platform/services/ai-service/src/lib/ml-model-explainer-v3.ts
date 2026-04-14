// Design Ref: §설계결정 — AI기반 ML 모델 설명가능성 v3
// Plan SC: FR-R633.1~5

interface FeatureContribution { feature: string; contribution: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class MlModelExplainerV3 {
  private models = new Set<string>()
  private contributions = new Map<string, FeatureContribution[]>()
  private auditLog: AuditEntry[] = []

  registerModel(modelId: string): void {
    this.models.add(modelId)
    this.contributions.set(modelId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_MODEL', details: { modelId } })
  }

  recordContribution(modelId: string, feature: string, contribution: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.models.has(modelId)) throw new Error('MODEL_NOT_FOUND')
    const list = this.contributions.get(modelId) ?? []
    list.push({ feature, contribution })
    this.contributions.set(modelId, list)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_CONTRIBUTION', details: { modelId, feature } })
  }

  topFeatures(modelId: string, topN: number): FeatureContribution[] {
    const list = this.contributions.get(modelId) ?? []
    return [...list]
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, topN)
  }

  consistencyScore(modelId: string): number {
    const list = this.contributions.get(modelId) ?? []
    if (list.length === 0) return 1
    const mean = list.reduce((acc, c) => acc + c.contribution, 0) / list.length
    const variance = list.reduce((acc, c) => acc + Math.pow(c.contribution - mean, 2), 0) / list.length
    return 1 / (1 + variance)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
