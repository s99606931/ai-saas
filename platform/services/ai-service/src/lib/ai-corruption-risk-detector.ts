// Design Ref: §부패 리스크 다중 지표 가중 탐지
// Plan SC: FR-R617.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type TransactionType = 'contract' | 'grant' | 'procurement' | 'reimbursement';

interface Transaction {
  id: string;
  officerId: string;
  type: TransactionType;
  amountKRW: number;
  vendorId: string;
  submittedAt: string;
  approverCount: number;
  bidCompetitorCount: number;
}

interface RiskIndicator {
  code: string;
  description: string;
  weight: number;
}

interface RiskAssessment {
  transactionId: string;
  score: number;
  level: 'clear' | 'watch' | 'suspicious' | 'high_risk';
  triggeredIndicators: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const INDICATORS: RiskIndicator[] = [
  { code: 'SINGLE_BID', description: '단일 입찰', weight: 25 },
  { code: 'HIGH_AMOUNT', description: '고액 거래', weight: 20 },
  { code: 'LOW_APPROVER', description: '결재자 1인', weight: 15 },
  { code: 'REPEATED_VENDOR', description: '동일 업체 반복', weight: 20 },
  { code: 'WEEKEND_SUBMIT', description: '주말 접수', weight: 10 },
  { code: 'ROUND_AMOUNT', description: '규정 근접 금액', weight: 10 },
];

export class AICorruptionRiskDetector {
  private transactions = new Map<string, Transaction>();
  private vendorHistory = new Map<string, number>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R617.1
  recordTransaction(tx: Transaction, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (tx.amountKRW < 0) throw new Error('금액은 음수일 수 없음');
    this.transactions.set(tx.id, tx);
    const cur = this.vendorHistory.get(tx.vendorId) ?? 0;
    this.vendorHistory.set(tx.vendorId, cur + 1);
    this.log('RECORD_TX', { id: tx.id, amount: tx.amountKRW });
  }

  // Plan SC: FR-R617.2
  private detectIndicators(tx: Transaction): string[] {
    const hits: string[] = [];
    if (tx.bidCompetitorCount <= 1) hits.push('SINGLE_BID');
    if (tx.amountKRW >= 100_000_000) hits.push('HIGH_AMOUNT');
    if (tx.approverCount <= 1) hits.push('LOW_APPROVER');
    if ((this.vendorHistory.get(tx.vendorId) ?? 0) >= 3) hits.push('REPEATED_VENDOR');

    const day = new Date(tx.submittedAt).getDay();
    if (day === 0 || day === 6) hits.push('WEEKEND_SUBMIT');

    if (tx.amountKRW > 0 && tx.amountKRW % 1_000_000 === 0 && tx.amountKRW >= 50_000_000) {
      hits.push('ROUND_AMOUNT');
    }
    return hits;
  }

  // Plan SC: FR-R617.3
  assess(transactionId: string, grade: DataGrade = DataGrade.O): RiskAssessment {
    blockClassifiedData(grade);
    const tx = this.transactions.get(transactionId);
    if (!tx) throw new Error(`거래 미등록: ${transactionId}`);

    const hits = this.detectIndicators(tx);
    const weightMap = new Map(INDICATORS.map(i => [i.code, i.weight]));
    let score = 0;
    for (const code of hits) {
      score += weightMap.get(code) ?? 0;
    }
    score = Math.min(100, score);

    const level: RiskAssessment['level'] = score >= 70 ? 'high_risk'
      : score >= 40 ? 'suspicious'
      : score >= 20 ? 'watch' : 'clear';

    const result: RiskAssessment = {
      transactionId,
      score,
      level,
      triggeredIndicators: hits,
    };
    this.log('ASSESS', { transactionId, score, level });
    return result;
  }

  // Plan SC: FR-R617.4
  listHighRisk(grade: DataGrade = DataGrade.O): RiskAssessment[] {
    blockClassifiedData(grade);
    const results: RiskAssessment[] = [];
    for (const tx of this.transactions.values()) {
      const r = this.assess(tx.id, grade);
      if (r.level === 'suspicious' || r.level === 'high_risk') results.push(r);
    }
    this.log('LIST_HIGH_RISK', { count: results.length });
    return results;
  }

  // Plan SC: FR-R617.5
  getVendorTransactionCount(vendorId: string): number {
    return this.vendorHistory.get(vendorId) ?? 0;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
