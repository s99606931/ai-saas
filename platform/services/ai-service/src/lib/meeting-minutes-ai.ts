// 회의록 AI 요약/액션아이템 추출 -- FR-N296.1~FR-N296.6
// Design Ref: MTU-N296 DESIGN §1~§6
// Plan SC: SC-1 (30초 내 요약), SC-2 (액션아이템 90%+), SC-3 (PII 마스킹 100%), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-08 접근통제, D-12 개발보안

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 회의 참석자 */
export interface MeetingParticipant {
  readonly name: string;
  readonly role: string;
  readonly department: string;
}

/** 회의록 입력 */
export interface MeetingMinutesInput {
  readonly meetingId: string;
  readonly tenantId: string;
  readonly title: string;
  readonly date: string;
  readonly participants: MeetingParticipant[];
  readonly transcript: string;
  readonly duration: number; // 분
}

/** 안건별 요약 */
export interface AgendaSummary {
  readonly agendaNo: number;
  readonly topic: string;
  readonly summary: string;
  readonly decisions: string[];
  readonly keyPoints: string[];
}

/** 액션아이템 */
export interface ActionItem {
  readonly actionId: string;
  readonly description: string;
  readonly assignee: string;
  readonly deadline: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly status: 'pending' | 'in_progress' | 'completed';
}

/** 회의록 요약 결과 */
export interface MeetingMinutesSummary {
  readonly meetingId: string;
  readonly tenantId: string;
  readonly title: string;
  readonly overallSummary: string;
  readonly agendas: AgendaSummary[];
  readonly actionItems: ActionItem[];
  readonly participantCount: number;
  readonly durationMinutes: number;
  readonly generatedAt: string;
}

/** 감사 로그 */
export interface MeetingAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- PII 마스킹 ──────────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\d{6}[-]?\d{7}/g, replacement: '[주민번호마스킹]' },
  { pattern: /01[0-9][-]?\d{3,4}[-]?\d{4}/g, replacement: '[전화번호마스킹]' },
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[이메일마스킹]' },
  { pattern: /\d{3}[-]?\d{2}[-]?\d{5}/g, replacement: '[사업자번호마스킹]' },
];

