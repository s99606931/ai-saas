// 정보공개 청구 자동 심사 -- FR-N300.1~FR-N300.6
// Design Ref: MTU-N300 DESIGN §1~§6
// Plan SC: SC-1 (비공개사유 매칭 85%+), SC-2 (심사시간 60초), SC-3 (선례적합도 80%+), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제, D-12 개발보안

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 정보공개 청구서 */
export interface DisclosureRequest {
  readonly requestId: string;
  readonly tenantId: string;
  readonly applicant: string;
  readonly requestDate: string;
  readonly subject: string;
  readonly description: string;
  readonly targetInfo: string;
  readonly purpose: string;
}

/** 비공개 사유 (정보공개법 제9조 제1항 각호) */
export interface NonDisclosureReason {
  readonly reasonNo: number;
  readonly title: string;
  readonly description: string;
  readonly matchScore: number;
  readonly matchedKeywords: string[];
}

/** 심사 결과 */
export interface DisclosureDecision {
  readonly decisionId: string;
  readonly requestId: string;
  readonly decision: 'full_disclosure' | 'partial_disclosure' | 'non_disclosure';
  readonly reasons: NonDisclosureReason[];
  readonly rationale: string;
  readonly precedents: DisclosurePrecedent[];
  readonly confidenceScore: number;
  readonly reviewedAt: string;
}

/** 유사 선례 */
export interface DisclosurePrecedent {
  readonly precedentId: string;
  readonly subject: string;
  readonly decision: string;
  readonly year: number;
  readonly similarity: number;
  readonly reference: string;
}

/** 심사 리포트 */
export interface DisclosureReviewReport {
  readonly reportId: string;
  readonly tenantId: string;
  readonly request: DisclosureRequest;
  readonly decision: DisclosureDecision;
  readonly generatedAt: string;
}

/** 감사 로그 */
export interface DisclosureAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: DisclosureAuditEntry[] = [];

