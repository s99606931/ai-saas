// 규제 샌드박스 영향도 분석 -- FR-N298.1~FR-N298.6
// Design Ref: MTU-N298 DESIGN §1~§6
// Plan SC: SC-1 (조항분류 80%+), SC-2 (영향산업 75%+), SC-3 (리스크 일관성 85%+), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제, D-12 개발보안

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 규제 조항 */
export interface RegulatoryClause {
  readonly clauseId: string;
  readonly lawName: string;
  readonly articleNo: string;
  readonly content: string;
  readonly clauseType: 'prohibition' | 'obligation' | 'permission' | 'exemption' | 'procedural';
}

/** 영향 산업/서비스 */
export interface AffectedSector {
  readonly sectorName: string;
  readonly impactLevel: 'direct' | 'indirect' | 'minimal';
  readonly affectedEntities: string[];
  readonly description: string;
}

/** 리스크 평가 */
export interface RiskAssessment {
  readonly riskId: string;
  readonly riskLevel: 1 | 2 | 3 | 4 | 5;
  readonly riskCategory: 'legal' | 'operational' | 'financial' | 'reputational' | 'compliance';
  readonly description: string;
  readonly mitigationStrategy: string;
  readonly probability: 'high' | 'medium' | 'low';
}

/** 이해관계자 */
export interface Stakeholder {
  readonly name: string;
  readonly role: 'regulator' | 'regulated' | 'consumer' | 'competitor' | 'advisor';
  readonly impactLevel: 'high' | 'medium' | 'low';
  readonly concerns: string[];
}

/** 규제 샌드박스 분석 결과 */
export interface SandboxAnalysisResult {
  readonly analysisId: string;
  readonly tenantId: string;
  readonly regulationTitle: string;
  readonly clauses: RegulatoryClause[];
  readonly affectedSectors: AffectedSector[];
  readonly risks: RiskAssessment[];
  readonly stakeholders: Stakeholder[];
  readonly overallRiskLevel: number;
  readonly recommendation: string;
  readonly analyzedAt: string;
}

/** 감사 로그 */
export interface SandboxAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: SandboxAuditEntry[] = [];

function recordAudit(entry: Omit<SandboxAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getSandboxAuditLog(tenantId: string): readonly SandboxAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 조항 분류 ────────────────────────────────────────────────────────────────

const CLAUSE_TYPE_KEYWORDS: Record<RegulatoryClause['clauseType'], string[]> = {
  prohibition: ['금지', '불가', '제한', '차단', '금한다'],
  obligation: ['의무', '하여야', '필수', '준수', '이행'],
  permission: ['허용', '가능', '인정', '할 수 있다'],
  exemption: ['면제', '예외', '적용 제외', '특례'],
  procedural: ['절차', '신청', '신고', '보고', '제출'],
};

/** 규제 텍스트 파싱 및 조항 분류 -- FR-N298.1 */
export function parseRegulatoryClauses(
  regulationText: string,
  lawName: string,
): RegulatoryClause[] {
  const articles = regulationText.split(/제\d+조/).filter(a => a.trim().length > 0);
  const clauses: RegulatoryClause[] = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    if (!article) continue;

    let clauseType: RegulatoryClause['clauseType'] = 'procedural';
    for (const [type, keywords] of Object.entries(CLAUSE_TYPE_KEYWORDS)) {
      if (keywords.some(kw => article.includes(kw))) {
        clauseType = type as RegulatoryClause['clauseType'];
        break;
      }
    }

    clauses.push({
      clauseId: `clause-${i + 1}`,
      lawName,
      articleNo: `제${i + 1}조`,
      content: article.trim().slice(0, 500),
      clauseType,
    });
  }

  if (clauses.length === 0) {
    clauses.push({
      clauseId: 'clause-1',
      lawName,
      articleNo: '제1조',
      content: regulationText.slice(0, 500),
      clauseType: 'procedural',
    });
  }

  return clauses;
}

// -- 영향 산업 식별 ──────────────────────────────────────────────────────────

const SECTOR_KEYWORDS: Record<string, string[]> = {
  '정보통신': ['ICT', '통신', '인터넷', '소프트웨어', '클라우드', '데이터'],
  '금융': ['금융', '은행', '보험', '증권', '핀테크', '결제'],
  '의료': ['의료', '건강', '제약', '병원', '헬스케어', '원격진료'],
  '교통': ['교통', '자율주행', '물류', '운송', '모빌리티'],
  '에너지': ['에너지', '전력', '신재생', '탄소', '환경'],
  '교육': ['교육', '학습', 'ed-tech', '학교', '대학'],
  '제조': ['제조', '공장', '스마트팩토리', '생산', '산업'],
  '농업': ['농업', '식품', '축산', '수산', '농촌'],
};

