// 전자결재 AI 어시스턴트 -- FR-N281.1~FR-N281.6
// Design Ref: MTU-N281 DESIGN §1~§6
// Plan SC: SC-1 (기안 품질 90%+), SC-2 (결재선 정확도 85%+), SC-3 (PII 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: O등급 데이터만 AI API 전송, PII 마스킹 필수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 공공기관 전자결재 문서 유형 -- Design §1 */
export type ApprovalDocumentType =
  | 'internal_report'       // 내부보고
  | 'external_dispatch'     // 대외발송
  | 'cooperation_request'   // 협조요청
  | 'expense_request'       // 지출요청
  | 'personnel_action'      // 인사조치
  | 'policy_proposal'       // 정책제안
  | 'event_plan'            // 행사계획
  | 'procurement_request'   // 조달요청
  | 'audit_report'          // 감사보고
  | 'regulation_draft'      // 규정제정/개정
  | 'meeting_minutes'       // 회의록
  | 'general';              // 일반

/** 결재 라인 유형 */
export type ApprovalLineType = 'sequential' | 'parallel' | 'conditional';

/** 결재 상태 */
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'returned';

/** 결재자 정보 */
export interface Approver {
  readonly userId: string;
  readonly name: string;
  readonly position: string;       // 직위
  readonly department: string;     // 부서
  readonly role: 'drafter' | 'reviewer' | 'approver' | 'final_approver';
  readonly order: number;
}

/** 기안문 요청 */
export interface DraftDocumentRequest {
  readonly tenantId: string;
  readonly userId: string;
  readonly documentType: ApprovalDocumentType;
  readonly subject: string;         // 제목/주제
  readonly keywords: string[];      // 키워드
  readonly context?: string;        // 추가 맥락
  readonly templateId?: string;     // 기안 템플릿 ID
  readonly urgency: 'normal' | 'urgent' | 'emergency';
}

/** 기안문 생성 결과 */
export interface DraftDocumentResult {
  readonly documentId: string;
  readonly title: string;
  readonly body: string;
  readonly documentType: ApprovalDocumentType;
  readonly templateUsed: string;
  readonly confidenceScore: number;  // 0~1
  readonly suggestions: DocumentSuggestion[];
  readonly createdAt: string;
}

/** 문서 수정 제안 */
export interface DocumentSuggestion {
  readonly type: 'grammar' | 'terminology' | 'format' | 'legal' | 'tone';
  readonly original: string;
  readonly suggested: string;
  readonly reason: string;
  readonly severity: 'info' | 'warning' | 'error';
}

/** 결재선 추천 결과 */
export interface ApprovalLineRecommendation {
  readonly recommendationId: string;
  readonly documentType: ApprovalDocumentType;
  readonly approvalLine: Approver[];
  readonly lineType: ApprovalLineType;
  readonly confidenceScore: number;
  readonly reasoning: string;
  readonly alternatives: Approver[][];
}

