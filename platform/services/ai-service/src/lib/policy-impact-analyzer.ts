// 정책 영향 분석 AI 엔진 -- FR-N284.1~FR-N284.6
// Design Ref: MTU-N284 DESIGN §1~§6
// Plan SC: SC-1 (영향 식별 85%+), SC-2 (분석 시간 60% 단축), SC-3 (PII 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: O등급 데이터만 AI API 전송, PII 마스킹 필수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 정책/법령 변경 유형 */
export type PolicyChangeType =
  | 'new_legislation'      // 신규 제정
  | 'amendment'            // 개정
  | 'repeal'               // 폐지
  | 'executive_order'      // 행정명령
  | 'regulation_change'    // 시행규칙 변경
  | 'guideline_update';    // 지침 변경

/** 영향 범위 */
export type ImpactScope = 'national' | 'regional' | 'departmental' | 'organizational';

/** 영향 수준 */
export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

/** 정책 변경 사항 */
export interface PolicyChange {
  readonly changeId: string;
  readonly policyName: string;
  readonly changeType: PolicyChangeType;
  readonly previousVersion: string;
  readonly newVersion: string;
  readonly changedSections: PolicySection[];
  readonly effectiveDate: string;
  readonly announcedAt: string;
}

/** 정책 섹션 */
export interface PolicySection {
  readonly sectionId: string;
  readonly title: string;
  readonly previousContent: string;
  readonly newContent: string;
  readonly changeDescription: string;
}

/** 이해관계자 */
export interface Stakeholder {
  readonly stakeholderId: string;
  readonly name: string;
  readonly type: 'government' | 'business' | 'citizen' | 'academic' | 'ngo';
  readonly affectedAreas: string[];
  readonly impactLevel: ImpactLevel;
  readonly impactDescription: string;
}

/** 영향 분석 결과 */
export interface ImpactAnalysisResult {
  readonly analysisId: string;
  readonly changeId: string;
  readonly policyName: string;
  readonly changeType: PolicyChangeType;
  readonly overallImpactLevel: ImpactLevel;
  readonly impactScope: ImpactScope;
  readonly affectedStakeholders: Stakeholder[];
  readonly keyChanges: ChangeHighlight[];
  readonly riskAssessment: RiskItem[];
  readonly recommendations: string[];
  readonly analyzedAt: string;
}

/** 변경 하이라이트 */
export interface ChangeHighlight {
  readonly section: string;
  readonly changeType: 'added' | 'modified' | 'removed';
  readonly summary: string;
  readonly impactLevel: ImpactLevel;
}

/** 리스크 항목 */
export interface RiskItem {
  readonly riskId: string;
  readonly description: string;
  readonly likelihood: 'high' | 'medium' | 'low';
  readonly impact: 'high' | 'medium' | 'low';
  readonly mitigation: string;
}

/** 영향 분석 리포트 */
export interface ImpactReport {
  readonly reportId: string;
  readonly analysis: ImpactAnalysisResult;
  readonly executiveSummary: string;
  readonly detailedAnalysis: string;
  readonly actionItems: ActionItem[];
  readonly generatedAt: string;
}

/** 조치 항목 */
export interface ActionItem {
  readonly itemId: string;
  readonly description: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly assignee: string;
  readonly deadline: string;
  readonly status: 'pending' | 'in_progress' | 'completed';
}

