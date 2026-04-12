// Design Ref: §R258 — 디지털 트윈 데이터 동기화 엔진
// Plan SC: SVC-AI-ADV-R258-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH'

export interface TwinEntity {
  entityId: string
  type: string
  initialState: Record<string, number>
  grade?: DataGrade
}

export interface TwinState {
  entityId: string
  type: string
  state: Record<string, number>
  version: number
  updatedAt: string
}

export interface TwinVersion {
  version: number
  state: Record<string, number>
  updatedAt: string
}

export interface Delta {
  added: Record<string, number>
  removed: Record<string, number>
  changed: Record<string, { from: number; to: number }>
}

export interface AnomalyRule {
  entityType: string
  field: string
  min: number
  max: number
  severity: AnomalySeverity
}

export interface Anomaly {
  entityId: string
  field: string
  value: number
  expectedRange: [number, number]
  severity: AnomalySeverity
}

export interface UpdateResult {
  version: number
  delta: Delta
  anomalies: Anomaly[]
}

interface AuditEntry {
  timestamp: string
  action: string
  entityIdMasked: string
  detail: Record<string, unknown>
}

export class DigitalTwinSyncEngine {
  private entities = new Map<string, TwinState>()
  private history = new Map<string, TwinVersion[]>()
  private rules: AnomalyRule[] = []
  private auditLog: AuditEntry[] = []

  registerEntity(entity: TwinEntity): void {
    if (entity.grade === 'C' || entity.grade === 'S') {
      throw new Error(`BLOCKED: ${entity.grade}등급 엔티티는 동기화 금지 (N2SF N-05)`)
    }
    if (entity.grade !== 'O') {
      throw new Error('엔티티는 O등급만 허용됩니다')
    }
    const now = new Date().toISOString()
    const state: TwinState = {
      entityId: entity.entityId,
      type: entity.type,
      state: { ...entity.initialState },
      version: 1,
      updatedAt: now,
    }
    this.entities.set(entity.entityId, state)
    this.history.set(entity.entityId, [{ version: 1, state: { ...entity.initialState }, updatedAt: now }])
    this.appendAudit('entity.register', this.mask(entity.entityId), { type: entity.type, version: 1 })
  }

  registerAnomalyRule(rule: AnomalyRule): void {
    if (rule.min > rule.max) {
      throw new Error('min은 max 이하여야 합니다')
    }
    this.rules.push(rule)
  }

  updateState(entityId: string, newState: Record<string, number>): UpdateResult {
    const current = this.entities.get(entityId)
    if (!current) throw new Error(`Unknown entity: ${entityId}`)

    for (const [key, value] of Object.entries(newState)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`field ${key}는 유한 숫자여야 합니다`)
      }
    }

    const delta = this.computeDelta(current.state, newState)
    const merged = { ...current.state, ...newState }
    const newVersion = current.version + 1
    const now = new Date().toISOString()

    const updated: TwinState = {
      entityId: current.entityId,
      type: current.type,
      state: merged,
      version: newVersion,
      updatedAt: now,
    }
    this.entities.set(entityId, updated)

    const hist = this.history.get(entityId) ?? []
    hist.push({ version: newVersion, state: { ...merged }, updatedAt: now })
    this.history.set(entityId, hist)

    const anomalies = this.evaluateAnomalies(updated)
    this.appendAudit('entity.update', this.mask(entityId), {
      version: newVersion,
      changedCount: Object.keys(delta.changed).length,
      anomalyCount: anomalies.length,
    })

    return { version: newVersion, delta, anomalies }
  }

  getState(entityId: string): TwinState {
    const state = this.entities.get(entityId)
    if (!state) throw new Error(`Unknown entity: ${entityId}`)
    return {
      entityId: state.entityId,
      type: state.type,
      state: { ...state.state },
      version: state.version,
      updatedAt: state.updatedAt,
    }
  }

  getHistory(entityId: string): TwinVersion[] {
    const hist = this.history.get(entityId)
    if (!hist) throw new Error(`Unknown entity: ${entityId}`)
    return hist.map((v) => ({ version: v.version, state: { ...v.state }, updatedAt: v.updatedAt }))
  }

  computeDelta(prev: Record<string, number>, next: Record<string, number>): Delta {
    const added: Record<string, number> = {}
    const removed: Record<string, number> = {}
    const changed: Record<string, { from: number; to: number }> = {}

    for (const key of Object.keys(next)) {
      if (!(key in prev)) {
        added[key] = next[key] ?? 0
      } else if (prev[key] !== next[key]) {
        changed[key] = { from: prev[key] ?? 0, to: next[key] ?? 0 }
      }
    }
    for (const key of Object.keys(prev)) {
      if (!(key in next)) {
        removed[key] = prev[key] ?? 0
      }
    }
    return { added, removed, changed }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private evaluateAnomalies(state: TwinState): Anomaly[] {
    const anomalies: Anomaly[] = []
    for (const rule of this.rules) {
      if (rule.entityType !== state.type) continue
      const value = state.state[rule.field]
      if (value === undefined) continue
      if (value < rule.min || value > rule.max) {
        anomalies.push({
          entityId: state.entityId,
          field: rule.field,
          value,
          expectedRange: [rule.min, rule.max],
          severity: rule.severity,
        })
      }
    }
    return anomalies
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(action: string, entityIdMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      entityIdMasked,
      detail,
    })
  }
}