function recordAudit(entry: Omit<DisclosureAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getDisclosureAuditLog(tenantId: string): readonly DisclosureAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 비공개 사유 8호 DB ──────────────────────────────────────────────────────

interface ReasonDef {
  readonly no: number;
  readonly title: string;
  readonly description: string;
  readonly keywords: string[];
}

const NON_DISCLOSURE_REASONS: readonly ReasonDef[] = [
  {
    no: 1,
    title: '법률 비밀·비공개 사항',
    description: '다른 법률 또는 법률에서 위임한 명령에 따라 비밀이나 비공개 사항으로 규정된 정보',
    keywords: ['비밀', '기밀', '대외비', '보안', '군사', '국방'],
  },
  {
    no: 2,
    title: '국가안전보장 관련',
    description: '국가안전보장·국방·통일·외교관계 등에 관한 사항으로서 공개될 경우 국가의 중대한 이익을 현저히 해칠 우려',
    keywords: ['국가안보', '국방', '통일', '외교', '안보', '군사기밀'],
  },
  {
    no: 3,
    title: '국민 생명·안전 관련',
    description: '공개될 경우 국민의 생명·신체 및 재산의 보호에 현저한 지장을 초래할 우려',
    keywords: ['생명', '신체', '안전', '재난', '범죄', '테러'],
  },
  {
    no: 4,
    title: '재판·수사 관련',
    description: '진행 중인 재판에 관련된 정보와 범죄의 예방, 수사, 공소의 제기 및 유지에 지장을 초래할 우려',
    keywords: ['재판', '수사', '공소', '소송', '법원', '검찰', '경찰'],
  },
  {
    no: 5,
    title: '의사결정 과정 정보',
    description: '의사결정 과정 또는 내부검토 과정에 있는 사항으로서 공개될 경우 업무의 공정한 수행에 현저한 지장',
    keywords: ['의사결정', '내부검토', '회의', '심의', '협의', '미확정', '초안'],
  },
  {
    no: 6,
    title: '개인정보',
    description: '해당 정보에 포함되어 있는 성명·주민등록번호 등 개인에 관한 사항으로서 공개될 경우 사생활의 비밀 또는 자유를 침해할 우려',
    keywords: ['개인정보', '주민번호', '성명', '주소', '사생활', '신상', '인사'],
  },
  {
    no: 7,
    title: '경영·영업 비밀',
    description: '법인·단체 또는 개인의 경영상·영업상 비밀에 관한 사항으로서 공개될 경우 정당한 이익을 현저히 해칠 우려',
    keywords: ['영업비밀', '경영', '특허', '노하우', '거래처', '계약조건', '원가'],
  },
  {
    no: 8,
    title: '부동산 투기·이익 관련',
    description: '공개될 경우 부동산 투기, 매점매석 등으로 특정인에게 이익 또는 불이익을 줄 우려',
    keywords: ['부동산', '투기', '매점', '토지', '개발', '보상'],
  },
] as const;

// -- 주제 분류 ────────────────────────────────────────────────────────────────

const SUBJECT_CATEGORIES: Record<string, string[]> = {
  '행정': ['행정', '정책', '계획', '예산', '인사', '조직'],
  '계약': ['계약', '입찰', '낙찰', '조달', '구매'],
  '환경': ['환경', '오염', '폐기물', '대기', '수질'],
  '복지': ['복지', '지원', '보조금', '수당'],
  '교육': ['교육', '학교', '학습', '연수'],
  '건축': ['건축', '건설', '인허가', '개발'],
};

/** 청구서 주제 분류 -- FR-N300.1 */
export function classifySubject(request: DisclosureRequest): string {
  const text = `${request.subject} ${request.description} ${request.targetInfo}`;

  for (const [category, keywords] of Object.entries(SUBJECT_CATEGORIES)) {
    if (keywords.some(kw => text.includes(kw))) {
      return category;
    }
  }
  return '일반';
}

// -- 비공개 사유 매칭 ────────────────────────────────────────────────────────

/** 비공개 사유 자동 매칭 -- FR-N300.2 */
export function matchNonDisclosureReasons(
  request: DisclosureRequest,
): NonDisclosureReason[] {
  const text = `${request.subject} ${request.description} ${request.targetInfo}`.toLowerCase();
  const matchedReasons: NonDisclosureReason[] = [];

  for (const reason of NON_DISCLOSURE_REASONS) {
    const matchedKeywords = reason.keywords.filter(kw =>
      text.includes(kw.toLowerCase()),
    );

    if (matchedKeywords.length > 0) {
      const matchScore = matchedKeywords.length / reason.keywords.length;
      matchedReasons.push({
        reasonNo: reason.no,
        title: reason.title,
        description: reason.description,
        matchScore,
        matchedKeywords,
      });
    }
  }

  return matchedReasons.sort((a, b) => b.matchScore - a.matchScore);
}

// -- 선례 검색 ────────────────────────────────────────────────────────────────

const PRECEDENT_DB: readonly DisclosurePrecedent[] = [
  { precedentId: 'prec-001', subject: '공무원 인사기록 공개', decision: '부분공개 (개인정보 마스킹)', year: 2024, similarity: 0, reference: '행심 2024-001' },
  { precedentId: 'prec-002', subject: '용역 계약 내역 공개', decision: '전체공개', year: 2025, similarity: 0, reference: '행심 2025-010' },
  { precedentId: 'prec-003', subject: '회의록 공개 청구', decision: '비공개 (의사결정 과정)', year: 2024, similarity: 0, reference: '행심 2024-055' },
  { precedentId: 'prec-004', subject: '환경영향평가 자료 공개', decision: '전체공개', year: 2025, similarity: 0, reference: '행심 2025-033' },
  { precedentId: 'prec-005', subject: '수사 관련 문서 공개', decision: '비공개 (수사 중)', year: 2024, similarity: 0, reference: '행심 2024-078' },
];

/** 유사 선례 검색 -- FR-N300.4 */
export function searchPrecedents(request: DisclosureRequest): DisclosurePrecedent[] {
  const text = `${request.subject} ${request.description}`.toLowerCase();
  const scored: DisclosurePrecedent[] = [];

  for (const prec of PRECEDENT_DB) {
    const precWords = prec.subject.split(/\s+/);
    const matchedWords = precWords.filter(w => text.includes(w.toLowerCase()));
    const similarity = precWords.length > 0 ? matchedWords.length / precWords.length : 0;

    if (similarity > 0) {
      scored.push({ ...prec, similarity });
    }
  }

  return scored.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
}

// -- 심사 결정 ────────────────────────────────────────────────────────────────

/** 전체/부분/비공개 판단 -- FR-N300.3 */
export function makeDisclosureDecision(
  tenantId: string,
  request: DisclosureRequest,
): DisclosureDecision {
  const reasons = matchNonDisclosureReasons(request);
  const precedents = searchPrecedents(request);

  let decision: DisclosureDecision['decision'] = 'full_disclosure';
  let rationale = '';
  let confidenceScore = 0.8;

  const highMatchReasons = reasons.filter(r => r.matchScore >= 0.3);

  if (highMatchReasons.length === 0) {
    decision = 'full_disclosure';
    rationale = '비공개 사유에 해당하는 내용이 발견되지 않아 전체 공개 권장';
    confidenceScore = 0.9;
  } else if (highMatchReasons.some(r => r.reasonNo === 6)) {
    decision = 'partial_disclosure';
    rationale = `개인정보(제9조 제1항 제6호) 해당 부분 비식별 처리 후 부분 공개 권장`;
    confidenceScore = 0.85;
  } else if (highMatchReasons.some(r => r.matchScore >= 0.5)) {
    decision = 'non_disclosure';
    const topReason = highMatchReasons[0];
    rationale = topReason
      ? `${topReason.title}(제9조 제1항 제${topReason.reasonNo}호) 해당으로 비공개 권장`
      : '비공개 사유 해당으로 비공개 권장';
    confidenceScore = 0.75;
  } else {
    decision = 'partial_disclosure';
    rationale = '일부 비공개 사유 해당 가능성 있어 부분 공개 검토 권장';
    confidenceScore = 0.65;
  }

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'DISCLOSURE_DECISION_MADE',
    target: request.requestId,
    details: { decision, reasonsMatched: reasons.length, confidenceScore },
  });

  return {
    decisionId: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    requestId: request.requestId,
    decision,
    reasons,
    rationale,
    precedents,
    confidenceScore,
    reviewedAt: new Date().toISOString(),
  };
}

// -- 리포트 생성 ──────────────────────────────────────────────────────────────

/** 심사 리포트 생성 -- FR-N300.5 */
export function generateDisclosureReport(
  tenantId: string,
  request: DisclosureRequest,
  decision: DisclosureDecision,
): DisclosureReviewReport {
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'DISCLOSURE_REPORT_GENERATED',
    target: request.requestId,
    details: { decision: decision.decision },
  });

  return {
    reportId: `disc-rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    request,
    decision,
    generatedAt: new Date().toISOString(),
  };
}

/** 정보공개 심사 서비스 */
export class InfoDisclosureReviewerService {
  constructor(private readonly tenantId: string) {}

  classify(request: DisclosureRequest): string {
    return classifySubject(request);
  }

  review(request: DisclosureRequest): DisclosureDecision {
    return makeDisclosureDecision(this.tenantId, request);
  }

  generateReport(request: DisclosureRequest, decision: DisclosureDecision): DisclosureReviewReport {
    return generateDisclosureReport(this.tenantId, request, decision);
  }

  getAuditLog(): readonly DisclosureAuditEntry[] {
    return getDisclosureAuditLog(this.tenantId);
  }
}