/** 기안 템플릿 */
export interface ApprovalTemplate {
  readonly templateId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly documentType: ApprovalDocumentType;
  readonly structure: TemplateSection[];
  readonly defaultApprovalLine?: Approver[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 템플릿 섹션 */
export interface TemplateSection {
  readonly sectionId: string;
  readonly title: string;
  readonly placeholder: string;
  readonly required: boolean;
  readonly order: number;
}

/** 결재 이력 */
export interface ApprovalHistory {
  readonly historyId: string;
  readonly documentType: ApprovalDocumentType;
  readonly department: string;
  readonly approvalLine: Approver[];
  readonly result: ApprovalStatus;
  readonly processedAt: string;
}

/** 감사 로그 항목 */
export interface ApprovalAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
  readonly ip?: string;
}

// -- PII 마스킹 ────────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string; label: string }> = [
  { pattern: /\d{6}[-]?\d{7}/g, replacement: '[주민번호-마스킹]', label: '주민등록번호' },
  { pattern: /\d{3}[-.]?\d{3,4}[-.]?\d{4}/g, replacement: '[전화번호-마스킹]', label: '전화번호' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[이메일-마스킹]', label: '이메일' },
  { pattern: /\d{3}[-]?\d{2}[-]?\d{5}/g, replacement: '[사업자번호-마스킹]', label: '사업자등록번호' },
  { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, replacement: '[IP-마스킹]', label: 'IP주소' },
];

/** PII 마스킹 -- N2SF 필수 */
function maskPII(text: string): { masked: string; maskedFields: string[] } {
  let masked = text;
  const maskedFields: string[] = [];
  for (const { pattern, replacement, label } of PII_PATTERNS) {
    if (pattern.test(masked)) {
      maskedFields.push(label);
      masked = masked.replace(pattern, replacement);
    }
  }
  return { masked, maskedFields };
}

// -- 행정 용어 사전 ──────────────────────────────────────────────────────────────

const ADMIN_TERM_CORRECTIONS: ReadonlyMap<string, string> = new Map([
  ['상기', '위'],
  ['하기', '아래'],
  ['금번', '이번'],
  ['차후', '앞으로'],
  ['동 건', '이 건'],
  ['귀 기관', '귀 기관'],
  ['첨부와 같이', '붙임과 같이'],
  ['상신합니다', '보고합니다'],
  ['결재 바랍니다', '결재하여 주시기 바랍니다'],
  ['검토바랍니다', '검토하여 주시기 바랍니다'],
  ['제출바랍니다', '제출하여 주시기 바랍니다'],
  ['회신바랍니다', '회신하여 주시기 바랍니다'],
]);

// -- 문서 유형별 표준 구조 ─────────────────────────────────────────────────────

const DOCUMENT_STRUCTURES: ReadonlyMap<ApprovalDocumentType, TemplateSection[]> = new Map([
  ['internal_report', [
    { sectionId: 's1', title: '제목', placeholder: '보고 제목', required: true, order: 1 },
    { sectionId: 's2', title: '보고 배경', placeholder: '보고하게 된 배경을 기재', required: true, order: 2 },
    { sectionId: 's3', title: '현황', placeholder: '현재 현황을 기재', required: true, order: 3 },
    { sectionId: 's4', title: '검토 의견', placeholder: '검토 의견을 기재', required: true, order: 4 },
    { sectionId: 's5', title: '향후 계획', placeholder: '향후 계획을 기재', required: false, order: 5 },
    { sectionId: 's6', title: '붙임', placeholder: '첨부 문서 목록', required: false, order: 6 },
  ]],
  ['cooperation_request', [
    { sectionId: 's1', title: '제목', placeholder: '협조 요청 제목', required: true, order: 1 },
    { sectionId: 's2', title: '협조 요청 사유', placeholder: '협조를 요청하는 사유', required: true, order: 2 },
    { sectionId: 's3', title: '협조 요청 사항', placeholder: '구체적 협조 사항', required: true, order: 3 },
    { sectionId: 's4', title: '기한', placeholder: '회신 기한', required: true, order: 4 },
    { sectionId: 's5', title: '붙임', placeholder: '첨부 문서 목록', required: false, order: 5 },
  ]],
  ['expense_request', [
    { sectionId: 's1', title: '제목', placeholder: '지출 요청 제목', required: true, order: 1 },
    { sectionId: 's2', title: '지출 사유', placeholder: '지출 사유 기재', required: true, order: 2 },
    { sectionId: 's3', title: '소요 예산', placeholder: '금액 및 산출 근거', required: true, order: 3 },
    { sectionId: 's4', title: '집행 계획', placeholder: '예산 집행 계획', required: true, order: 4 },
    { sectionId: 's5', title: '붙임', placeholder: '견적서 등 첨부', required: true, order: 5 },
  ]],
  ['external_dispatch', [
    { sectionId: 's1', title: '수신', placeholder: '수신 기관/부서', required: true, order: 1 },
    { sectionId: 's2', title: '제목', placeholder: '공문 제목', required: true, order: 2 },
    { sectionId: 's3', title: '본문', placeholder: '공문 내용', required: true, order: 3 },
    { sectionId: 's4', title: '붙임', placeholder: '첨부 문서', required: false, order: 4 },
  ]],
  ['general', [
    { sectionId: 's1', title: '제목', placeholder: '문서 제목', required: true, order: 1 },
    { sectionId: 's2', title: '내용', placeholder: '문서 내용', required: true, order: 2 },
    { sectionId: 's3', title: '붙임', placeholder: '첨부 문서', required: false, order: 3 },
  ]],
]);

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: ApprovalAuditEntry[] = [];

function recordAudit(entry: Omit<ApprovalAuditEntry, 'timestamp'>): void {
  auditLog.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
}

/** 감사 로그 조회 -- CSAP D-06 */
export function getApprovalAuditLog(tenantId: string): readonly ApprovalAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 템플릿 저장소 ──────────────────────────────────────────────────────────────

const templateStore: Map<string, ApprovalTemplate> = new Map();

/** 기안 템플릿 생성 -- FR-N281.3 */
export function createApprovalTemplate(
  tenantId: string,
  name: string,
  documentType: ApprovalDocumentType,
  sections: TemplateSection[],
  defaultApprovalLine?: Approver[],
): ApprovalTemplate {
  const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const template: ApprovalTemplate = {
    templateId,
    tenantId,
    name,
    documentType,
    structure: sections,
    defaultApprovalLine,
    createdAt: now,
    updatedAt: now,
  };
  templateStore.set(templateId, template);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'TEMPLATE_CREATE',
    target: templateId,
    details: { name, documentType },
  });

  return template;
}

