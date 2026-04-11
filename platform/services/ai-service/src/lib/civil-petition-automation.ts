// 민원 처리 자동화 플로우 엔진 -- FR-N283.1~FR-N283.7
// Design Ref: MTU-N283 DESIGN §1~§7
// Plan SC: SC-1 (자동 분류 90%+), SC-2 (처리시간 50% 감소), SC-3 (PII 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근 통제, D-12 개발 보안
// N2SF: O등급 데이터만 AI API 전송, PII 마스킹 필수

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 민원 채널 */
export type PetitionChannel =
  | 'online_portal'        // 온라인 민원 포털
  | 'phone'                // 전화
  | 'visit'                // 방문
  | 'mail'                 // 우편
  | 'email'                // 이메일
  | 'national_petition'    // 국민신문고
  | 'e_minwon';            // e민원

/** 민원 카테고리 */
export type PetitionCategory =
  | 'civil_complaint'      // 민원
  | 'suggestion'           // 제안
  | 'inquiry'              // 문의
  | 'objection'            // 이의신청
  | 'appeal'               // 심판청구
  | 'disclosure_request'   // 정보공개청구
  | 'reporting';           // 신고

/** 민원 우선순위 */
export type PetitionPriority = 'low' | 'medium' | 'high' | 'urgent' | 'emergency';

/** 민원 상태 */
export type PetitionStatus =
  | 'received'             // 접수
  | 'classified'           // 분류완료
  | 'assigned'             // 배정완료
  | 'in_progress'          // 처리중
  | 'pending_review'       // 검토대기
  | 'replied'              // 회신완료
  | 'closed'               // 종결
  | 'escalated';           // 상위회부

/** 민원 접수 정보 */
export interface PetitionIntake {
  readonly petitionId: string;
  readonly tenantId: string;
  readonly channel: PetitionChannel;
  readonly category?: PetitionCategory;
  readonly subject: string;
  readonly content: string;
  readonly petitionerName: string;
  readonly petitionerContact: string;
  readonly attachments: string[];
  readonly receivedAt: string;
}

/** 자동 분류 결과 */
export interface ClassificationResult {
  readonly petitionId: string;
  readonly category: PetitionCategory;
  readonly priority: PetitionPriority;
  readonly department: string;
  readonly confidenceScore: number;
  readonly keywords: string[];
  readonly relatedPetitions: string[];
  readonly classifiedAt: string;
}

/** 담당자 배정 결과 */
export interface AssignmentResult {
  readonly petitionId: string;
  readonly assignedTo: string;
  readonly assignedDepartment: string;
  readonly workload: number;      // 현재 처리 건수
  readonly estimatedDays: number;  // 예상 처리일
  readonly assignedAt: string;
}

/** 유사 민원 검색 결과 */
export interface SimilarPetitionResult {
  readonly petitionId: string;
  readonly subject: string;
  readonly category: PetitionCategory;
  readonly resolution: string;
  readonly similarity: number;   // 0~1
}

/** 자동 회신 초안 */
export interface ReplyDraft {
  readonly petitionId: string;
  readonly greeting: string;
  readonly body: string;
  readonly closing: string;
  readonly legalBasis: string[];
  readonly confidenceScore: number;
  readonly requiresHumanReview: boolean;
}

/** SLA 모니터링 항목 */
export interface PetitionSLA {
  readonly petitionId: string;
  readonly category: PetitionCategory;
  readonly maxProcessingDays: number;
  readonly elapsedDays: number;
  readonly remainingDays: number;
  readonly isOverdue: boolean;
  readonly warningLevel: 'green' | 'yellow' | 'red';
}

/** 감사 로그 */
export interface PetitionAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly petitionId: string;
  readonly details: Record<string, unknown>;
}

// -- PII 마스킹 ────────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\d{6}[-]?\d{7}/g, replacement: '[주민번호-마스킹]' },
  { pattern: /\d{3}[-.]?\d{3,4}[-.]?\d{4}/g, replacement: '[전화번호-마스킹]' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[이메일-마스킹]' },
  { pattern: /[가-힣]{2,4}(?=\s*님|\s*씨|\s*귀하)/g, replacement: '[이름-마스킹]' },
];

