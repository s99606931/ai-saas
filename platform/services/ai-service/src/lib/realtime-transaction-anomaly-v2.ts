// Design Ref: §R461 — AI기반 실시간 이상 거래 탐지 v2
// Plan SC: SVC-AI-ADV-R461-SC01

export type AnomalyType = 'LARGE_AMOUNT' | 'RAPID_SUCCESSION' | 'UNUSUAL_LOCATION' | 'ROUND_TRIP' | 'VELOCITY_BREACH' | 'OFF_HOURS'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Transaction {
  txId: string
  accountId: string
  amount: number
  currency: string
  timestamp: number
  locationCode: string    // 거래 지역 코드
  merchantCode: string
  reversed?: boolean
}

export interface AnomalyDetectionResult {
  txId: string
  accountId: string
  anomalies: Array<{ type: AnomalyType; severity: RiskLevel; detail: string }>
  riskScore: number      // 0..100
  blocked: boolean
  requiresReview: boolean
}

interface AuditEntry {
  timestamp: string
  action: string
  accountId: string
  detail: Record<string, unknown>
}

export class RealtimeTransactionAnomalyV2 {
  private txHistory = new Map<string, Transaction[]>()   // accountId → txs
  private auditLog: AuditEntry[] = []

  ingest(tx: Transaction): void {
    const list = this.txHistory.get(tx.accountId) ?? []
    list.push(tx)
    this.txHistory.set(tx.accountId, list)
  }

  detect(txId: string): AnomalyDetectionResult {
    // 전체 이력에서 txId 탐색
    let targetTx: Transaction | undefined
    let accountId = ''
    for (const [accId, txList] of this.txHistory.entries()) {
      const found = txList.find((t) => t.txId === txId)
      if (found) { targetTx = found; accountId = accId; break }
    }

    if (!targetTx) throw new Error(`Unknown transaction: ${txId}`)

    // targetTx is guaranteed non-null: early throw above handles the undefined case
    const tx = targetTx
    this.appendAudit('tx.detect', accountId, { txId, amount: tx.amount })

    const history = this.txHistory.get(accountId) ?? []
    const anomalies: AnomalyDetectionResult['anomalies'] = []
    let riskScore = 0

    // 1. 고액 거래 탐지 (500만원 이상)
    if (tx.amount >= 5_000_000) {
      anomalies.push({ type: 'LARGE_AMOUNT', severity: 'HIGH', detail: `고액 거래 ${tx.amount.toLocaleString()}원` })
      riskScore += 25
    }

    // 2. 연속 고속 거래 (60초 내 3건 이상)
    const window60s = history.filter((t) => Math.abs(t.timestamp - tx.timestamp) <= 60_000 && t.txId !== txId)
    if (window60s.length >= 2) {
      anomalies.push({ type: 'RAPID_SUCCESSION', severity: 'HIGH', detail: `60초 내 ${window60s.length + 1}건 연속 거래` })
      riskScore += 30
    }

    // 3. 다중 지역 탐지 (1시간 내 다른 지역)
    const window1h = history.filter((t) => Math.abs(t.timestamp - tx.timestamp) <= 3_600_000 && t.txId !== txId)
    const uniqueLocations = new Set(window1h.map((t) => t.locationCode))
    uniqueLocations.add(tx.locationCode)
    if (uniqueLocations.size >= 3) {
      anomalies.push({ type: 'UNUSUAL_LOCATION', severity: 'CRITICAL', detail: `1시간 내 ${uniqueLocations.size}개 지역 거래` })
      riskScore += 40
    }

    // 4. 왕복 거래 탐지 (동일 계좌 역방향 거래 24시간 내)
    const roundTrip = history.find((t) =>
      t.txId !== txId &&
      t.reversed === true &&
      Math.abs(t.amount - tx.amount) < tx.amount * 0.01 &&
      Math.abs(t.timestamp - tx.timestamp) <= 86_400_000,
    )
    if (roundTrip) {
      anomalies.push({ type: 'ROUND_TRIP', severity: 'MEDIUM', detail: '24시간 내 유사 금액 역방향 거래 탐지' })
      riskScore += 20
    }

    // 5. 야간 거래 (UTC 19~23시 = 한국 04~08시)
    const hour = new Date(tx.timestamp).getUTCHours()
    if (hour >= 19 || hour < 2) {
      anomalies.push({ type: 'OFF_HOURS', severity: 'LOW', detail: `야간 시간대 거래 (UTC ${hour}시)` })
      riskScore += 10
    }

    riskScore = Math.min(100, riskScore)
    const blocked = anomalies.some((a) => a.severity === 'CRITICAL') || riskScore >= 70
    const requiresReview = !blocked && riskScore >= 30

    this.appendAudit('tx.result', accountId, { txId, anomalyCount: anomalies.length, riskScore, blocked })

    return { txId, accountId, anomalies, riskScore, blocked, requiresReview }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, accountId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, accountId, detail })
  }
}