/** 기안 템플릿 조회 */
export function getApprovalTemplate(templateId: string): ApprovalTemplate | undefined {
  return templateStore.get(templateId);
}

/** 테넌트별 기안 템플릿 목록 */
export function listApprovalTemplates(tenantId: string): ApprovalTemplate[] {
  return Array.from(templateStore.values()).filter(t => t.tenantId === tenantId);
}

/** 기안 템플릿 삭제 */
export function deleteApprovalTemplate(tenantId: string, templateId: string): boolean {
  const template = templateStore.get(templateId);
  if (!template || template.tenantId !== tenantId) return false;
  templateStore.delete(templateId);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'TEMPLATE_DELETE',
    target: templateId,
    details: { name: template.name },
  });

  return true;
}

// -- 결재 이력 저장소 ────────────────────────────────────────────────────────────

const approvalHistoryStore: ApprovalHistory[] = [];

/** 결재 이력 등록 -- FR-N281.5 */
export function addApprovalHistory(history: ApprovalHistory): void {
  approvalHistoryStore.push(history);
}

// -- 핵심 기능: 기안문 자동 생성 ────────────────────────────────────────────────

/** 기안문 표준 구조 가져오기 */
function getDocumentStructure(docType: ApprovalDocumentType): TemplateSection[] {
  return DOCUMENT_STRUCTURES.get(docType) ?? DOCUMENT_STRUCTURES.get('general')!;
}

/** 용어 교정 적용 -- FR-N281.4 */
function applyTermCorrections(text: string): DocumentSuggestion[] {
  const suggestions: DocumentSuggestion[] = [];
  for (const [incorrect, correct] of ADMIN_TERM_CORRECTIONS) {
    if (text.includes(incorrect) && incorrect !== correct) {
      suggestions.push({
        type: 'terminology',
        original: incorrect,
        suggested: correct,
        reason: `행정용어 표준화: '${incorrect}' → '${correct}'`,
        severity: 'warning',
      });
    }
  }
  return suggestions;
}

/** 문서 구조 검증 */
function validateDocumentStructure(
  body: string,
  docType: ApprovalDocumentType,
): DocumentSuggestion[] {
  const suggestions: DocumentSuggestion[] = [];
  const sections = getDocumentStructure(docType);
  const requiredSections = sections.filter(s => s.required);

  for (const section of requiredSections) {
    if (!body.includes(section.title)) {
      suggestions.push({
        type: 'format',
        original: '',
        suggested: section.title,
        reason: `필수 섹션 '${section.title}'이(가) 누락되었습니다`,
        severity: 'error',
      });
    }
  }

  return suggestions;
}

/** 기안문 본문 생성 (LLM 프록시) -- FR-N281.1 */
function generateDraftBody(
  docType: ApprovalDocumentType,
  subject: string,
  keywords: string[],
  context?: string,
  template?: ApprovalTemplate,
): string {
  const sections = template?.structure ?? getDocumentStructure(docType);
  const keywordStr = keywords.join(', ');

  const bodyParts: string[] = [];
  for (const section of sections) {
    bodyParts.push(`## ${section.title}`);
    if (section.title === '제목') {
      bodyParts.push(subject);
    } else if (section.title === '붙임') {
      bodyParts.push('- 관련 자료 (별첨)');
    } else {
      // LLM 프록시: 실제 환경에서는 LLM API 호출
      bodyParts.push(
        `[${section.title}] ${subject}에 대한 ${section.placeholder}`,
      );
      if (context) {
        bodyParts.push(`  참고: ${context}`);
      }
      bodyParts.push(`  관련 키워드: ${keywordStr}`);
    }
    bodyParts.push('');
  }

  return bodyParts.join('\n');
}