/** 감사 로그 */
export interface PolicyAuditEntry {
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
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[이메일-마스킹]');
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: PolicyAuditEntry[] = [];

function recordAudit(entry: Omit<PolicyAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getPolicyAuditLog(tenantId: string): readonly PolicyAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 정책 변경 감지 ──────────────────────────────────────────────────────────────

/** 정책 변경 감지 -- FR-N284.1 */
export function detectPolicyChanges(
  tenantId: string,
  userId: string,
  previousPolicy: string,
  currentPolicy: string,
  policyName: string,
  changeType: PolicyChangeType = 'amendment',
): PolicyChange {
  const prevMasked = maskPII(previousPolicy);
  const currMasked = maskPII(currentPolicy);

  // 문단 단위 비교
  const prevParagraphs = prevMasked.split('\n\n').filter(p => p.trim());
  const currParagraphs = currMasked.split('\n\n').filter(p => p.trim());

  const changedSections: PolicySection[] = [];

  // 신규 섹션 감지
  for (let i = 0; i < currParagraphs.length; i++) {
    const curr = currParagraphs[i] ?? '';
    const prev = prevParagraphs[i] ?? '';

    if (curr !== prev) {
      changedSections.push({
        sectionId: `sec-${i + 1}`,
        title: `섹션 ${i + 1}`,
        previousContent: prev,
        newContent: curr,
        changeDescription: prev ? '내용 변경' : '신규 추가',
      });
    }
  }

  // 삭제된 섹션 감지
  for (let i = currParagraphs.length; i < prevParagraphs.length; i++) {
    changedSections.push({
      sectionId: `sec-${i + 1}`,
      title: `섹션 ${i + 1} (삭제)`,
      previousContent: prevParagraphs[i] ?? '',
      newContent: '',
      changeDescription: '섹션 삭제',
    });
  }

  const changeId = `chg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const change: PolicyChange = {
    changeId,
    policyName,
    changeType,
    previousVersion: `v${prevParagraphs.length}`,
    newVersion: `v${currParagraphs.length}`,
    changedSections,
    effectiveDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    announcedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'POLICY_CHANGE_DETECTED',
    target: changeId,
    details: { policyName, changeType, changedSectionCount: changedSections.length },
  });

  return change;
}

// -- 영향 범위 분석 ──────────────────────────────────────────────────────────────

/** 이해관계자 영향도 분석 -- FR-N284.3, FR-N284.4 */
export function analyzeImpact(
  tenantId: string,
  userId: string,
  change: PolicyChange,
): ImpactAnalysisResult {
  const analysisId = `anal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 변경 하이라이트 추출
  const keyChanges: ChangeHighlight[] = change.changedSections.map(section => ({
    section: section.title,
    changeType: section.newContent === '' ? 'removed' as const :
      section.previousContent === '' ? 'added' as const : 'modified' as const,
    summary: section.changeDescription,
    impactLevel: determineImpactLevel(section),
  }));

  // 이해관계자 식별
  const stakeholders = identifyStakeholders(change);

  // 리스크 평가
  const riskAssessment = assessRisks(change);

  // 전체 영향 수준 결정
  const impactLevels = keyChanges.map(c => c.impactLevel);
  const overallImpactLevel = impactLevels.includes('critical') ? 'critical' :
    impactLevels.includes('high') ? 'high' :
      impactLevels.includes('medium') ? 'medium' : 'low';

  // 영향 범위 결정
  const impactScope: ImpactScope = change.changeType === 'new_legislation' ? 'national' :
    change.changeType === 'executive_order' ? 'regional' : 'departmental';

  // 권고사항 생성
  const recommendations: string[] = [];
  if (overallImpactLevel === 'critical' || overallImpactLevel === 'high') {
    recommendations.push('관련 부서 긴급 회의 소집을 권고합니다');
    recommendations.push('이행 계획 수립 및 예산 확보가 필요합니다');
  }
  if (stakeholders.length > 5) {
    recommendations.push('다수 이해관계자 영향으로 공청회 개최를 검토하십시오');
  }
  if (riskAssessment.some(r => r.likelihood === 'high')) {
    recommendations.push('고위험 항목에 대한 사전 대응 계획을 수립하십시오');
  }

  const result: ImpactAnalysisResult = {
    analysisId,
    changeId: change.changeId,
    policyName: change.policyName,
    changeType: change.changeType,
    overallImpactLevel,
    impactScope,
    affectedStakeholders: stakeholders,
    keyChanges,
    riskAssessment,
    recommendations,
    analyzedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'IMPACT_ANALYZED',
    target: analysisId,
    details: {
      changeId: change.changeId,
      overallImpactLevel,
      stakeholderCount: stakeholders.length,
      riskCount: riskAssessment.length,
    },
  });

  return result;
}

/** 영향 수준 결정 */
function determineImpactLevel(section: PolicySection): ImpactLevel {
  const content = `${section.previousContent} ${section.newContent}`.toLowerCase();
  if (content.includes('금지') || content.includes('폐지') || content.includes('벌칙')) return 'critical';
  if (content.includes('의무') || content.includes('필수') || content.includes('강화')) return 'high';
  if (content.includes('변경') || content.includes('수정') || content.includes('조정')) return 'medium';
  return 'low';
}

/** 이해관계자 식별 */
function identifyStakeholders(change: PolicyChange): Stakeholder[] {
  const stakeholders: Stakeholder[] = [];
  const content = change.changedSections.map(s => s.newContent).join(' ');

  const stakeholderMap: Array<{ keyword: string; name: string; type: Stakeholder['type'] }> = [
    { keyword: '공무원', name: '공무원', type: 'government' },
    { keyword: '기업', name: '관련 기업', type: 'business' },
    { keyword: '국민', name: '일반 국민', type: 'citizen' },
    { keyword: '학교', name: '교육기관', type: 'academic' },
    { keyword: '시민단체', name: '시민사회단체', type: 'ngo' },
    { keyword: '사업자', name: '관련 사업자', type: 'business' },
    { keyword: '주민', name: '지역 주민', type: 'citizen' },
  ];

  for (const { keyword, name, type } of stakeholderMap) {
    if (content.includes(keyword)) {
      stakeholders.push({
        stakeholderId: `sh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        type,
        affectedAreas: [change.policyName],
        impactLevel: 'medium',
        impactDescription: `${change.policyName} ${change.changeType}에 따른 영향`,
      });
    }
  }

  // 최소 1개 이해관계자 보장
  if (stakeholders.length === 0) {
    stakeholders.push({
      stakeholderId: `sh-${Date.now()}`,
      name: '관계 기관',
      type: 'government',
      affectedAreas: [change.policyName],
      impactLevel: 'low',
      impactDescription: '정책 변경에 따른 일반적 영향',
    });
  }

  return stakeholders;
}

/** 리스크 평가 */
function assessRisks(change: PolicyChange): RiskItem[] {
  const risks: RiskItem[] = [];

  if (change.changeType === 'new_legislation' || change.changeType === 'amendment') {
    risks.push({
      riskId: `risk-${Date.now()}-01`,
      description: '이행 기간 부족으로 인한 준수 실패 리스크',
      likelihood: change.changedSections.length > 3 ? 'high' : 'medium',
      impact: 'high',
      mitigation: '이행 로드맵을 수립하고 단계적으로 적용하십시오',
    });
  }

  if (change.changedSections.length > 5) {
    risks.push({
      riskId: `risk-${Date.now()}-02`,
      description: '광범위한 변경으로 인한 혼란 리스크',
      likelihood: 'medium',
      impact: 'medium',
      mitigation: '변경 사항 교육 및 안내 자료를 배포하십시오',
    });
  }

  risks.push({
    riskId: `risk-${Date.now()}-03`,
    description: '기존 시스템/절차와의 충돌 리스크',
    likelihood: 'medium',
    impact: 'medium',
    mitigation: '기존 시스템 영향도를 사전 점검하십시오',
  });

  return risks;
}

// -- 리포트 생성 ────────────────────────────────────────────────────────────────

/** 영향 분석 리포트 생성 -- FR-N284.5 */
export function generateImpactReport(
  tenantId: string,
  userId: string,
  analysis: ImpactAnalysisResult,
): ImpactReport {
  const reportId = `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const executiveSummary = [
    `정책명: ${analysis.policyName}`,
    `변경 유형: ${analysis.changeType}`,
    `영향 수준: ${analysis.overallImpactLevel}`,
    `영향 범위: ${analysis.impactScope}`,
    `이해관계자: ${analysis.affectedStakeholders.length}개 그룹`,
    `리스크 항목: ${analysis.riskAssessment.length}건`,
  ].join('\n');

  const detailedAnalysis = analysis.keyChanges.map(c =>
    `[${c.changeType}] ${c.section}: ${c.summary} (영향: ${c.impactLevel})`,
  ).join('\n');

  const actionItems: ActionItem[] = analysis.recommendations.map((rec, idx) => ({
    itemId: `ai-${idx + 1}`,
    description: rec,
    priority: idx === 0 ? 'high' as const : 'medium' as const,
    assignee: '관련 부서장',
    deadline: new Date(Date.now() + (idx + 1) * 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending' as const,
  }));

  const report: ImpactReport = {
    reportId,
    analysis,
    executiveSummary,
    detailedAnalysis,
    actionItems,
    generatedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'IMPACT_REPORT_GENERATED',
    target: reportId,
    details: { analysisId: analysis.analysisId, actionItemCount: actionItems.length },
  });

  return report;
}

/** 정책 영향 분석 서비스 */
export class PolicyImpactAnalysisService {
  constructor(private readonly tenantId: string) {}

  detectChanges(
    userId: string,
    prevPolicy: string,
    currPolicy: string,
    policyName: string,
    changeType?: PolicyChangeType,
  ): PolicyChange {
    return detectPolicyChanges(this.tenantId, userId, prevPolicy, currPolicy, policyName, changeType);
  }

  analyze(userId: string, change: PolicyChange): ImpactAnalysisResult {
    return analyzeImpact(this.tenantId, userId, change);
  }

  generateReport(userId: string, analysis: ImpactAnalysisResult): ImpactReport {
    return generateImpactReport(this.tenantId, userId, analysis);
  }

  getAuditLog(): readonly PolicyAuditEntry[] {
    return getPolicyAuditLog(this.tenantId);
  }
}