/** 영향 받는 산업/서비스 식별 -- FR-N298.2 */
export function identifyAffectedSectors(
  clauses: RegulatoryClause[],
): AffectedSector[] {
  const allContent = clauses.map(c => c.content).join(' ');
  const sectors: AffectedSector[] = [];

  for (const [sectorName, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    const matchedKeywords = keywords.filter(kw =>
      allContent.toLowerCase().includes(kw.toLowerCase()),
    );

    if (matchedKeywords.length > 0) {
      const impactLevel: AffectedSector['impactLevel'] =
        matchedKeywords.length >= 3 ? 'direct' : matchedKeywords.length >= 2 ? 'indirect' : 'minimal';

      sectors.push({
        sectorName,
        impactLevel,
        affectedEntities: matchedKeywords.map(kw => `${kw} 관련 기업/기관`),
        description: `${sectorName} 분야: ${matchedKeywords.join(', ')} 키워드 탐지`,
      });
    }
  }

  return sectors;
}

// -- 리스크 평가 ──────────────────────────────────────────────────────────────

/** 리스크 등급 평가 -- FR-N298.3 */
export function assessRisks(
  clauses: RegulatoryClause[],
  sectors: AffectedSector[],
): RiskAssessment[] {
  const risks: RiskAssessment[] = [];

  // 금지 조항 리스크
  const prohibitions = clauses.filter(c => c.clauseType === 'prohibition');
  if (prohibitions.length > 0) {
    risks.push({
      riskId: `risk-${Date.now()}-legal`,
      riskLevel: Math.min(5, prohibitions.length + 2) as RiskAssessment['riskLevel'],
      riskCategory: 'legal',
      description: `${prohibitions.length}개 금지 조항 존재 - 현행 사업 영향 가능`,
      mitigationStrategy: '법률 자문 확보, 샌드박스 특례 신청 검토',
      probability: prohibitions.length >= 3 ? 'high' : 'medium',
    });
  }

  // 의무 조항 리스크
  const obligations = clauses.filter(c => c.clauseType === 'obligation');
  if (obligations.length > 0) {
    risks.push({
      riskId: `risk-${Date.now()}-compliance`,
      riskLevel: Math.min(5, obligations.length + 1) as RiskAssessment['riskLevel'],
      riskCategory: 'compliance',
      description: `${obligations.length}개 의무 조항 - 준수 체계 구축 필요`,
      mitigationStrategy: '준수 프로그램 수립, 담당 조직 지정',
      probability: 'medium',
    });
  }

  // 직접 영향 산업 리스크
  const directSectors = sectors.filter(s => s.impactLevel === 'direct');
  if (directSectors.length > 0) {
    risks.push({
      riskId: `risk-${Date.now()}-operational`,
      riskLevel: Math.min(5, directSectors.length + 2) as RiskAssessment['riskLevel'],
      riskCategory: 'operational',
      description: `${directSectors.length}개 산업 직접 영향 - 운영 변경 필요`,
      mitigationStrategy: '영향 산업별 대응 계획 수립',
      probability: 'high',
    });
  }

  // 기본 재정 리스크
  risks.push({
    riskId: `risk-${Date.now()}-financial`,
    riskLevel: 2,
    riskCategory: 'financial',
    description: '규제 준수 비용 발생 가능',
    mitigationStrategy: '준수 비용 사전 추정 및 예산 확보',
    probability: 'medium',
  });

  return risks;
}

// -- 이해관계자 맵핑 ──────────────────────────────────────────────────────────

/** 이해관계자 맵핑 -- FR-N298.4 */
export function mapStakeholders(
  clauses: RegulatoryClause[],
  sectors: AffectedSector[],
): Stakeholder[] {
  const stakeholders: Stakeholder[] = [];

  // 규제기관
  stakeholders.push({
    name: '소관 부처',
    role: 'regulator',
    impactLevel: 'high',
    concerns: ['규제 실효성', '공익 보호', '산업 발전 균형'],
  });

  // 피규제자
  for (const sector of sectors) {
    if (sector.impactLevel === 'direct') {
      stakeholders.push({
        name: `${sector.sectorName} 기업/기관`,
        role: 'regulated',
        impactLevel: 'high',
        concerns: ['사업 영향', '준수 비용', '경쟁력 변화'],
      });
    }
  }

  // 소비자
  if (clauses.some(c => c.content.includes('소비자') || c.content.includes('국민') || c.content.includes('이용자'))) {
    stakeholders.push({
      name: '소비자/국민',
      role: 'consumer',
      impactLevel: 'medium',
      concerns: ['서비스 접근성', '가격 변동', '권익 보호'],
    });
  }

  return stakeholders;
}

// -- 분석 리포트 ──────────────────────────────────────────────────────────────

/** 영향도 분석 리포트 생성 -- FR-N298.5 */
export function analyzeRegulatorySandbox(
  tenantId: string,
  regulationTitle: string,
  regulationText: string,
  lawName: string,
): SandboxAnalysisResult {
  const clauses = parseRegulatoryClauses(regulationText, lawName);
  const affectedSectors = identifyAffectedSectors(clauses);
  const risks = assessRisks(clauses, affectedSectors);
  const stakeholders = mapStakeholders(clauses, affectedSectors);

  const overallRiskLevel = risks.length > 0
    ? risks.reduce((s, r) => s + r.riskLevel, 0) / risks.length
    : 1;

  let recommendation = '규제 샌드박스 신청 적합';
  if (overallRiskLevel >= 4) recommendation = '규제 영향 심대: 단계적 접근 권장';
  else if (overallRiskLevel >= 3) recommendation = '규제 영향 보통: 이해관계자 협의 후 신청';

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'SANDBOX_ANALYSIS_COMPLETED',
    target: regulationTitle,
    details: {
      clausesCount: clauses.length,
      sectorsAffected: affectedSectors.length,
      risksIdentified: risks.length,
      overallRiskLevel,
    },
  });

  return {
    analysisId: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    regulationTitle,
    clauses,
    affectedSectors,
    risks,
    stakeholders,
    overallRiskLevel,
    recommendation,
    analyzedAt: new Date().toISOString(),
  };
}

/** 규제 샌드박스 분석 서비스 */
export class RegulatorySandboxAnalyzerService {
  constructor(private readonly tenantId: string) {}

  analyze(title: string, text: string, lawName: string): SandboxAnalysisResult {
    return analyzeRegulatorySandbox(this.tenantId, title, text, lawName);
  }

  getAuditLog(): readonly SandboxAuditEntry[] {
    return getSandboxAuditLog(this.tenantId);
  }
}
