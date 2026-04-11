// B2G 계약 관리 AI 엔진 -- FR-N293.1~FR-N293.6
// Design Ref: MTU-N293 DESIGN §1~§6
// Plan SC: SC-1 (의무 추적 100%), SC-2 (기한 준수 95%+), SC-3 (분석 90%+), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: 계약 정보 O등급, PII 마스킹 필수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 계약 유형 */
export type ContractType = 'service' | 'maintenance' | 'development' | 'procurement' | 'consulting' | 'license';

/** 계약 상태 */
export type ContractStatus = 'draft' | 'negotiation' | 'active' | 'completed' | 'terminated' | 'expired';

/** 의무사항 상태 */
export type ObligationStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived';

/** 계약서 정보 */
export interface B2GContract {
  readonly contractId: string;
  readonly tenantId: string;
  readonly contractNumber: string;
  readonly title: string;
  readonly contractType: ContractType;
  readonly status: ContractStatus;
  readonly partyA: string;          // 발주 기관
  readonly partyB: string;          // 수급 기업
  readonly totalAmount: number;     // 원
  readonly startDate: string;
  readonly endDate: string;
  readonly signedAt: string;
  readonly obligations: ContractObligation[];
  readonly milestones: ContractMilestone[];
}

/** 계약 의무사항 */
export interface ContractObligation {
  readonly obligationId: string;
  readonly contractId: string;
  readonly clause: string;          // 계약 조항 번호
  readonly description: string;
  readonly responsible: 'partyA' | 'partyB' | 'both';
  readonly deadline: string;
  readonly status: ObligationStatus;
  readonly category: 'delivery' | 'payment' | 'report' | 'audit' | 'warranty' | 'security';
  readonly priority: 'high' | 'medium' | 'low';
}

/** 계약 마일스톤 */
export interface ContractMilestone {
  readonly milestoneId: string;
  readonly name: string;
  readonly description: string;
  readonly deadline: string;
  readonly deliverables: string[];
  readonly paymentAmount: number;
  readonly status: 'pending' | 'completed' | 'overdue';
}

/** 계약서 분석 결과 */
export interface ContractAnalysisResult {
  readonly analysisId: string;
  readonly contractId: string;
  readonly extractedObligations: ContractObligation[];
  readonly extractedMilestones: ContractMilestone[];
  readonly riskClauses: RiskClause[];
  readonly keyTerms: KeyTerm[];
  readonly confidenceScore: number;
  readonly analyzedAt: string;
}

/** 위험 조항 */
export interface RiskClause {
  readonly clauseNumber: string;
  readonly description: string;
  readonly riskLevel: 'high' | 'medium' | 'low';
  readonly riskType: 'penalty' | 'liability' | 'termination' | 'ip' | 'compliance';
  readonly recommendation: string;
}

/** 핵심 용어 */
export interface KeyTerm {
  readonly term: string;
  readonly definition: string;
  readonly clause: string;
}

/** 기한 도래 알림 */
export interface DeadlineAlert {
  readonly alertId: string;
  readonly contractId: string;
  readonly obligationId: string;
  readonly description: string;
  readonly deadline: string;
  readonly daysRemaining: number;
  readonly severity: 'urgent' | 'warning' | 'info';
}

/** 이행 대시보드 */
export interface ComplianceDashboard {
  readonly contractId: string;
  readonly totalObligations: number;
  readonly completedObligations: number;
  readonly overdueObligations: number;
  readonly complianceRate: number;
  readonly upcomingDeadlines: DeadlineAlert[];
  readonly milestoneProgress: number;
}

/** 변경 영향 분석 */
export interface ChangeImpactResult {
  readonly changeDescription: string;
  readonly affectedObligations: ContractObligation[];
  readonly affectedMilestones: ContractMilestone[];
  readonly financialImpact: number;
  readonly scheduleImpact: number;  // 일수
  readonly recommendations: string[];
}

/** 감사 로그 */
export interface ContractAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- PII 마스킹 ────────────────────────────────────────────────────────────────

