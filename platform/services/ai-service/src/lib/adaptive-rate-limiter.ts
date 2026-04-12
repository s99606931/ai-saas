/**
 * Adaptive Rate Limiter — SVC-AI-ADV-R94
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R94.design.md
 * Plan SC: FR-R94.1 ~ FR-R94.5
 *
 * EWMA + Token Bucket 하이브리드 적응형 레이트 리미터.
 * 공공기관 월말/분기말 트래픽 폭증 자동 대응.
 */

export interface RateRequest {
  tenantId: string
  priority: 'HIGH' | 'NORMAL' | 'LOW'
  timestamp?: number
}

export type RateDecision = 'ALLOW' | 'THROTTLE' | 'DENY'

export interface AdaptiveOptions {
  baseRps: number
  maxMultiplier?: number
  alpha?: number
  windowMs?: number
  now?: () => number
}

export interface TenantStats {
  tenantId: string
  currentRps: number
  ewmaRps: number
  dynamicLimit: number
  allowedCount: number
  throttledCount: number
  deniedCount: number
}

interface TenantState {
  ewmaRps: number
  windowStart: number
  windowCount: number
  allowedCount: number
  throttledCount: number
  deniedCount: number
}

export interface AuditSink {
  log(event: string, detail: Record<string, unknown>): Promise<void>
}

export class AdaptiveRateLimiter {
  private readonly baseRps: number
  private readonly maxMultiplier: number
  private readonly alpha: number
  private readonly windowMs: number
  private readonly now: () => number
  private readonly tenants = new Map<string, TenantState>()

  constructor(opts: AdaptiveOptions) {
    this.baseRps = opts.baseRps
    this.maxMultiplier = opts.maxMultiplier ?? 5
    this.alpha = opts.alpha ?? 0.3
    this.windowMs = opts.windowMs ?? 1000
    this.now = opts.now ?? (() => Date.now())
  }

  /**
   * FR-R94.4: 요청을 평가하여 결정 반환.
   */
  decide(req: RateRequest): RateDecision {
    const ts = req.timestamp ?? this.now()
    const state = this.getOrCreate(req.tenantId)
    this.maybeRollWindow(state, ts)

    // 현재 윈도우 내 요청 수 (FR-R94.1)
    const currentRps = state.windowCount

    // 우선순위별 실효 한도 (FR-R94.2)
    const dynamicLimit = this.computeDynamicLimit(state)
    const effective = this.priorityLimit(dynamicLimit, req.priority)

    let decision: RateDecision
    if (currentRps < effective) {
      decision = 'ALLOW'
      state.allowedCount++
      state.windowCount++
    } else if (req.priority === 'HIGH') {
      decision = 'THROTTLE'
      state.throttledCount++
    } else {
      decision = 'DENY'
      state.deniedCount++
    }

    return decision
  }

  /**
   * FR-R94.3: 테넌트 상태 조회.
   */
  snapshot(tenantId: string): TenantStats {
    const state = this.getOrCreate(tenantId)
    return {
      tenantId,
      currentRps: state.windowCount,
      ewmaRps: state.ewmaRps,
      dynamicLimit: this.computeDynamicLimit(state),
      allowedCount: state.allowedCount,
      throttledCount: state.throttledCount,
      deniedCount: state.deniedCount,
    }
  }

  /**
   * FR-R94.5: 감사 로그 배치 방출.
   */
  async emitAudit(audit: AuditSink): Promise<void> {
    for (const [tenantId, state] of this.tenants) {
      await audit.log('rate.adaptive.snapshot', {
        tenantId,
        ewmaRps: state.ewmaRps,
        allowed: state.allowedCount,
        throttled: state.throttledCount,
        denied: state.deniedCount,
      })
    }
  }

  private priorityLimit(
    dynamicLimit: number,
    priority: RateRequest['priority'],
  ): number {
    switch (priority) {
      case 'HIGH':
        return dynamicLimit
      case 'NORMAL':
        return Math.floor(dynamicLimit * 0.8)
      case 'LOW':
        return Math.floor(dynamicLimit * 0.5)
    }
  }

  private computeDynamicLimit(state: TenantState): number {
    const multiplier = Math.max(
      1,
      Math.min(this.maxMultiplier, state.ewmaRps / this.baseRps),
    )
    return Math.ceil(this.baseRps * multiplier)
  }

  private getOrCreate(tenantId: string): TenantState {
    let state = this.tenants.get(tenantId)
    if (!state) {
      state = {
        ewmaRps: this.baseRps,
        windowStart: this.now(),
        windowCount: 0,
        allowedCount: 0,
        throttledCount: 0,
        deniedCount: 0,
      }
      this.tenants.set(tenantId, state)
    }
    return state
  }

  private maybeRollWindow(state: TenantState, ts: number): void {
    if (ts - state.windowStart < this.windowMs) return

    // FR-R94.1: EWMA 업데이트
    const observedRps = state.windowCount
    state.ewmaRps = this.alpha * observedRps + (1 - this.alpha) * state.ewmaRps
    if (state.ewmaRps < this.baseRps) state.ewmaRps = this.baseRps

    state.windowStart = ts
    state.windowCount = 0
  }
}
