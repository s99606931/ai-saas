// 공문서 AI 자동 검토 엔진 -- FR-N282.1~FR-N282.6
// Design Ref: MTU-N282 DESIGN §1~§6
// Plan SC: SC-1 (법령 적합성 90%+), SC-2 (용어 교정 95%+), SC-3 (PII 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: O등급 데이터만 AI API 전송, PII 마스킹 필수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 법령 정보 */
export interface LawReference {
  readonly lawId: string;
  readonly lawName: string;
  readonly articleNumber: string;
  readonly content: string;
  readonly effectiveDate: string;
  readonly lastModified: string;
}

/** 법령 적합성 검토 결과 */
export interface LegalComplianceResult {
  readonly reviewId: string;
  readonly documentId: string;
  readonly relatedLaws: LawReference[];
  readonly complianceIssues: ComplianceIssue[];
  readonly overallScore: number;  // 0~100
  readonly reviewedAt: string;
}

/** 적합성 이슈 */
export interface ComplianceIssue {
  readonly issueId: string;
  readonly severity: 'critical' | 'major' | 'minor' | 'info';
  readonly category: 'legal_conflict' | 'outdated_reference' | 'missing_citation' | 'term_error';
  readonly location: string;       // 문서 내 위치
  readonly description: string;
  readonly relatedLaw?: LawReference;
  readonly suggestion: string;
}

/** 행정용어 검토 결과 */
export interface TerminologyReviewResult {
  readonly reviewId: string;
  readonly documentId: string;
  readonly corrections: TermCorrection[];
  readonly standardTermsUsed: number;
  readonly nonStandardTerms: number;
  readonly complianceRate: number;  // 0~100
}

/** 용어 교정 항목 */
export interface TermCorrection {
  readonly original: string;
  readonly corrected: string;
  readonly category: 'deprecated' | 'informal' | 'dialect' | 'foreign' | 'abbreviation';
  readonly context: string;
  readonly confidence: number;
}

/** 문서 구조 검증 결과 */
export interface StructureValidationResult {
  readonly isValid: boolean;
  readonly missingElements: string[];
  readonly formatIssues: FormatIssue[];
  readonly score: number;  // 0~100
}

/** 서식 이슈 */
export interface FormatIssue {
  readonly type: 'missing_header' | 'wrong_numbering' | 'missing_date' | 'invalid_format';
  readonly description: string;
  readonly location: string;
  readonly suggestion: string;
}

/** 종합 검토 리포트 */
export interface DocumentReviewReport {
  readonly reportId: string;
  readonly documentId: string;
  readonly tenantId: string;
  readonly legalCompliance: LegalComplianceResult;
  readonly terminology: TerminologyReviewResult;
  readonly structure: StructureValidationResult;
  readonly overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  readonly overallScore: number;
  readonly recommendations: string[];
  readonly reviewedAt: string;
}

/** 감사 로그 항목 */
export interface DocumentReviewAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- PII 마스킹 ────────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\d{6}[-]?\d{7}/g, replacement: '[주민번호-마스킹]' },
  { pattern: /\d{3}[-.]?\d{3,4}[-.]?\d{4}/g, replacement: '[전화번호-마스킹]' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[이메일-마스킹]' },
];