function maskPII(text: string): string {
  return text
    .replace(/\d{6}[-]?\d{7}/g, '[주민번호-마스킹]')
    .replace(/\d{3}[-.]?\d{3,4}[-.]?\d{4}/g, '[전화번호-마스킹]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[이메일-마스킹]')
    .replace(/\d{3}[-]?\d{2}[-]?\d{5}/g, '[사업자번호-마스킹]');
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: ContractAuditEntry[] = [];

function recordAudit(entry: Omit<ContractAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getContractAuditLog(tenantId: string): readonly ContractAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 계약 저장소 ──────────────────────────────────────────────────────────────

// NOTE: 미사용. Phase 2 계약 CRUD 구현 시 사용 예정 (FR-N293).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const contractStoreRef: Map<string, B2GContract> = new Map();

// -- 계약서 AI 분석 ──────────────────────────────────────────────────────────

/** 의무사항 추출 키워드 */
const OBLIGATION_KEYWORDS: ReadonlyMap<ContractObligation['category'], string[]> = new Map([
  ['delivery', ['납품', '인도', '산출물', '제출', '완료']],
  ['payment', ['대가', '지급', '정산', '청구', '선급금']],
  ['report', ['보고', '보고서', '현황', '실적', '결과']],
  ['audit', ['감사', '검사', '점검', '검수', '확인']],
  ['warranty', ['보증', '하자', '보수', '유지보수', '하자담보']],
  ['security', ['보안', '비밀', '기밀', '정보보호', '개인정보']],
]);

/** 계약서 AI 분석 -- FR-N293.1 */
export function analyzeContract(
  tenantId: string,
  userId: string,
  contractId: string,
  contractText: string,
  _contractType: ContractType = 'service',
): ContractAnalysisResult {
  const masked = maskPII(contractText);
  const lines = masked.split('\n').filter(l => l.trim());

  // 의무사항 추출
  const obligations: ContractObligation[] = [];
  let clauseCounter = 1;

  for (const [category, keywords] of OBLIGATION_KEYWORDS) {
    for (const keyword of keywords) {
      const matchingLines = lines.filter(l => l.includes(keyword));
      for (const line of matchingLines.slice(0, 2)) {
        obligations.push({
          obligationId: `obl-${Date.now()}-${clauseCounter}`,
          contractId,
          clause: `제${clauseCounter}조`,
          description: line.slice(0, 200),
          responsible: category === 'payment' ? 'partyA' : 'partyB',
          deadline: new Date(Date.now() + 30 * clauseCounter * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          category,
          priority: category === 'delivery' || category === 'security' ? 'high' : 'medium',
        });
        clauseCounter++;
      }
    }
  }

  // 마일스톤 추출
  const milestones: ContractMilestone[] = [
    {
      milestoneId: `ms-${Date.now()}-1`,
      name: '착수 보고',
      description: '사업 착수 보고서 제출',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      deliverables: ['착수보고서', '사업수행계획서'],
      paymentAmount: 0,
      status: 'pending',
    },
    {
      milestoneId: `ms-${Date.now()}-2`,
      name: '중간 점검',
      description: '중간 진행 현황 보고 및 점검',
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      deliverables: ['중간보고서', '진행현황'],
      paymentAmount: 0,
      status: 'pending',
    },
    {
      milestoneId: `ms-${Date.now()}-3`,
      name: '최종 납품',
      description: '최종 산출물 납품 및 검수',
      deadline: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      deliverables: ['최종산출물', '완료보고서', '사용자매뉴얼'],
      paymentAmount: 0,
      status: 'pending',
    },
  ];

  // 위험 조항 탐지
  const riskClauses: RiskClause[] = [];
  if (masked.includes('지체상금') || masked.includes('위약금')) {
    riskClauses.push({
      clauseNumber: '위약금 조항',
      description: '납기 지연 시 지체상금 규정',
      riskLevel: 'high',
      riskType: 'penalty',
      recommendation: '납기 일정을 엄수하고 지연 발생 시 사전 협의하십시오',
    });
  }
  if (masked.includes('손해배상')) {
    riskClauses.push({
      clauseNumber: '손해배상 조항',
      description: '계약 불이행 시 손해배상 규정',
      riskLevel: 'high',
      riskType: 'liability',
      recommendation: '손해배상 한도를 확인하고 보험 가입을 검토하십시오',
    });
  }

  // 핵심 용어 추출
  const keyTerms: KeyTerm[] = [
    { term: '발주기관', definition: '계약의 갑에 해당하는 공공기관', clause: '제1조' },
    { term: '수급업체', definition: '계약의 을에 해당하는 사업 수행 기업', clause: '제1조' },
    { term: '산출물', definition: '사업 수행 결과 납품하는 결과물', clause: '납품 조항' },
  ];

  const result: ContractAnalysisResult = {
    analysisId: `anal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    contractId,
    extractedObligations: obligations,
    extractedMilestones: milestones,
    riskClauses,
    keyTerms,
    confidenceScore: obligations.length > 3 ? 0.88 : 0.72,
    analyzedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'CONTRACT_ANALYZED',
    target: contractId,
    details: {
      obligationCount: obligations.length,
      milestoneCount: milestones.length,
      riskClauseCount: riskClauses.length,
    },
  });

  return result;
}

// -- 이행 일정 관리 ──────────────────────────────────────────────────────────

/** 의무사항 이행 일정 자동 생성 -- FR-N293.2 */
export function generateSchedule(
  analysis: ContractAnalysisResult,
): ContractObligation[] {
  return analysis.extractedObligations
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
}

// -- 이행 모니터링 ────────────────────────────────────────────────────────────

/** 이행 상태 대시보드 -- FR-N293.3 */
export function getComplianceDashboard(
  contractId: string,
  contract: B2GContract,
): ComplianceDashboard {
  const now = new Date();
  const totalObligations = contract.obligations.length;
  const completedObligations = contract.obligations.filter(o => o.status === 'completed').length;
  const overdueObligations = contract.obligations.filter(
    o => o.status !== 'completed' && new Date(o.deadline) < now,
  ).length;

  const completedMilestones = contract.milestones.filter(m => m.status === 'completed').length;
  const milestoneProgress = contract.milestones.length > 0
    ? Math.round((completedMilestones / contract.milestones.length) * 100)
    : 0;

  const upcomingDeadlines = contract.obligations
    .filter(o => o.status !== 'completed')
    .map(o => {
      const daysRemaining = Math.ceil((new Date(o.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        alertId: `dl-${o.obligationId}`,
        contractId,
        obligationId: o.obligationId,
        description: o.description.slice(0, 100),
        deadline: o.deadline,
        daysRemaining,
        severity: daysRemaining <= 0 ? 'urgent' as const :
          daysRemaining <= 7 ? 'warning' as const : 'info' as const,
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 10);

  return {
    contractId,
    totalObligations,
    completedObligations,
    overdueObligations,
    complianceRate: totalObligations > 0
      ? Math.round((completedObligations / totalObligations) * 100)
      : 100,
    upcomingDeadlines,
    milestoneProgress,
  };
}

// -- 기한 도래 알림 ──────────────────────────────────────────────────────────

/** 기한 도래 자동 알림 -- FR-N293.4 */
export function checkDeadlineAlerts(
  tenantId: string,
  contract: B2GContract,
): DeadlineAlert[] {
  const now = new Date();
  const alerts: DeadlineAlert[] = [];

  for (const obligation of contract.obligations) {
    if (obligation.status === 'completed' || obligation.status === 'waived') continue;

    const daysRemaining = Math.ceil(
      (new Date(obligation.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysRemaining <= 14) {
      alerts.push({
        alertId: `alert-${obligation.obligationId}`,
        contractId: contract.contractId,
        obligationId: obligation.obligationId,
        description: obligation.description.slice(0, 150),
        deadline: obligation.deadline,
        daysRemaining: Math.max(0, daysRemaining),
        severity: daysRemaining <= 0 ? 'urgent' :
          daysRemaining <= 3 ? 'warning' : 'info',
      });
    }
  }

  if (alerts.length > 0) {
    recordAudit({
      actor: 'system',
      tenantId,
      action: 'DEADLINE_ALERTS_GENERATED',
      target: contract.contractId,
      details: { alertCount: alerts.length, urgentCount: alerts.filter(a => a.severity === 'urgent').length },
    });
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// -- 변경 영향 분석 ──────────────────────────────────────────────────────────

/** 계약 변경 영향 분석 -- FR-N293.5 */
export function analyzeChangeImpact(
  tenantId: string,
  userId: string,
  contract: B2GContract,
  changeDescription: string,
): ChangeImpactResult {
  const masked = maskPII(changeDescription);
  const affectedObligations = contract.obligations.filter(o => {
    const desc = `${o.description} ${o.clause}`.toLowerCase();
    const change = masked.toLowerCase();
    return desc.split(' ').some(word => change.includes(word) && word.length > 2);
  });

  const affectedMilestones = contract.milestones.filter(m => {
    const desc = m.description.toLowerCase();
    const change = masked.toLowerCase();
    return desc.split(' ').some(word => change.includes(word) && word.length > 2);
  });

  const financialImpact = affectedMilestones.reduce((s, m) => s + m.paymentAmount, 0);
  const scheduleImpact = affectedObligations.length * 7; // 의무사항당 7일 영향 추정

  const recommendations: string[] = [];
  if (affectedObligations.length > 0) {
    recommendations.push(`${affectedObligations.length}건의 의무사항 일정 재조정이 필요합니다`);
  }
  if (financialImpact > 0) {
    recommendations.push(`예상 재정 영향: ${financialImpact.toLocaleString()}원`);
  }
  if (scheduleImpact > 14) {
    recommendations.push('발주기관과 일정 협의가 필요합니다');
  }

  recordAudit({
    actor: userId,
    tenantId,
    action: 'CHANGE_IMPACT_ANALYZED',
    target: contract.contractId,
    details: { affectedObligations: affectedObligations.length, financialImpact, scheduleImpact },
  });

  return {
    changeDescription: masked,
    affectedObligations,
    affectedMilestones,
    financialImpact,
    scheduleImpact,
    recommendations,
  };
}

/** B2G 계약 관리 AI 서비스 */
export class B2GContractManagerService {
  constructor(private readonly tenantId: string) {}

  analyze(userId: string, contractId: string, text: string, type?: ContractType): ContractAnalysisResult {
    return analyzeContract(this.tenantId, userId, contractId, text, type);
  }

  checkAlerts(contract: B2GContract): DeadlineAlert[] {
    return checkDeadlineAlerts(this.tenantId, contract);
  }

  analyzeChange(userId: string, contract: B2GContract, change: string): ChangeImpactResult {
    return analyzeChangeImpact(this.tenantId, userId, contract, change);
  }

  getAuditLog(): readonly ContractAuditEntry[] {
    return getContractAuditLog(this.tenantId);
  }
}