function maskPII(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: PetitionAuditEntry[] = [];

function recordAudit(entry: Omit<PetitionAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getPetitionAuditLog(tenantId: string): readonly PetitionAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- SLA 기준 ────────────────────────────────────────────────────────────────

const SLA_DAYS: ReadonlyMap<PetitionCategory, number> = new Map([
  ['civil_complaint', 14],
  ['suggestion', 30],
  ['inquiry', 7],
  ['objection', 21],
  ['appeal', 60],
  ['disclosure_request', 10],
  ['reporting', 14],
]);

// -- 부서 매핑 ────────────────────────────────────────────────────────────────

const CATEGORY_DEPARTMENT_MAP: ReadonlyMap<PetitionCategory, string> = new Map([
  ['civil_complaint', '민원담당과'],
  ['suggestion', '기획조정과'],
  ['inquiry', '민원담당과'],
  ['objection', '법무담당과'],
  ['appeal', '법무담당과'],
  ['disclosure_request', '총무과'],
  ['reporting', '감사담당관'],
]);

// -- 키워드 기반 분류 사전 ─────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: ReadonlyMap<PetitionCategory, string[]> = new Map([
  ['civil_complaint', ['불편', '문제', '시정', '요청', '개선', '민원', '불만', '피해']],
  ['suggestion', ['제안', '건의', '아이디어', '개선안', '방안']],
  ['inquiry', ['문의', '질문', '알고싶', '안내', '확인', '조회']],
  ['objection', ['이의', '부당', '취소', '철회', '재심', '불복']],
  ['appeal', ['심판', '청구', '행정소송', '불복']],
  ['disclosure_request', ['정보공개', '자료요청', '열람', '공개청구']],
  ['reporting', ['신고', '고발', '제보', '위반', '불법']],
]);

// -- 핵심 기능: 민원 접수 파싱 ──────────────────────────────────────────────────