function maskPII(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// -- 행정 용어 사전 ──────────────────────────────────────────────────────────────

/** 비표준 → 표준 행정용어 매핑 */
const STANDARD_TERMS: ReadonlyMap<string, { standard: string; category: TermCorrection['category'] }> = new Map([
  // 한자식/일본식 표현 → 순화
  ['상기', { standard: '위', category: 'deprecated' }],
  ['하기', { standard: '아래', category: 'deprecated' }],
  ['금번', { standard: '이번', category: 'deprecated' }],
  ['차후', { standard: '앞으로', category: 'deprecated' }],
  ['동 건', { standard: '이 건', category: 'deprecated' }],
  ['기 수립', { standard: '이미 수립한', category: 'deprecated' }],
  ['당해', { standard: '해당', category: 'deprecated' }],
  ['소정', { standard: '정해진', category: 'deprecated' }],
  ['제반', { standard: '모든', category: 'deprecated' }],
  ['여하', { standard: '어떠한', category: 'deprecated' }],
  ['불구', { standard: '관계없이', category: 'deprecated' }],
  // 구어체/비격식
  ['걍', { standard: '그냥', category: 'informal' }],
  ['근데', { standard: '그런데', category: 'informal' }],
  ['진짜', { standard: '매우', category: 'informal' }],
  ['완전', { standard: '전적으로', category: 'informal' }],
  // 외래어 대체
  ['컨펌', { standard: '확인', category: 'foreign' }],
  ['피드백', { standard: '의견', category: 'foreign' }],
  ['리뷰', { standard: '검토', category: 'foreign' }],
  ['미팅', { standard: '회의', category: 'foreign' }],
  ['스케줄', { standard: '일정', category: 'foreign' }],
  // 약어
  ['시행조', { standard: '시행 조치', category: 'abbreviation' }],
]);

// -- 법령 데이터베이스 (시뮬레이션) ────────────────────────────────────────────────

const LAW_DATABASE: LawReference[] = [
  {
    lawId: 'law-001',
    lawName: '전자정부법',
    articleNumber: '제2조',
    content: '전자정부의 구현 및 운영 원칙',
    effectiveDate: '2024-01-01',
    lastModified: '2024-06-15',
  },
  {
    lawId: 'law-002',
    lawName: '개인정보 보호법',
    articleNumber: '제15조',
    content: '개인정보의 수집·이용',
    effectiveDate: '2024-03-15',
    lastModified: '2025-09-01',
  },
  {
    lawId: 'law-003',
    lawName: '행정절차법',
    articleNumber: '제24조',
    content: '처분의 방식',
    effectiveDate: '2023-06-01',
    lastModified: '2024-12-01',
  },
  {
    lawId: 'law-004',
    lawName: '공공기록물 관리에 관한 법률',
    articleNumber: '제11조',
    content: '기록물의 생산의무',
    effectiveDate: '2023-01-01',
    lastModified: '2025-03-01',
  },
  {
    lawId: 'law-005',
    lawName: '국가정보화 기본법',
    articleNumber: '제12조',
    content: '정보화 추진 체계',
    effectiveDate: '2024-07-01',
    lastModified: '2025-01-01',
  },
];

/** 키워드 기반 관련 법령 검색 */
function searchRelatedLaws(content: string): LawReference[] {
  const keywords: Array<{ keyword: string; lawIds: string[] }> = [
    { keyword: '전자정부', lawIds: ['law-001'] },
    { keyword: '개인정보', lawIds: ['law-002'] },
    { keyword: '처분', lawIds: ['law-003'] },
    { keyword: '기록물', lawIds: ['law-004'] },
    { keyword: '정보화', lawIds: ['law-005'] },
    { keyword: '정보시스템', lawIds: ['law-001', 'law-005'] },
    { keyword: '보호법', lawIds: ['law-002'] },
    { keyword: '행정', lawIds: ['law-003'] },
  ];

  const matchedLawIds = new Set<string>();
  for (const { keyword, lawIds } of keywords) {
    if (content.includes(keyword)) {
      for (const id of lawIds) matchedLawIds.add(id);
    }
  }

  return LAW_DATABASE.filter(law => matchedLawIds.has(law.lawId));
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: DocumentReviewAuditEntry[] = [];

function recordAudit(entry: Omit<DocumentReviewAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getDocumentReviewAuditLog(tenantId: string): readonly DocumentReviewAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 핵심 기능: 법령 적합성 검토 ────────────────────────────────────────────────

/** 법령 적합성 검토 -- FR-N282.1 */
export function reviewLegalCompliance(
  tenantId: string,
  userId: string,
  documentId: string,
  content: string,
): LegalComplianceResult {
  const masked = maskPII(content);
  const relatedLaws = searchRelatedLaws(masked);
  const issues: ComplianceIssue[] = [];

  // 법령 인용 형식 검사
  const lawCitations = masked.match(/「[^」]+」/g) ?? [];
  for (const citation of lawCitations) {
    const lawName = citation.replace(/[「」]/g, '');
    const found = LAW_DATABASE.find(l => l.lawName === lawName);
    if (!found) {
      issues.push({
        issueId: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        severity: 'major',
        category: 'outdated_reference',
        location: citation,
        description: `인용된 법령 '${lawName}'이(가) 법령 DB에서 확인되지 않습니다`,
        suggestion: '법령명 및 시행일자를 재확인하십시오',
      });
    }
  }

  // 관련 법령 누락 검사
  if (masked.includes('개인정보') && !lawCitations.some(c => c.includes('개인정보 보호법'))) {
    issues.push({
      issueId: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      severity: 'major',
      category: 'missing_citation',
      location: '본문',
      description: '개인정보 관련 내용이 있으나 「개인정보 보호법」 인용이 누락되었습니다',
      relatedLaw: LAW_DATABASE.find(l => l.lawId === 'law-002'),
      suggestion: '「개인정보 보호법」 제15조 등 관련 조항을 인용하십시오',
    });
  }

  const overallScore = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 15);

  const reviewId = `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result: LegalComplianceResult = {
    reviewId,
    documentId,
    relatedLaws,
    complianceIssues: issues,
    overallScore,
    reviewedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'LEGAL_COMPLIANCE_REVIEW',
    target: documentId,
    details: { issueCount: issues.length, overallScore, relatedLawCount: relatedLaws.length },
  });

  return result;
}

// -- 핵심 기능: 행정용어 표준화 검사 ────────────────────────────────────────────

/** 행정용어 표준화 검토 -- FR-N282.2 */
export function reviewTerminology(
  tenantId: string,
  userId: string,
  documentId: string,
  content: string,
): TerminologyReviewResult {
  const masked = maskPII(content);
  const corrections: TermCorrection[] = [];
  let nonStandardCount = 0;

  for (const [term, { standard, category }] of STANDARD_TERMS) {
    const regex = new RegExp(term, 'g');
    const matches = masked.match(regex);
    if (matches) {
      nonStandardCount += matches.length;
      // 주변 컨텍스트 추출
      const idx = masked.indexOf(term);
      const contextStart = Math.max(0, idx - 20);
      const contextEnd = Math.min(masked.length, idx + term.length + 20);
      corrections.push({
        original: term,
        corrected: standard,
        category,
        context: masked.slice(contextStart, contextEnd),
        confidence: category === 'deprecated' ? 0.98 : 0.90,
      });
    }
  }

  // 전체 단어 수 근사 계산
  const totalWords = masked.split(/\s+/).length;
  const standardTermsUsed = totalWords - nonStandardCount;
  const complianceRate = totalWords > 0
    ? Math.round((standardTermsUsed / totalWords) * 100)
    : 100;

  const reviewId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const result: TerminologyReviewResult = {
    reviewId,
    documentId,
    corrections,
    standardTermsUsed,
    nonStandardTerms: nonStandardCount,
    complianceRate: Math.min(100, complianceRate),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'TERMINOLOGY_REVIEW',
    target: documentId,
    details: { correctionCount: corrections.length, complianceRate: result.complianceRate },
  });

  return result;
}

// -- 핵심 기능: 문서 구조 검증 ──────────────────────────────────────────────────

/** 공문서 표준 구조 검증 -- FR-N282.3 */
export function validateDocumentStructure(
  content: string,
  documentType: 'internal' | 'external' | 'regulation' | 'report',
): StructureValidationResult {
  const requiredElements: Record<string, string[]> = {
    internal: ['제목', '보고 배경', '현황', '검토 의견'],
    external: ['수신', '제목', '본문', '발신'],
    regulation: ['제목', '제정 목적', '적용 범위', '용어 정의', '부칙'],
    report: ['제목', '요약', '본문', '결론', '붙임'],
  };

  const required = requiredElements[documentType] ?? requiredElements['internal'] ?? [];
  const missingElements: string[] = [];
  const formatIssues: FormatIssue[] = [];

  for (const element of required) {
    if (!content.includes(element)) {
      missingElements.push(element);
    }
  }

  // 날짜 형식 검사
  const datePattern = /\d{4}[./-]\d{1,2}[./-]\d{1,2}/;
  if (!datePattern.test(content)) {
    formatIssues.push({
      type: 'missing_date',
      description: '문서에 날짜가 포함되어 있지 않습니다',
      location: '문서 전체',
      suggestion: 'YYYY.MM.DD 형식의 날짜를 추가하십시오',
    });
  }

  // 번호 매기기 형식 검사
  const numberingPattern = /^[1-9]\./m;
  const koreanNumbering = /^[가-힣]\./m;
  if (numberingPattern.test(content) && koreanNumbering.test(content)) {
    formatIssues.push({
      type: 'wrong_numbering',
      description: '아라비아 숫자와 한글 번호가 혼용되고 있습니다',
      location: '본문 번호 매기기',
      suggestion: '일관된 번호 체계를 사용하십시오 (1. 가. (1) (가) 순서)',
    });
  }

  const score = Math.max(
    0,
    100 - missingElements.length * 20 - formatIssues.length * 10,
  );

  return {
    isValid: missingElements.length === 0 && formatIssues.length === 0,
    missingElements,
    formatIssues,
    score,
  };
}

// -- 종합 검토 리포트 ────────────────────────────────────────────────────────────

/** 등급 산정 */
function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** 종합 검토 리포트 생성 -- FR-N282.4 */
export function generateDocumentReviewReport(
  tenantId: string,
  userId: string,
  documentId: string,
  content: string,
  documentType: 'internal' | 'external' | 'regulation' | 'report' = 'internal',
): DocumentReviewReport {
  const legal = reviewLegalCompliance(tenantId, userId, documentId, content);
  const terminology = reviewTerminology(tenantId, userId, documentId, content);
  const structure = validateDocumentStructure(content, documentType);

  const overallScore = Math.round(
    legal.overallScore * 0.4 +
    terminology.complianceRate * 0.3 +
    structure.score * 0.3,
  );

  const recommendations: string[] = [];
  if (legal.complianceIssues.length > 0) {
    recommendations.push(`법령 적합성 이슈 ${legal.complianceIssues.length}건을 수정하십시오`);
  }
  if (terminology.corrections.length > 0) {
    recommendations.push(`비표준 용어 ${terminology.corrections.length}건을 표준 용어로 교체하십시오`);
  }
  if (structure.missingElements.length > 0) {
    recommendations.push(`누락된 필수 요소: ${structure.missingElements.join(', ')}`);
  }

  const reportId = `report-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const report: DocumentReviewReport = {
    reportId,
    documentId,
    tenantId,
    legalCompliance: legal,
    terminology,
    structure,
    overallGrade: calculateGrade(overallScore),
    overallScore,
    recommendations,
    reviewedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: userId,
    tenantId,
    action: 'REVIEW_REPORT_GENERATE',
    target: documentId,
    details: { overallScore, grade: report.overallGrade, recommendationCount: recommendations.length },
  });

  return report;
}

/** 공문서 검토 서비스 */
export class OfficialDocumentReviewService {
  constructor(private readonly tenantId: string) {}

  reviewLegal(userId: string, documentId: string, content: string): LegalComplianceResult {
    return reviewLegalCompliance(this.tenantId, userId, documentId, content);
  }

  reviewTerms(userId: string, documentId: string, content: string): TerminologyReviewResult {
    return reviewTerminology(this.tenantId, userId, documentId, content);
  }

  validateStructure(
    content: string,
    type: 'internal' | 'external' | 'regulation' | 'report',
  ): StructureValidationResult {
    return validateDocumentStructure(content, type);
  }

  generateReport(
    userId: string,
    documentId: string,
    content: string,
    type?: 'internal' | 'external' | 'regulation' | 'report',
  ): DocumentReviewReport {
    return generateDocumentReviewReport(this.tenantId, userId, documentId, content, type);
  }

  getAuditLog(): readonly DocumentReviewAuditEntry[] {
    return getDocumentReviewAuditLog(this.tenantId);
  }
}
