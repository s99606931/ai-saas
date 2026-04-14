// Design Ref: SVC-AI-ADV-R641.design.md §설계결정
// Plan SC: FR-R641.1~5
// 트랙 B 23차

import { createHash } from 'crypto';

interface TransactionRecord { txId: string; maskedActor: string; amount: number; score: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class FraudPatternRecognizerV3 {
  private transactions = new Map<string, TransactionRecord>();
  private auditLog: AuditEntry[] = [];

  registerTransaction(txId: string, amount: number, actorEmail: string): void {
    const maskedActor = maskPII(actorEmail);
    this.transactions.set(txId, { txId, maskedActor, amount, score: 0 });
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_TX',
      details: { txId, maskedActor, amount },
    });
  }

  evaluate(txId: string, dataGrade?: string): number {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
    const tx = this.transactions.get(txId);
    if (!tx) return 0;
    let score = 0;
    if (tx.amount >= 10000) score += 0.5;
    const sameActorCount = Array.from(this.transactions.values()).filter(
      (t) => t.maskedActor === tx.maskedActor,
    ).length;
    if (sameActorCount >= 3) score += 0.5;
    tx.score = score;
    this.transactions.set(txId, tx);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE_TX',
      details: { txId, score },
    });
    return score;
  }

  getHighRiskTransactions(): TransactionRecord[] {
    return Array.from(this.transactions.values()).filter((t) => t.score >= 0.7);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