/** 민원 접수 자동 파싱 -- FR-N283.1 */
export function parsePetitionIntake(
  tenantId: string,
  channel: PetitionChannel,
  rawContent: string,
  petitionerName: string,
  petitionerContact: string,
  attachments: string[] = [],
): PetitionIntake {
  const petitionId = `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 제목 자동 추출 (첫 줄 또는 첫 50자)
  const lines = rawContent.split('\n').filter(l => l.trim());
  const subject = lines[0]?.slice(0, 100) ?? '제목 없음';
  const content = rawContent;

  const intake: PetitionIntake = {
    petitionId,
    tenantId,
    channel,
    subject,
    content,
    petitionerName,
    petitionerContact,
    attachments,
    receivedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'PETITION_RECEIVED',
    petitionId,
    details: { channel, hasAttachments: attachments.length > 0 },
  });

  return intake;
}

// -- 핵심 기능: AI 기반 자동 분류 ──────────────────────────────────────────────

/** 민원 자동 분류 -- FR-N283.2 */
export function classifyPetition(
  tenantId: string,
  intake: PetitionIntake,
): ClassificationResult {
  const masked = maskPII(intake.content);
  const maskedSubject = maskPII(intake.subject);

  // 키워드 매칭 기반 분류
  let bestCategory: PetitionCategory = 'civil_complaint';
  let bestScore = 0;
  const detectedKeywords: string[] = [];

  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const keyword of keywords) {
      if (masked.includes(keyword) || maskedSubject.includes(keyword)) {
        score += 1;
        detectedKeywords.push(keyword);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // 우선순위 산정
  let priority: PetitionPriority = 'medium';
  const urgentKeywords = ['긴급', '즉시', '위험', '안전', '사고', '응급'];
  const hasUrgent = urgentKeywords.some(k => masked.includes(k));
  if (hasUrgent) priority = 'urgent';
  else if (bestCategory === 'appeal' || bestCategory === 'objection') priority = 'high';
  else if (bestCategory === 'inquiry') priority = 'low';

  const department = CATEGORY_DEPARTMENT_MAP.get(bestCategory) ?? '민원담당과';
  const confidenceScore = Math.min(0.99, 0.6 + bestScore * 0.1);

  const result: ClassificationResult = {
    petitionId: intake.petitionId,
    category: bestCategory,
    priority,
    department,
    confidenceScore,
    keywords: detectedKeywords,
    relatedPetitions: [],
    classifiedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'PETITION_CLASSIFIED',
    petitionId: intake.petitionId,
    details: {
      category: bestCategory,
      priority,
      confidenceScore,
      keywordCount: detectedKeywords.length,
    },
  });

  return result;
}

// -- 핵심 기능: 담당자 자동 배정 ────────────────────────────────────────────────

/** 담당자 워크로드 (시뮬레이션) */
const staffWorkload: Map<string, { name: string; department: string; currentLoad: number }> = new Map([
  ['staff-001', { name: '김담당', department: '민원담당과', currentLoad: 5 }],
  ['staff-002', { name: '이담당', department: '민원담당과', currentLoad: 3 }],
  ['staff-003', { name: '박담당', department: '기획조정과', currentLoad: 4 }],
  ['staff-004', { name: '최담당', department: '법무담당과', currentLoad: 2 }],
  ['staff-005', { name: '정담당', department: '총무과', currentLoad: 6 }],
  ['staff-006', { name: '한담당', department: '감사담당관', currentLoad: 1 }],
]);

/** 담당자 자동 배정 -- FR-N283.3 */
export function assignPetition(
  tenantId: string,
  petitionId: string,
  classification: ClassificationResult,
): AssignmentResult {
  // 해당 부서 직원 중 워크로드가 가장 적은 담당자 배정
  let bestStaff: { id: string; name: string; load: number } | undefined;

  for (const [id, staff] of staffWorkload) {
    if (staff.department === classification.department) {
      if (!bestStaff || staff.currentLoad < bestStaff.load) {
        bestStaff = { id, name: staff.name, load: staff.currentLoad };
      }
    }
  }

  const assignedTo = bestStaff?.id ?? 'staff-001';
  const slaMaxDays = SLA_DAYS.get(classification.category) ?? 14;
  const estimatedDays = Math.ceil(slaMaxDays * 0.7); // 예상 처리일 = SLA의 70%

  // 워크로드 업데이트
  const staff = staffWorkload.get(assignedTo);
  if (staff) {
    staffWorkload.set(assignedTo, { ...staff, currentLoad: staff.currentLoad + 1 });
  }

  const result: AssignmentResult = {
    petitionId,
    assignedTo,
    assignedDepartment: classification.department,
    workload: bestStaff?.load ?? 0,
    estimatedDays,
    assignedAt: new Date().toISOString(),
  };

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'PETITION_ASSIGNED',
    petitionId,
    details: { assignedTo, department: classification.department, estimatedDays },
  });

  return result;
}

// -- 핵심 기능: 유사 민원 검색 ──────────────────────────────────────────────────

const resolvedPetitions: SimilarPetitionResult[] = [
  {
    petitionId: 'pet-resolved-001',
    subject: '도로 파손 민원',
    category: 'civil_complaint',
    resolution: '도로보수팀 현장 조사 후 3일 이내 보수 완료',
    similarity: 0,
  },
  {
    petitionId: 'pet-resolved-002',
    subject: '정보공개 요청',
    category: 'disclosure_request',
    resolution: '「공공기관의 정보공개에 관한 법률」에 따라 10일 이내 공개',
    similarity: 0,
  },
];

/** 유사 민원 검색 -- FR-N283.4 */
export function searchSimilarPetitions(
  content: string,
  category: PetitionCategory,
  limit: number = 5,
): SimilarPetitionResult[] {
  const masked = maskPII(content);
  const words = masked.split(/\s+/);

  return resolvedPetitions
    .filter(p => p.category === category)
    .map(p => {
      // 단순 단어 중복 기반 유사도 (실제로는 임베딩 기반)
      const petitionWords = p.subject.split(/\s+/);
      const overlap = words.filter(w => petitionWords.some(pw => pw.includes(w) || w.includes(pw)));
      const similarity = Math.min(1, overlap.length / Math.max(1, words.length) + 0.3);
      return { ...p, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

// -- 핵심 기능: 자동 회신 생성 ────────────────────────────────────────────────

/** 회신 템플릿 */
const REPLY_TEMPLATES: ReadonlyMap<PetitionCategory, { greeting: string; closing: string }> = new Map([
  ['civil_complaint', {
    greeting: '안녕하십니까. 귀하의 민원에 대하여 아래와 같이 답변드립니다.',
    closing: '앞으로도 더 나은 행정 서비스를 위해 노력하겠습니다. 감사합니다.',
  }],
  ['inquiry', {
    greeting: '안녕하십니까. 문의하신 사항에 대하여 아래와 같이 안내드립니다.',
    closing: '추가 문의 사항이 있으시면 언제든지 연락 주시기 바랍니다. 감사합니다.',
  }],
  ['disclosure_request', {
    greeting: '안녕하십니까. 귀하의 정보공개 청구에 대하여 아래와 같이 결정 통지합니다.',
    closing: '「공공기관의 정보공개에 관한 법률」에 따라 처리하였습니다. 감사합니다.',
  }],
]);

/** 자동 회신 초안 생성 -- FR-N283.5 */
export function generateReplyDraft(
  tenantId: string,
  petitionId: string,
  category: PetitionCategory,
  resolution: string,
  similarResults: SimilarPetitionResult[],
): ReplyDraft {
  const template = REPLY_TEMPLATES.get(category) ?? REPLY_TEMPLATES.get('civil_complaint')!;

  // 유사 민원 해결 사례 참고
  const firstSimilar = similarResults[0];
  const referenceResolution = firstSimilar
    ? firstSimilar.resolution
    : '';

  const body = referenceResolution
    ? `${resolution}\n\n참고: ${referenceResolution}`
    : resolution;

  const legalBasis: string[] = [];
  if (category === 'disclosure_request') {
    legalBasis.push('「공공기관의 정보공개에 관한 법률」 제9조');
  }
  if (category === 'objection' || category === 'appeal') {
    legalBasis.push('「행정심판법」 제27조');
  }

  const draft: ReplyDraft = {
    petitionId,
    greeting: template.greeting,
    body: maskPII(body),
    closing: template.closing,
    legalBasis,
    confidenceScore: similarResults.length > 0 ? 0.88 : 0.72,
    requiresHumanReview: category === 'objection' || category === 'appeal',
  };

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'REPLY_DRAFT_GENERATED',
    petitionId,
    details: {
      category,
      confidenceScore: draft.confidenceScore,
      requiresHumanReview: draft.requiresHumanReview,
    },
  });

  return draft;
}

// -- 핵심 기능: SLA 모니터링 ────────────────────────────────────────────────────

/** SLA 모니터링 -- FR-N283.6 */
export function checkPetitionSLA(
  petitionId: string,
  category: PetitionCategory,
  receivedAt: string,
): PetitionSLA {
  const maxDays = SLA_DAYS.get(category) ?? 14;
  const received = new Date(receivedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - received.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const remainingDays = maxDays - elapsedDays;

  let warningLevel: 'green' | 'yellow' | 'red' = 'green';
  if (remainingDays <= 0) warningLevel = 'red';
  else if (remainingDays <= Math.ceil(maxDays * 0.3)) warningLevel = 'yellow';

  return {
    petitionId,
    category,
    maxProcessingDays: maxDays,
    elapsedDays,
    remainingDays: Math.max(0, remainingDays),
    isOverdue: remainingDays <= 0,
    warningLevel,
  };
}

// -- 통합 서비스 ────────────────────────────────────────────────────────────────

/** 민원 처리 자동화 서비스 */
export class CivilPetitionAutomationService {
  constructor(private readonly tenantId: string) {}

  /** 민원 접수 */
  receive(
    channel: PetitionChannel,
    content: string,
    name: string,
    contact: string,
    attachments?: string[],
  ): PetitionIntake {
    return parsePetitionIntake(this.tenantId, channel, content, name, contact, attachments);
  }

  /** 자동 분류 */
  classify(intake: PetitionIntake): ClassificationResult {
    return classifyPetition(this.tenantId, intake);
  }

  /** 담당자 배정 */
  assign(petitionId: string, classification: ClassificationResult): AssignmentResult {
    return assignPetition(this.tenantId, petitionId, classification);
  }

  /** 유사 민원 검색 */
  searchSimilar(content: string, category: PetitionCategory): SimilarPetitionResult[] {
    return searchSimilarPetitions(content, category);
  }

  /** 회신 초안 생성 */
  generateReply(
    petitionId: string,
    category: PetitionCategory,
    resolution: string,
  ): ReplyDraft {
    const similar = this.searchSimilar(resolution, category);
    return generateReplyDraft(this.tenantId, petitionId, category, resolution, similar);
  }

  /** SLA 확인 */
  checkSLA(petitionId: string, category: PetitionCategory, receivedAt: string): PetitionSLA {
    return checkPetitionSLA(petitionId, category, receivedAt);
  }

  /** 감사 로그 */
  getAuditLog(): readonly PetitionAuditEntry[] {
    return getPetitionAuditLog(this.tenantId);
  }
}
