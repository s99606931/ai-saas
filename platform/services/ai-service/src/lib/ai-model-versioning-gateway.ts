// Design Ref: §R259 — AI 모델 버전 게이트웨이
// Plan SC: SVC-AI-ADV-R259-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type ModelStatus = 'BLUE' | 'GREEN' | 'RETIRED'

export interface ModelVersion {
  modelId: string
  version: string
  status: ModelStatus
  metadata?: Record<string, string>
}

export interface TrafficSplit {
  modelId: string
  bluePercent: number
  greenPercent: number
}

export interface RouteDecision {
  modelId: string
  selectedVersion: string
  status: ModelStatus
  bucket: number    // 0~99 (routing bucket)
}

export interface CallRecord {
  totalCalls: number
  errorCalls: number
  totalLatencyMs: number
  avgLatencyMs: number
}

export interface ModelStats {
  modelId: string
  versions: Record<string, CallRecord>
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class AIModelVersioningGateway {
  private models = new Map<string, ModelVersion[]>()   // modelId → versions
  private splits = new Map<string, TrafficSplit>()
  private stats = new Map<string, Map<string, CallRecord>>()
  private auditLog: AuditEntry[] = []

  registerModel(model: ModelVersion): void {
    if (!['BLUE', 'GREEN', 'RETIRED'].includes(model.status)) {
      throw new Error(`유효하지 않은 status: ${model.status}`)
    }
    const list = this.models.get(model.modelId) ?? []
    // 동일 version 중복 방지
    if (list.some((v) => v.version === model.version)) {
      throw new Error(`중복 version: ${model.modelId}/${model.version}`)
    }
    list.push({ ...model })
    this.models.set(model.modelId, list)
    this.appendAudit('model.register', 'SYSTEM', { modelId: model.modelId, version: model.version, status: model.status })
  }

  setTrafficSplit(modelId: string, bluePercent: number, greenPercent: number): void {
    if (bluePercent < 0 || greenPercent < 0) {
      throw new Error('비율은 0 이상이어야 합니다')
    }
    if (bluePercent + greenPercent !== 100) {
      throw new Error('blue + green 합은 100이어야 합니다')
    }
    if (!this.models.has(modelId)) {
      throw new Error(`Unknown model: ${modelId}`)
    }
    this.splits.set(modelId, { modelId, bluePercent, greenPercent })
    this.appendAudit('traffic.split', 'SYSTEM', { modelId, bluePercent, greenPercent })
  }

  routeRequest(modelId: string, requestKey: string, caller: string, grade: DataGrade): RouteDecision {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 호출은 라우팅 금지 (N2SF N-05)`)
    }
    if (grade !== 'O') {
      throw new Error('라우팅은 O등급만 허용됩니다')
    }
    const versions = this.models.get(modelId)
    if (!versions || versions.length === 0) {
      throw new Error(`Unknown model: ${modelId}`)
    }
    const blue = versions.find((v) => v.status === 'BLUE')
    const green = versions.find((v) => v.status === 'GREEN')
    if (!blue) {
      throw new Error(`BLUE 버전 없음: ${modelId}`)
    }

    const split = this.splits.get(modelId) ?? { modelId, bluePercent: 100, greenPercent: 0 }
    const bucket = this.hash(requestKey) % 100

    let selected: ModelVersion
    if (green && bucket >= split.bluePercent) {
      selected = green
    } else {
      selected = blue
    }

    this.appendAudit('route', this.mask(caller), {
      modelId,
      version: selected.version,
      status: selected.status,
      bucket,
    })

    return {
      modelId,
      selectedVersion: selected.version,
      status: selected.status,
      bucket,
    }
  }

  recordCall(modelId: string, version: string, success: boolean, latencyMs: number): void {
    if (latencyMs < 0) {
      throw new Error('latencyMs는 0 이상이어야 합니다')
    }
    let modelStats = this.stats.get(modelId)
    if (!modelStats) {
      modelStats = new Map()
      this.stats.set(modelId, modelStats)
    }
    const rec = modelStats.get(version) ?? {
      totalCalls: 0,
      errorCalls: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
    }
    rec.totalCalls++
    if (!success) rec.errorCalls++
    rec.totalLatencyMs += latencyMs
    rec.avgLatencyMs = Math.round(rec.totalLatencyMs / rec.totalCalls)
    modelStats.set(version, rec)
  }

  rollback(modelId: string): void {
    const versions = this.models.get(modelId)
    if (!versions) throw new Error(`Unknown model: ${modelId}`)
    const green = versions.find((v) => v.status === 'GREEN')
    if (!green) throw new Error(`GREEN 버전 없음: ${modelId}`)
    green.status = 'RETIRED'
    this.splits.set(modelId, { modelId, bluePercent: 100, greenPercent: 0 })
    this.appendAudit('rollback', 'SYSTEM', { modelId, retiredVersion: green.version })
  }

  getStats(modelId: string): ModelStats {
    const modelStats = this.stats.get(modelId)
    const versions: Record<string, CallRecord> = {}
    if (modelStats) {
      for (const [ver, rec] of modelStats.entries()) {
        versions[ver] = { ...rec }
      }
    }
    return { modelId, versions }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private hash(str: string): number {
    // FNV-1a 32-bit
    let h = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(action: string, callerMasked: string, detail: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