/** 기안문 자동 생성 -- FR-N281.1 (메인 함수) */
export function generateDraftDocument(request: DraftDocumentRequest): DraftDocumentResult {
  // PII 마스킹 -- N2SF
  const { masked: maskedSubject, maskedFields } = maskPII(request.subject);
  const maskedContext = request.context ? maskPII(request.context).masked : undefined;

  // 템플릿 조회
  const template = request.templateId
    ? templateStore.get(request.templateId)
    : undefined;

  // 기안문 본문 생성
  const body = generateDraftBody(
    request.documentType,
    maskedSubject,
    request.keywords,
    maskedContext,
    template,
  );

  // 용어 교정 제안 -- FR-N281.4
  const termSuggestions = applyTermCorrections(body);

  // 구조 검증
  const structureSuggestions = validateDocumentStructure(body, request.documentType);

  const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result: DraftDocumentResult = {
    documentId,
    title: maskedSubject,
    body,
    documentType: request.documentType,
    templateUsed: template?.name ?? 'default',
    confidenceScore: maskedFields.length > 0 ? 0.85 : 0.92,
    suggestions: [...termSuggestions, ...structureSuggestions],
    createdAt: new Date().toISOString(),
  };

  // 감사 로그 -- CSAP D-06
  recordAudit({
    actor: request.userId,
    tenantId: request.tenantId,
    action: 'DRAFT_GENERATE',
    target: documentId,
    details: {
      documentType: request.documentType,
      piiMasked: maskedFields,
      confidenceScore: result.confidenceScore,
      suggestionCount: result.suggestions.length,
    },
  });

  return result;
}

// -- 핵심 기능: 결재선 추천 ──────────────────────────────────────────────────────

/** 부서별 기본 결재선 매핑 */
const DEFAULT_APPROVAL_LINES: ReadonlyMap<string, Approver[]> = new Map([
  ['general', [
    { userId: 'u-drafter', name: '기안자', position: '담당', department: '해당부서', role: 'drafter', order: 1 },
    { userId: 'u-team-lead', name: '팀장', position: '팀장', department: '해당부서', role: 'reviewer', order: 2 },
    { userId: 'u-dept-head', name: '부서장', position: '부서장', department: '해당부서', role: 'approver', order: 3 },
  ]],
  ['expense_high', [
    { userId: 'u-drafter', name: '기안자', position: '담당', department: '해당부서', role: 'drafter', order: 1 },
    { userId: 'u-team-lead', name: '팀장', position: '팀장', department: '해당부서', role: 'reviewer', order: 2 },
    { userId: 'u-dept-head', name: '부서장', position: '부서장', department: '해당부서', role: 'approver', order: 3 },
    { userId: 'u-finance-head', name: '재무부장', position: '부장', department: '재무부', role: 'approver', order: 4 },
    { userId: 'u-director', name: '기관장', position: '기관장', department: '기관', role: 'final_approver', order: 5 },
  ]],
]);

/** 결재 이력 기반 패턴 분석 -- FR-N281.5 */
function analyzeApprovalPatterns(
  department: string,
  documentType: ApprovalDocumentType,
): Approver[] | undefined {
  const relevantHistory = approvalHistoryStore.filter(
    h => h.department === department &&
      h.documentType === documentType &&
      h.result === 'approved',
  );

  if (relevantHistory.length < 3) return undefined;

  // 최근 승인된 결재선에서 가장 빈번한 패턴 추출
  const linePatterns = new Map<string, { line: Approver[]; count: number }>();
  for (const h of relevantHistory) {
    const key = h.approvalLine.map(a => a.position).join('→');
    const existing = linePatterns.get(key);
    if (existing) {
      existing.count++;
    } else {
      linePatterns.set(key, { line: h.approvalLine, count: 1 });
    }
  }

  // 가장 빈번한 패턴 반환
  let bestPattern: { line: Approver[]; count: number } | undefined;
  for (const pattern of linePatterns.values()) {
    if (!bestPattern || pattern.count > bestPattern.count) {
      bestPattern = pattern;
    }
  }

  return bestPattern?.line;
}