/** PII 마스킹 처리 -- FR-N296.1 */
export function maskMeetingPII(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: MeetingAuditEntry[] = [];

function recordAudit(entry: Omit<MeetingAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getMeetingAuditLog(tenantId: string): readonly MeetingAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 안건 추출 ────────────────────────────────────────────────────────────────

const AGENDA_KEYWORDS = ['안건', '의제', '주제', '논의사항', '보고사항', '심의사항', '결정사항'];
const DECISION_KEYWORDS = ['결정', '의결', '승인', '합의', '확정', '채택'];
const ACTION_KEYWORDS = ['추진', '진행', '완료', '이행', '조치', '보고', '제출', '작성'];

/** 회의록에서 안건별 요약 생성 -- FR-N296.2 */
export function extractAgendas(transcript: string): AgendaSummary[] {
  const maskedText = maskMeetingPII(transcript);
  const paragraphs = maskedText.split(/\n{2,}/).filter(p => p.trim().length > 0);
  const agendas: AgendaSummary[] = [];

  let currentAgendaNo = 0;

  for (const paragraph of paragraphs) {
    const isAgendaHeader = AGENDA_KEYWORDS.some(kw => paragraph.includes(kw));
    if (isAgendaHeader || agendas.length === 0) {
      currentAgendaNo++;
      const sentences = paragraph.split(/[.。]\s*/).filter(s => s.trim().length > 0);
      const topicSentence = sentences[0] ?? '일반 논의';

      const decisions = sentences.filter(s =>
        DECISION_KEYWORDS.some(kw => s.includes(kw)),
      );

      const keyPoints = sentences
        .filter(s => s.length > 10)
        .slice(0, 3);

      agendas.push({
        agendaNo: currentAgendaNo,
        topic: topicSentence.slice(0, 100),
        summary: paragraph.slice(0, 300),
        decisions,
        keyPoints,
      });
    }
  }

  if (agendas.length === 0) {
    agendas.push({
      agendaNo: 1,
      topic: '일반 논의',
      summary: maskedText.slice(0, 300),
      decisions: [],
      keyPoints: [],
    });
  }

  return agendas;
}

// -- 액션아이템 추출 ──────────────────────────────────────────────────────────

/** 액션아이템 자동 추출 -- FR-N296.3 */
export function extractActionItems(
  transcript: string,
  participants: MeetingParticipant[],
): ActionItem[] {
  const maskedText = maskMeetingPII(transcript);
  const sentences = maskedText.split(/[.。]\s*/).filter(s => s.trim().length > 5);
  const items: ActionItem[] = [];

  for (const sentence of sentences) {
    const hasActionKeyword = ACTION_KEYWORDS.some(kw => sentence.includes(kw));
    if (!hasActionKeyword) continue;

    // 담당자 추출
    const assignee = participants.find(p => sentence.includes(p.name))?.name
      ?? participants.find(p => sentence.includes(p.department))?.name
      ?? '미지정';

    // 기한 추출
    const deadlineMatch = sentence.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    const deadline = deadlineMatch
      ? `2026-${String(deadlineMatch[1]).padStart(2, '0')}-${String(deadlineMatch[2]).padStart(2, '0')}`
      : '미정';

    // 우선순위 판단
    let priority: ActionItem['priority'] = 'medium';
    if (sentence.includes('긴급') || sentence.includes('즉시') || sentence.includes('우선')) {
      priority = 'high';
    } else if (sentence.includes('참고') || sentence.includes('검토')) {
      priority = 'low';
    }

    items.push({
      actionId: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: sentence.trim().slice(0, 200),
      assignee,
      deadline,
      priority,
      status: 'pending',
    });
  }

  return items;
}

// -- 회의록 요약 생성 ────────────────────────────────────────────────────────

/** 전체 회의록 요약 생성 -- FR-N296.2~3 */
export function generateMeetingSummary(input: MeetingMinutesInput): MeetingMinutesSummary {
  const agendas = extractAgendas(input.transcript);
  const actionItems = extractActionItems(input.transcript, input.participants);

  const allDecisions = agendas.flatMap(a => a.decisions);
  const overallSummary = [
    `${input.title} 회의 요약 (${input.date}, ${input.participants.length}명 참석, ${input.duration}분)`,
    `총 ${agendas.length}개 안건 논의, ${allDecisions.length}건 결정, ${actionItems.length}건 후속조치`,
    ...agendas.map(a => `[안건${a.agendaNo}] ${a.topic}`),
  ].join('. ');

  recordAudit({
    actor: 'system',
    tenantId: input.tenantId,
    action: 'MEETING_SUMMARY_GENERATED',
    target: input.meetingId,
    details: {
      agendasCount: agendas.length,
      actionItemsCount: actionItems.length,
      participantCount: input.participants.length,
    },
  });

  return {
    meetingId: input.meetingId,
    tenantId: input.tenantId,
    title: input.title,
    overallSummary,
    agendas,
    actionItems,
    participantCount: input.participants.length,
    durationMinutes: input.duration,
    generatedAt: new Date().toISOString(),
  };
}

// -- 아카이브 저장소 ──────────────────────────────────────────────────────────

const archiveStore: Map<string, MeetingMinutesSummary[]> = new Map();

/** 회의록 아카이브 저장 -- FR-N296.5 */
export function archiveMeetingSummary(summary: MeetingMinutesSummary): void {
  const existing = archiveStore.get(summary.tenantId) ?? [];
  existing.push(summary);
  archiveStore.set(summary.tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId: summary.tenantId,
    action: 'MEETING_ARCHIVED',
    target: summary.meetingId,
    details: { title: summary.title },
  });
}

/** 회의록 검색 -- FR-N296.5 */
export function searchMeetingArchive(
  tenantId: string,
  keyword: string,
): MeetingMinutesSummary[] {
  const all = archiveStore.get(tenantId) ?? [];
  return all.filter(m =>
    m.title.includes(keyword) || m.overallSummary.includes(keyword),
  );
}

/** 회의록 AI 요약 서비스 */
export class MeetingMinutesAIService {
  constructor(private readonly tenantId: string) {}

  summarize(input: MeetingMinutesInput): MeetingMinutesSummary {
    return generateMeetingSummary(input);
  }

  archive(summary: MeetingMinutesSummary): void {
    archiveMeetingSummary(summary);
  }

  search(keyword: string): MeetingMinutesSummary[] {
    return searchMeetingArchive(this.tenantId, keyword);
  }

  getAuditLog(): readonly MeetingAuditEntry[] {
    return getMeetingAuditLog(this.tenantId);
  }
}
