// Plan SC: SVC-AI-ADV-R637
// Design Ref: §TOKEN_BUCKET — tier별 토큰버킷 + 이상행동 AI 스코어링

type DataGrade = 'O' | 'C' | 'S'
type Tier = 'bronze' | 'silver' | 'gold' | 'platinum'

interface TierConfig {
  capacity: number
  refillPerSecond: number
}

interface BucketState {
  clientId: string
  tier: Tier
  tokens: number
  lastRefill: number
  anomalyScore: number
  blocked: boolean
}

interface RateCheckResult {
  allowed: boolean
  remaining: number
  anomalyScore: number
  reason?: string
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

const TIER_CONFIG: Record<Tier, TierConfig> = {
  bronze: { capacity: 60, refillPerSecond: 1 },
  silver: { capacity: 300, refillPerSecond: 5 },
  gold: { capacity: 1200, refillPerSecond: 20 },
  platinum: { capacity: 6000, refillPerSecond: 100 },
}

export class PublicApiRateLimiterAI {
  private buckets = new Map<string, BucketState>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerClient(clientId: string, tier: Tier): BucketState {
    const cfg = TIER_CONFIG[tier]
    const state: BucketState = {
      clientId,
      tier,
      tokens: cfg.capacity,
      lastRefill: Date.now(),
      anomalyScore: 0,
      blocked: false,
    }
    this.buckets.set(clientId, state)
    this.log('client.register', `clientId=${clientId} tier=${tier}`)
    return state
  }

  check(clientId: string, costTokens = 1, grade: DataGrade = 'O'): RateCheckResult {
    blockClassifiedData(grade)
    const state = this.buckets.get(clientId)
    if (!state) throw new Error('client 미등록')

    if (state.blocked) {
      return { allowed: false, remaining: 0, anomalyScore: state.anomalyScore, reason: 'blocked' }
    }

    const cfg = TIER_CONFIG[state.tier]
    const now = Date.now()
    const elapsed = (now - state.lastRefill) / 1000
    state.tokens = Math.min(cfg.capacity, state.tokens + elapsed * cfg.refillPerSecond)
    state.lastRefill = now

    if (state.tokens < costTokens) {
      state.anomalyScore = Math.min(100, state.anomalyScore + 5)
      if (state.anomalyScore >= 80) state.blocked = true
      this.log('rate.deny', `clientId=${clientId} anomaly=${state.anomalyScore}`)
      return {
        allowed: false,
        remaining: Math.floor(state.tokens),
        anomalyScore: state.anomalyScore,
        reason: 'insufficient-tokens',
      }
    }

    state.tokens -= costTokens
    state.anomalyScore = Math.max(0, state.anomalyScore - 1)
    this.log('rate.allow', `clientId=${clientId} remaining=${Math.floor(state.tokens)}`)
    return { allowed: true, remaining: Math.floor(state.tokens), anomalyScore: state.anomalyScore }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
