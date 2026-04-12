// Design Ref: §R239 — AI기반 실시간 이상 거래 탐지
// Plan SC: SVC-AI-ADV-R239-SC01

export type TransactionType = 'PAYMENT' | 'TRANSFER' | 'WITHDRAWAL' | 'DEPOSIT'
export type AnomalyType = 'LARGE_AMOUNT' | 'RAPID_SEQUENCE' | 'UNUSUAL_HOUR' | 'FOREIGN_LOCATION' | 'VELOCITY'

export interface TransactionProfile {
  accountId: string
  typicalMaxAmount: number
  typicalHours: number[]  // 0~23
  typicalLocation: string
}

export interface Transaction {
  transactionId: string
  accountId: string
  type: TransactionType
  amount: number
  timestamp: number  // epoch ms
  location: string
}

export interface TransactionAnomaly {
  transactionId: string
  accountId: string
  anomalyType: AnomalyType
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM'
  details: string
  blocked: boolean
  detectedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  accountId: string
  detail: Record<string, unknown>
}

const RAPID_SEQUENCE_WINDOW_MS = 60_000  // 1분
const RAPID_SEQUENCE_COUNT = 5           // 1분 내 5건 이상

export class RealtimeTransactionAnomalyDetector {
  private profiles = new Map<string, TransactionProfile>()
  private history = new Map<string, Transaction[]>()
  private anomalies: TransactionAnomaly[] = []
  private auditLog: AuditEntry[] = []

  registerProfile(profile: TransactionProfile): void {
    this.profiles.set(profile.accountId, profile)
    this.history.set(profile.accountId, [])
    this.appendAudit('profile.register', profile.accountId, { typicalMaxAmount: profile.typicalMaxAmount })
  }

  detect(tx: Transaction): TransactionAnomaly | null {
    const profile = this.profiles.get(tx.accountId)
    if (!profile) throw new Error(`Unknown account: ${tx.accountId}`)

    const txHistory = this.history.get(tx.accountId) ?? []
    txHistory.push(tx)
    this.history.set(tx.accountId, txHistory)

    // 대규모 금액
    if (tx.amount > profile.typicalMaxAmount * 3) {
      const anomaly = this.makeAnomaly(tx, 'LARGE_AMOUNT', 'CRITICAL',
        `거래 금액 ${tx.amount.toLocaleString()}원 — 통상 한도 ${profile.typicalMaxAmount.toLocaleString()}원의 3배 초과`, true)
      return anomaly
    }

    // 비정상 시간대
    const hour = new Date(tx.timestamp).getHours()
    if (!profile.typicalHours.includes(hour)) {
      const anomaly = this.makeAnomaly(tx, 'UNUSUAL_HOUR', 'MEDIUM',
        `${hour}시 거래 — 통상 거래 시간 외`, false)
      return anomaly
    }

    // 이상 위치
    if (tx.location !== profile.typicalLocation && tx.amount > profile.typicalMaxAmount * 0.5) {
      const anomaly = this.makeAnomaly(tx, 'FOREIGN_LOCATION', 'HIGH',
        `비통상 위치 ${tx.location} — 통상 위치: ${profile.typicalLocation}`, false)
      return anomaly
    }

    // 고빈도 거래 (velocity)
    const recentWindow = txHistory.filter((t) => tx.timestamp - t.timestamp <= RAPID_SEQUENCE_WINDOW_MS)
    if (recentWindow.length >= RAPID_SEQUENCE_COUNT) {
      const anomaly = this.makeAnomaly(tx, 'VELOCITY', 'HIGH',
        `1분 내 ${recentWindow.length}건 거래 탐지 — 자동화 거래 의심`, true)
      return anomaly
    }

    return null
  }

  private makeAnomaly(tx: Transaction, type: AnomalyType, severity: 'CRITICAL' | 'HIGH' | 'MEDIUM', details: string, blocked: boolean): TransactionAnomaly {
    const anomaly: TransactionAnomaly = {
      transactionId: tx.transactionId,
      accountId: tx.accountId,
      anomalyType: type,
      severity,
      details,
      blocked,
      detectedAt: new Date().toISOString(),
    }
    this.anomalies.push(anomaly)
    this.appendAudit('anomaly.detected', tx.accountId, { type, severity, blocked, transactionId: tx.transactionId })
    return anomaly
  }

  getAnomalies(accountId?: string): TransactionAnomaly[] {
    if (accountId) return this.anomalies.filter((a) => a.accountId === accountId)
    return [...this.anomalies]
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, accountId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, accountId, detail })
  }
}
