// Design Ref: §설계결정 — AI기반 모델 드리프트 교정 v2
// Plan SC: FR-R627.1~5

interface ModelRecord { modelId: string; name: string; baselineAccuracy: number }
interface DriftRecord { accuracy: number; driftScore: number; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class ModelDriftCorrectorV2 {
  private models = new Map<string, ModelRecord>()
  private driftHistory = new Map<string, DriftRecord[]>()
  private auditLog: AuditEntry[] = []

  registerModel(modelId: string, name: string, baselineAccuracy: number): void {
    this.models.set(modelId, { modelId, name, baselineAccuracy })
    this.driftHistory.set(modelId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_MODEL', details: { modelId, name, baselineAccuracy } })
  }

  recordDrift(modelId: string, currentAccuracy: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const model = this.models.get(modelId)
    const driftScore = model ? Math.max(0, model.baselineAccuracy - currentAccuracy) : 0
    const entries = this.driftHistory.get(modelId) ?? []
    entries.push({ accuracy: currentAccuracy, driftScore, timestamp: new Date().toISOString() })
    this.driftHistory.set(modelId, entries)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_DRIFT', details: { modelId, currentAccuracy, driftScore } })
  }

  getDriftScore(modelId: string): number {
    const entries = this.driftHistory.get(modelId) ?? []
    if (entries.length === 0) return 0
    return entries[entries.length - 1]!.driftScore
  }

  getHighDriftModels(threshold: number): ModelRecord[] {
    return Array.from(this.models.values()).filter(m => this.getDriftScore(m.modelId) > threshold)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
