// Design Ref: §설계결정 — AI기반 실시간 거래 이상 탐지 v3
// Plan SC: FR-R622.1~5
import { createHash } from 'crypto'

interface TransactionRule { ruleId: string; name: string; maxAmount: number }
interface TransactionRecord { txId: string; maskedUserId: string; amount: number; anomalous: boolean; timestamp: string }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class RealtimeTransactionAnomalyV3 {
  private rules = new Map<string, TransactionRule>()
  private transactions = new Map<string, TransactionRecord>()
  private auditLog: AuditEntry[] = []

  registerRule(ruleId: string, name: string, maxAmount: number): void {
    this.rules.set(ruleId, { ruleId, name, maxAmount })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_RULE', details: { ruleId, name, maxAmount } })
  }

  recordTransaction(txId: string, userId: string, amount: number, ruleId: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const maskedUserId = createHash('sha256').update(userId).digest('hex').substring(0, 16)
    const rule = this.rules.get(ruleId)
    const anomalous = rule ? amount > rule.maxAmount : false
    this.transactions.set(txId, { txId, maskedUserId, amount, anomalous, timestamp: new Date().toISOString() })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_TRANSACTION', details: { txId, maskedUserId, amount, anomalous } })
  }

  isAnomalous(txId: string): boolean {
    return this.transactions.get(txId)?.anomalous ?? false
  }

  getAnomalousTransactions(): TransactionRecord[] {
    return Array.from(this.transactions.values()).filter(t => t.anomalous)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
