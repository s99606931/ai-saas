/**
 * AI Token Budget Manager — SVC-AI-ADV-R123
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R123.design.md
 * Plan SC: FR-R123.1 ~ FR-R123.9
 *
 * 테넌트별 토큰 쿼터 + 롤링 윈도우(분/시/일/월) + 모델 가중치 + 경고 알림.
 * CSAP D-06 감사, N2SF N-05 등급 차단.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type BudgetWindow = 'minute' | 'hour' | 'day' | 'month'

export interface TenantBudgetLimits {
  minute?: number
  hour?: number
  day?: number
  month?: number
}

export interface ModelCostWeight {
  model: string
  inputMultiplier: number
  outputMultiplier: number
}

export interface ConsumeRequest {
  tenantId: string
  model: string
  inputTokens: number
  outputTokens: number
  grade: DataGrade
  timestamp?: number
}

export interface ConsumeRecord {
  tenantId: string
  model: string
  effectiveTokens: number
  timestamp: number
}

export interface RemainingReport {
  tenantId: string
  limits: TenantBudgetLimits
  used: Record<BudgetWindow, number>
  remaining: Record<BudgetWindow, number>
  utilization: Record<BudgetWindow, number>
}

export interface BudgetAuditEntry {
  timestamp: string
  action:
    | 'registerTenant'
    | 'setModelWeight'
    | 'consume'
    | 'quotaExceeded'
    | 'warning'
    | 'gradeBlocked'
  detail?: Record<string, unknown>
}

export type BudgetWarningListener = (evt: {
  tenantId: string
  window: BudgetWindow
  utilization: number
}) => void

export class QuotaExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly window: BudgetWindow,
    public readonly limit: number,
    public readonly attempted: number,
  ) {
    super(
      `BUDGET_EXCEEDED: tenant=${tenantId} window=${window} limit=${limit} attempted=${attempted}`,
    )
    this.name = 'QuotaExceededError'
  }
}

const WINDOW_MS: Record<BudgetWindow, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  month: 30 * 86_400_000,
}

const ALL_WINDOWS: BudgetWindow[] = ['minute', 'hour', 'day', 'month']

export class AITokenBudgetManager {
  private readonly limits: Map<string, TenantBudgetLimits> = new Map()
  private readonly records: Map<string, ConsumeRecord[]> = new Map()
  private readonly weights: Map<string, ModelCostWeight> = new Map()
  private readonly listeners: BudgetWarningListener[] = []
  private readonly auditLog: BudgetAuditEntry[] = []
  private warningThreshold = 0.8

  getAuditLog(): readonly BudgetAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: BudgetAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R123.1: 테넌트 예산 등록.
   */
  registerTenant(tenantId: string, limits: TenantBudgetLimits): void {
    if (!tenantId) {
      throw new Error('tenantId required')
    }
    this.limits.set(tenantId, { ...limits })
    if (!this.records.has(tenantId)) {
      this.records.set(tenantId, [])
    }
    this.audit('registerTenant', { tenantId, limits })
  }

  /**
   * FR-R123.5: 모델별 가중치 설정.
   */
  setModelWeight(weight: ModelCostWeight): void {
    if (weight.inputMultiplier < 0 || weight.outputMultiplier < 0) {
      throw new Error('multiplier must be >= 0')
    }
    this.weights.set(weight.model, { ...weight })
    this.audit('setModelWeight', { model: weight.model })
  }

  setWarningThreshold(ratio: number): void {
    if (ratio <= 0 || ratio > 1) {
      throw new Error('ratio must be in (0, 1]')
    }
    this.warningThreshold = ratio
  }

  onWarning(listener: BudgetWarningListener): void {
    this.listeners.push(listener)
  }

  private getEffective(
    model: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const weight = this.weights.get(model)
    const inMul = weight?.inputMultiplier ?? 1
    const outMul = weight?.outputMultiplier ?? 1
    return inputTokens * inMul + outputTokens * outMul
  }

  private windowSum(
    records: ConsumeRecord[],
    window: BudgetWindow,
    now: number,
  ): number {
    const cutoff = now - WINDOW_MS[window]
    let sum = 0
    for (let i = records.length - 1; i >= 0; i--) {
      const rec = records[i]
      if (!rec) continue
      if (rec.timestamp < cutoff) break
      sum += rec.effectiveTokens
    }
    return sum
  }

  private gcOldRecords(records: ConsumeRecord[], now: number): void {
    const cutoff = now - WINDOW_MS.month
    let removeUntil = 0
    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      if (!rec) continue
      if (rec.timestamp < cutoff) {
        removeUntil = i + 1
      } else {
        break
      }
    }
    if (removeUntil > 0) {
      records.splice(0, removeUntil)
    }
  }

  /**
   * FR-R123.2 / FR-R123.4 / FR-R123.6 / FR-R123.8:
   * 토큰 소비 + 한도 검사 + 경고 알림 + 등급 guard.
   */
  consume(req: ConsumeRequest): ConsumeRecord {
    if (req.grade === DataGrade.C || req.grade === DataGrade.S) {
      this.audit('gradeBlocked', { tenantId: req.tenantId, grade: req.grade })
      throw new Error(
        `BLOCKED: ${req.grade}등급 사용자 데이터 토큰 집계 금지 (N2SF N-05)`,
      )
    }
    if (req.inputTokens < 0 || req.outputTokens < 0) {
      throw new Error('token counts must be >= 0')
    }
    const limits = this.limits.get(req.tenantId)
    if (!limits) {
      throw new Error(`Unknown tenant: ${req.tenantId}`)
    }

    const now = req.timestamp ?? Date.now()
    const effective = this.getEffective(
      req.model,
      req.inputTokens,
      req.outputTokens,
    )
    const records = this.records.get(req.tenantId) ?? []
    this.gcOldRecords(records, now)

    // 사전 검사: 추가 시 한도 초과되는 창이 있으면 차단
    for (const window of ALL_WINDOWS) {
      const limit = limits[window]
      if (limit === undefined) continue
      const current = this.windowSum(records, window, now)
      if (current + effective > limit) {
        this.audit('quotaExceeded', {
          tenantId: req.tenantId,
          window,
          limit,
          attempted: current + effective,
        })
        throw new QuotaExceededError(
          req.tenantId,
          window,
          limit,
          current + effective,
        )
      }
    }

    const record: ConsumeRecord = {
      tenantId: req.tenantId,
      model: req.model,
      effectiveTokens: effective,
      timestamp: now,
    }
    records.push(record)
    this.records.set(req.tenantId, records)
    this.audit('consume', {
      tenantId: req.tenantId,
      model: req.model,
      effective,
    })

    // 경고 점검
    for (const window of ALL_WINDOWS) {
      const limit = limits[window]
      if (limit === undefined) continue
      const current = this.windowSum(records, window, now)
      const utilization = limit === 0 ? 0 : current / limit
      if (utilization >= this.warningThreshold) {
        this.audit('warning', {
          tenantId: req.tenantId,
          window,
          utilization,
        })
        for (const listener of this.listeners) {
          try {
            listener({ tenantId: req.tenantId, window, utilization })
          } catch {
            // listener 예외는 무시
          }
        }
      }
    }

    return record
  }

  /**
   * FR-R123.7: 잔여량 조회.
   */
  getRemaining(tenantId: string): RemainingReport {
    const limits = this.limits.get(tenantId)
    if (!limits) {
      throw new Error(`Unknown tenant: ${tenantId}`)
    }
    const records = this.records.get(tenantId) ?? []
    const now = Date.now()
    this.gcOldRecords(records, now)

    const used: Record<BudgetWindow, number> = {
      minute: 0,
      hour: 0,
      day: 0,
      month: 0,
    }
    const remaining: Record<BudgetWindow, number> = {
      minute: 0,
      hour: 0,
      day: 0,
      month: 0,
    }
    const utilization: Record<BudgetWindow, number> = {
      minute: 0,
      hour: 0,
      day: 0,
      month: 0,
    }

    for (const window of ALL_WINDOWS) {
      const u = this.windowSum(records, window, now)
      used[window] = u
      const limit = limits[window]
      if (limit !== undefined) {
        remaining[window] = Math.max(0, limit - u)
        utilization[window] = limit === 0 ? 0 : u / limit
      } else {
        remaining[window] = Number.POSITIVE_INFINITY
        utilization[window] = 0
      }
    }

    return {
      tenantId,
      limits: { ...limits },
      used,
      remaining,
      utilization,
    }
  }
}
