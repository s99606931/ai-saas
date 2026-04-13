// Design Ref: §세금 탈루 탐지 AI — 거래 패턴 이상치 탐지
// Plan SC: FR-R592.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface TaxpayerRecord {
  taxpayerId: string;
  businessType: 'retail' | 'service' | 'manufacturing' | 'construction' | 'online';
  declaredRevenue: number; // 연간 신고 매출
  declaredIncome: number; // 연간 신고 소득
  cardSales: number; // 카드 매출
  cashDeposits: number; // 현금 입금 내역
  employeeCount: number;
  overseasTransfers: number; // 해외 송금 합계
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface EvasionRisk {
  taxpayerId: string;
  riskLevel: RiskLevel;
  score: number; // 0~100
  indicators: string[];
  recommendedAudit: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class TaxEvasionDetectionAI {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  assess(record: TaxpayerRecord, grade: DataGrade = 'O'): EvasionRisk {
    blockClassifiedData(grade);
    if (record.declaredRevenue < 0) throw new Error('declaredRevenue 음수 불가');

    const indicators: string[] = [];
    let score = 0;

    // 1. 카드매출이 신고 매출보다 큼 (명백한 축소 신고)
    if (record.cardSales > record.declaredRevenue) {
      const gap = record.cardSales - record.declaredRevenue;
      score += 40;
      indicators.push(`카드매출 초과 ${gap.toLocaleString()}원`);
    }

    // 2. 소득률 이상 (신고 소득/매출 < 3%)
    if (record.declaredRevenue > 0) {
      const incomeRate = record.declaredIncome / record.declaredRevenue;
      if (incomeRate < 0.03) {
        score += 20;
        indicators.push(`소득률 ${(incomeRate * 100).toFixed(1)}%`);
      }
    }

    // 3. 현금입금 대비 신고매출 부족
    if (record.cashDeposits > record.declaredRevenue * 1.2) {
      score += 25;
      indicators.push('현금입금이 신고매출 초과');
    }

    // 4. 해외송금 대비 소득 괴리
    if (record.overseasTransfers > record.declaredIncome * 2 && record.overseasTransfers > 100_000_000) {
      score += 20;
      indicators.push('해외송금 과다');
    }

    // 5. 업종별 기대 직원수 대비 차이 (제조업 5명 미만 + 매출 10억↑ = 이상)
    if (record.businessType === 'manufacturing' && record.employeeCount < 5 && record.declaredRevenue > 1_000_000_000) {
      score += 15;
      indicators.push('제조업 직원 대비 매출 과다');
    }

    score = Math.min(100, score);
    const riskLevel: RiskLevel =
      score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';

    const result: EvasionRisk = {
      taxpayerId: record.taxpayerId,
      riskLevel,
      score,
      indicators,
      recommendedAudit: score >= 50,
    };
    this.log('ASSESS', { taxpayerId: record.taxpayerId, riskLevel, score });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
