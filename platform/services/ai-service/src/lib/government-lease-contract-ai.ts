// Design Ref: §정부 임대 계약 — 임대료 적정성·위험도 스코어
// Plan SC: FR-R554.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type PropertyType = 'office' | 'warehouse' | 'residential' | 'commercial' | 'land';

export interface LeaseContract {
  contractId: string;
  propertyType: PropertyType;
  areaM2: number;
  monthlyRentKRW: number;
  depositKRW: number;
  termMonths: number;
  marketRentPerM2: number;
}

export interface LeaseReview {
  contractId: string;
  fairnessScore: number; // 0~100
  riskLevel: 'low' | 'medium' | 'high';
  findings: string[];
  verdict: 'approve' | 'review' | 'reject';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class GovernmentLeaseContractAI {
  private contracts = new Map<string, LeaseContract>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R554.1
  registerContract(c: LeaseContract, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (c.areaM2 <= 0) throw new Error('임대 면적은 0보다 커야 합니다');
    if (c.monthlyRentKRW < 0 || c.depositKRW < 0) throw new Error('임대료/보증금은 0 이상이어야 합니다');
    if (c.termMonths < 1) throw new Error('계약 기간은 1개월 이상이어야 합니다');
    if (c.marketRentPerM2 < 0) throw new Error('시세는 0 이상이어야 합니다');
    this.contracts.set(c.contractId, { ...c });
    this.append('REGISTER_CONTRACT', { contractId: c.contractId, propertyType: c.propertyType });
  }

  // Plan SC: FR-R554.2
  review(contractId: string, grade: DataGrade = 'O'): LeaseReview {
    blockClassifiedData(grade);
    const c = this.contracts.get(contractId);
    if (!c) throw new Error(`계약 미등록: ${contractId}`);

    const marketTotal = c.marketRentPerM2 * c.areaM2;
    const deviation = marketTotal === 0 ? 0 : ((c.monthlyRentKRW - marketTotal) / marketTotal) * 100;
    const absDev = Math.abs(deviation);
    const fairnessScore = Math.round(Math.max(0, 100 - absDev) * 100) / 100;

    const findings: string[] = [];
    if (deviation > 15) findings.push(`시세 대비 ${deviation.toFixed(1)}% 초과 — 임대료 재협상 필요`);
    if (deviation < -15) findings.push(`시세 대비 ${Math.abs(deviation).toFixed(1)}% 낮음 — 조건 검토 필요`);
    if (c.depositKRW < c.monthlyRentKRW * 3) findings.push('보증금이 월세 3배 미만 — 담보력 부족');
    if (c.termMonths < 12) findings.push('계약 기간 12개월 미만 — 행정 효율 저하');
    if (c.termMonths > 60) findings.push('계약 기간 60개월 초과 — 장기 리스크 검토');

    let riskLevel: LeaseReview['riskLevel'];
    if (absDev >= 25 || c.depositKRW === 0) riskLevel = 'high';
    else if (absDev >= 10) riskLevel = 'medium';
    else riskLevel = 'low';

    let verdict: LeaseReview['verdict'];
    if (riskLevel === 'high') verdict = 'reject';
    else if (findings.length >= 2 || riskLevel === 'medium') verdict = 'review';
    else verdict = 'approve';

    const result: LeaseReview = { contractId, fairnessScore, riskLevel, findings, verdict };
    this.append('REVIEW', { contractId, verdict, riskLevel });
    return result;
  }

  // Plan SC: FR-R554.3
  totalAnnualCost(propertyType?: PropertyType): number {
    let total = 0;
    for (const c of this.contracts.values()) {
      if (propertyType && c.propertyType !== propertyType) continue;
      total += c.monthlyRentKRW * 12;
    }
    return total;
  }

  // Plan SC: FR-R554.4
  listContracts(propertyType?: PropertyType): LeaseContract[] {
    const all = Array.from(this.contracts.values());
    return (propertyType ? all.filter(c => c.propertyType === propertyType) : all).map(c => ({ ...c }));
  }

  // Plan SC: FR-R554.5
  getContract(contractId: string): LeaseContract | undefined {
    const c = this.contracts.get(contractId);
    return c ? { ...c } : undefined;
  }

  // Plan SC: FR-R554.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
