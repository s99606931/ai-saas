// Design Ref: SVC-AI-ADV-R622 — AI기반 실시간 거래 이상 탐지 v3 (impl v4)
// Plan SC: FR-R622.1~5
import { createHash } from 'crypto'

interface Transaction {
  txId: string
  userId: string
  amount: number
  timestamp: number
  merchantCategory: string
}

interface AuditEntry {
  timestamp: string
  action: string
  actor?: string
  details?: Record<string, unknown>
}

type Severity = 'NORMAL' | 'WARNING' | 'CRITICAL'

interface AnomalyResult {
  txId: string
  severity: Severity
  reasons: string[]
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16)
}

export class RealtimeTransactionAnomalyV4 {
  private history = new Map<string, Transaction[]>()
  private auditLog: AuditEntry[] = []

  analyze(tx: Transaction, dataGrade?: 'C' | 'S' | 'O'): AnomalyResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const maskedUserId = maskPII(tx.userId)
    const past = this.history.get(maskedUserId) ?? []
    const reasons: string[] = []

    // Rule 1: amount exceeds historical average × 5
    if (past.length >= 3) {
      const avg = past.reduce((s, t) => s + t.amount, 0) / past.length
      if (tx.amount > avg * 5) reasons.push(`금액 이상: 평균 대비 ${(tx.amount / avg).toFixed(2)}배`)
    }
    // Rule 2: rapid-fire transactions (within 60s)
    const recent = past.filter((t) => tx.timestamp - t.timestamp < 60_000)
    if (recent.length >= 3) reasons.push('60초 내 연속 거래 3건 이상')

    // Rule 3: amount over absolute threshold
    if (tx.amount > 10_000_000) reasons.push('단일 거래 1천만원 초과')

    let severity: Severity = 'NORMAL'
    if (reasons.length >= 2) severity = 'CRITICAL'
    else if (reasons.length === 1) severity = 'WARNING'

    past.push(tx)
    this.history.set(maskedUserId, past)

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_TX',
      actor: maskedUserId,
      details: { txId: tx.txId, severity, amount: tx.amount },
    })

    return { txId: tx.txId, severity, reasons }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
