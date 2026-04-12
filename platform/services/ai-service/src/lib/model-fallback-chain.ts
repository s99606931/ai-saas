/**
 * Model Fallback Chain — SVC-AI-ADV-R149
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R149.design.md
 * Plan SC: FR-R149.1 ~ FR-R149.6
 *
 * 순서화된 모델 폴백 체인 + cooldown circuit breaker.
 */

export type DataGrade = 'O' | 'C' | 'S'

export interface ChainModel {
  modelId: string
  priority: number
  unhealthyUntil?: number
}

export interface AttemptRecord {
  modelId: string
  error: string
}

export interface ExecuteResult<T> {
  modelId: string
  result: T
  attempts: AttemptRecord[]
}

export interface AuditEntry {
  event: string
  detail: Record<string, unknown>
  at: number
}

export type Runner<T> = (modelId: string, req: unknown) => Promise<T>

export interface ChainOptions {
  now?: () => number
  defaultCooldownMs?: number
}

export class ModelFallbackChain {
  private readonly models = new Map<string, ChainModel>()
  private readonly auditLog: AuditEntry[] = []
  private readonly now: () => number
  private readonly defaultCooldownMs: number

  constructor(opts: ChainOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.defaultCooldownMs = opts.defaultCooldownMs ?? 60_000
  }

  /** FR-R149.1: 체인 등록 */
  register(modelId: string, priority: number): void {
    if (!modelId) {
      throw new Error('invalid_input')
    }
    if (this.models.has(modelId)) {
      throw new Error('duplicate_model')
    }
    this.models.set(modelId, { modelId, priority })
    this.audit('model_registered', { modelId, priority })
  }

  /** FR-R149.3: 비정상 표시 */
  markUnhealthy(modelId: string, cooldownMs?: number): void {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error('not_found')
    }
    const cd = cooldownMs ?? this.defaultCooldownMs
    model.unhealthyUntil = this.now() + cd
    this.audit('model_unhealthy', { modelId, until: model.unhealthyUntil })
  }

  /** FR-R149.4: 헬시 판정 */
  isHealthy(modelId: string, nowTs?: number): boolean {
    const model = this.models.get(modelId)
    if (!model) return false
    if (model.unhealthyUntil === undefined) return true
    const t = nowTs ?? this.now()
    return t >= model.unhealthyUntil
  }

  /** FR-R149.2, FR-R149.5: 폴백 실행 */
  async execute<T>(
    req: { grade?: DataGrade } & Record<string, unknown>,
    runner: Runner<T>,
  ): Promise<ExecuteResult<T>> {
    this.assertGrade(req.grade ?? 'O')
    if (this.models.size === 0) {
      throw new Error('no_models')
    }
    const sorted = [...this.models.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.modelId.localeCompare(b.modelId)
    })
    const attempts: AttemptRecord[] = []
    const now = this.now()
    for (const model of sorted) {
      if (!this.isHealthy(model.modelId, now)) {
        attempts.push({ modelId: model.modelId, error: 'unhealthy' })
        continue
      }
      try {
        const result = await runner(model.modelId, req)
        this.audit('execute_success', { modelId: model.modelId, attempts: attempts.length })
        return { modelId: model.modelId, result, attempts }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        attempts.push({ modelId: model.modelId, error: msg })
        // 해당 모델 비정상 표시 (다음 호출에서 skip)
        model.unhealthyUntil = this.now() + this.defaultCooldownMs
        this.audit('execute_attempt_failed', { modelId: model.modelId, error: msg })
      }
    }
    this.audit('chain_exhausted', { attempts: attempts.length })
    throw new Error('chain_exhausted')
  }

  /** FR-R149.6: 감사 로그 */
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  list(): ChainModel[] {
    return [...this.models.values()].map((m) => ({ ...m }))
  }

  // === 내부 ===

  private assertGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error('grade_blocked')
    }
  }

  private audit(event: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ event, detail, at: this.now() })
  }
}