/** 결재선 추천 -- FR-N281.2 */
export function recommendApprovalLine(
  tenantId: string,
  userId: string,
  department: string,
  documentType: ApprovalDocumentType,
  urgency: 'normal' | 'urgent' | 'emergency',
): ApprovalLineRecommendation {
  const recommendationId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. 이력 기반 패턴 분석
  const historyPattern = analyzeApprovalPatterns(department, documentType);

  // 2. 문서 유형별 기본 결재선
  const isHighExpense = documentType === 'expense_request';
  const defaultKey = isHighExpense ? 'expense_high' : 'general';
  const defaultLine = DEFAULT_APPROVAL_LINES.get(defaultKey) ?? [];

  // 3. 긴급도에 따른 결재선 조정
  let approvalLine = historyPattern ?? defaultLine;
  let lineType: ApprovalLineType = 'sequential';

  if (urgency === 'emergency') {
    // 긴급 시 중간 결재 단계 축소
    approvalLine = approvalLine.filter(
      a => a.role === 'drafter' || a.role === 'final_approver' || a.role === 'approver',
    );
    lineType = 'parallel';
  }

  // 대안 결재선 생성
  const alternatives = [defaultLine];
  if (historyPattern) {
    alternatives.push(historyPattern);
  }

  const result: ApprovalLineRecommendation = {
    recommendationId,
    documentType,
    approvalLine,
    lineType,
    confidenceScore: historyPattern ? 0.92 : 0.78,
    reasoning: historyPattern
      ? `최근 ${department} 부서의 ${documentType} 결재 이력 패턴 기반 추천`
      : `${documentType} 문서 유형 기본 결재선 적용`,
    alternatives,
  };

  // 감사 로그
  recordAudit({
    actor: userId,
    tenantId,
    action: 'APPROVAL_LINE_RECOMMEND',
    target: recommendationId,
    details: {
      department,
      documentType,
      urgency,
      confidenceScore: result.confidenceScore,
      lineLength: approvalLine.length,
    },
  });

  return result;
}

// -- 기안문 수정 제안 ────────────────────────────────────────────────────────────

/** 기안문 AI 검토 (문법/용어/구조) -- FR-N281.4 */
export function reviewDraftDocument(
  tenantId: string,
  userId: string,
  documentId: string,
  body: string,
  documentType: ApprovalDocumentType,
): DocumentSuggestion[] {
  const { masked } = maskPII(body);

  // 용어 교정
  const termSuggestions = applyTermCorrections(masked);

  // 구조 검증
  const structureSuggestions = validateDocumentStructure(masked, documentType);

  // 문체 검사
  const toneSuggestions: DocumentSuggestion[] = [];
  if (masked.includes('!')) {
    toneSuggestions.push({
      type: 'tone',
      original: '!',
      suggested: '.',
      reason: '공문서에서 느낌표 사용은 부적절합니다',
      severity: 'warning',
    });
  }
  if (/[ㅋㅎㅠㅜ]/.test(masked)) {
    toneSuggestions.push({
      type: 'tone',
      original: '(인터넷 용어)',
      suggested: '(표준 한국어)',
      reason: '공문서에서 인터넷 축약어 사용은 부적절합니다',
      severity: 'error',
    });
  }

  const allSuggestions = [...termSuggestions, ...structureSuggestions, ...toneSuggestions];

  recordAudit({
    actor: userId,
    tenantId,
    action: 'DRAFT_REVIEW',
    target: documentId,
    details: {
      documentType,
      suggestionCount: allSuggestions.length,
      errorCount: allSuggestions.filter(s => s.severity === 'error').length,
    },
  });

  return allSuggestions;
}

// -- 전자결재 서비스 통합 API ───────────────────────────────────────────────────

/** 전자결재 AI 서비스 -- 통합 인터페이스 */
export class ElectronicApprovalAIService {
  constructor(private readonly tenantId: string) {}

  /** 기안문 생성 */
  generateDraft(request: Omit<DraftDocumentRequest, 'tenantId'>): DraftDocumentResult {
    return generateDraftDocument({ ...request, tenantId: this.tenantId });
  }

  /** 결재선 추천 */
  recommendLine(
    userId: string,
    department: string,
    documentType: ApprovalDocumentType,
    urgency: 'normal' | 'urgent' | 'emergency' = 'normal',
  ): ApprovalLineRecommendation {
    return recommendApprovalLine(this.tenantId, userId, department, documentType, urgency);
  }

  /** 기안문 검토 */
  review(
    userId: string,
    documentId: string,
    body: string,
    documentType: ApprovalDocumentType,
  ): DocumentSuggestion[] {
    return reviewDraftDocument(this.tenantId, userId, documentId, body, documentType);
  }

  /** 템플릿 관리 */
  createTemplate(
    name: string,
    documentType: ApprovalDocumentType,
    sections: TemplateSection[],
  ): ApprovalTemplate {
    return createApprovalTemplate(this.tenantId, name, documentType, sections);
  }

  listTemplates(): ApprovalTemplate[] {
    return listApprovalTemplates(this.tenantId);
  }

  deleteTemplate(templateId: string): boolean {
    return deleteApprovalTemplate(this.tenantId, templateId);
  }

  /** 감사 로그 조회 */
  getAuditLog(): readonly ApprovalAuditEntry[] {
    return getApprovalAuditLog(this.tenantId);
  }
}
