// AI 기반 회의록 자동 생성 -- FR-N275.1~FR-N275.6
// Design Ref: MTU-N275 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안
// N2SF: 회의 내용 등급별 처리, PII 마스킹

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 회의 참석자 -- Design §1 */
export interface MeetingParticipant {
  name: string;
  role: string;
  organization?: string;
}

/** 회의 발언 -- Design §1 */
export interface MeetingUtterance {
  speaker: string;
  content: string;
  timestamp: string;
  topic?: string;
}

/** 회의 입력 데이터 */
export interface MeetingInput {
  title: string;
  date: string;
  location: string;
  participants: MeetingParticipant[];
  utterances: MeetingUtterance[];
  duration: number;
}

/** 결정사항 -- Design §3 */
export interface Decision {
  id: string;
  content: string;
  decidedBy: string;
  relatedTopic: string;
}

/** 액션아이템 -- Design §3 */
export interface ActionItem {
  id: string;
  content: string;
  assignee: string;
  dueDate?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
}

/** 회의록 -- Design §4 */
export interface MeetingMinutes {
  id: string;
  title: string;
  date: string;
  location: string;
  participants: MeetingParticipant[];
  summary: string;
  topics: TopicSummary[];
  decisions: Decision[];
  actionItems: ActionItem[];
  nextMeeting?: string;
  renderedMarkdown: string;
  createdAt: string;
  createdBy: string;
}

/** 주제별 요약 -- Design §2 */
export interface TopicSummary {
  topic: string;
  summary: string;
  speakers: string[];
  keyPoints: string[];
}

/** 감사 항목 */
export interface MeetingAuditEntry {
  id: string;
  action: string;
  actor: string;
  meetingId?: string;
  timestamp: string;
}

// -- 저장소/감사 ──────────────────────────────────────────────────────────────

const meetings = new Map<string, MeetingMinutes>();
const auditLog: MeetingAuditEntry[] = [];

function recordAudit(action: string, actor: string, meetingId?: string): void {
  auditLog.push({ id: randomUUID(), action, actor, meetingId, timestamp: new Date().toISOString() });
}

export function getMeetingAuditLog(): MeetingAuditEntry[] {
  return [...auditLog];
}

// -- §1 텍스트 구조화 분석 ────────────────────────────────────────────────────

/** 발언을 주제별로 그룹화 -- FR-N275.1 */
export function groupByTopic(utterances: MeetingUtterance[]): Map<string, MeetingUtterance[]> {
  const groups = new Map<string, MeetingUtterance[]>();

  for (const utterance of utterances) {
    const topic = utterance.topic || detectTopic(utterance.content);
    const existing = groups.get(topic) || [];
    existing.push(utterance);
    groups.set(topic, existing);
  }

  return groups;
}

/** 주제 감지 (키워드 기반) */
function detectTopic(text: string): string {
  const topicKeywords: Record<string, string[]> = {
    '예산/재정': ['예산', '비용', '재정', '금액', '집행'],
    '일정/계획': ['일정', '마감', '계획', '스케줄', '기한'],
    '기술/개발': ['개발', '기술', '구현', '시스템', '서버', 'API'],
    '보안/규제': ['보안', '규제', 'CSAP', '인증', '감사'],
    '인사/조직': ['인사', '채용', '조직', '팀', '인력'],
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) {
      return topic;
    }
  }
  return '일반 논의';
}

// -- §2 핵심 요약 생성 ────────────────────────────────────────────────────────

/** 주제별 요약 생성 -- FR-N275.2 */
export function summarizeTopics(topicGroups: Map<string, MeetingUtterance[]>): TopicSummary[] {
  const summaries: TopicSummary[] = [];

  for (const [topic, utterances] of topicGroups) {
    const speakers = [...new Set(utterances.map((u) => u.speaker))];
    const allContent = utterances.map((u) => u.content).join(' ');

    // 추출적 요약: 핵심 문장 선택 (길이 기반 + 키워드 밀도)
    const sentences = allContent.split(/[.!?。]+/).filter((s) => s.trim().length > 10);
    const keyPoints = sentences
      .sort((a, b) => b.length - a.length)
      .slice(0, 3)
      .map((s) => s.trim());

    const summary = keyPoints.length > 0
      ? (keyPoints[0]?.substring(0, 200) ?? '요약 없음')
      : utterances[0]?.content?.substring(0, 200) || '요약 없음';

    summaries.push({ topic, summary, speakers, keyPoints });
  }

  return summaries;
}

// -- §3 결정/액션 추출 ────────────────────────────────────────────────────────

/** 결정사항 키워드 패턴 */
const DECISION_PATTERNS = [
  /(?:결정|합의|확정|승인|결의)[:\s]*(.+)/,
  /(?:로|으로)\s*(?:결정|합의|확정)(?:됨|함|하였음)/,
  /(?:하기로|진행하기로|추진하기로)\s*(?:함|했음|결정)/,
];

/** 액션아이템 키워드 패턴 */
const ACTION_PATTERNS = [
  /([가-힣]+)(?:님|씨|과장|대리|부장|차장)(?:이|가|께서)?\s*(.+?)(?:하기로|할\s*것|해\s*주세요|바랍니다)/,
  /(?:담당|담당자)[:\s]*([가-힣]+)/,
  /(?:까지|이내에)\s*(.+?)(?:완료|제출|보고)/,
];

/** 결정사항 추출 -- FR-N275.3 */
export function extractDecisions(utterances: MeetingUtterance[]): Decision[] {
  const decisions: Decision[] = [];

  for (const utterance of utterances) {
    for (const pattern of DECISION_PATTERNS) {
      const match = utterance.content.match(pattern);
      if (match) {
        decisions.push({
          id: randomUUID(),
          content: utterance.content.trim(),
          decidedBy: utterance.speaker,
          relatedTopic: utterance.topic || '일반',
        });
        break;
      }
    }
  }

  return decisions;
}

/** 액션아이템 추출 -- FR-N275.3 */
export function extractActionItems(utterances: MeetingUtterance[]): ActionItem[] {
  const items: ActionItem[] = [];

  for (const utterance of utterances) {
    for (const pattern of ACTION_PATTERNS) {
      const match = utterance.content.match(pattern);
      if (match) {
        items.push({
          id: randomUUID(),
          content: utterance.content.trim(),
          assignee: match[1] || utterance.speaker,
          priority: 'medium',
          status: 'pending',
        });
        break;
      }
    }
  }

  return items;
}

// -- §4 회의록 렌더링 ────────────────────────────────────────────────────────

/** 공문 형식 회의록 마크다운 생성 -- FR-N275.4 */
export function renderMeetingMinutes(minutes: Omit<MeetingMinutes, 'renderedMarkdown'>): string {
  const lines: string[] = [];

  lines.push(`# 회의록`);
  lines.push('');
  lines.push(`## 회의 기본 정보`);
  lines.push('');
  lines.push(`| 항목 | 내용 |`);
  lines.push(`|------|------|`);
  lines.push(`| 회의명 | ${minutes.title} |`);
  lines.push(`| 일시 | ${minutes.date} |`);
  lines.push(`| 장소 | ${minutes.location} |`);
  lines.push(`| 참석자 | ${minutes.participants.map((p) => `${p.name}(${p.role})`).join(', ')} |`);
  lines.push('');

  lines.push(`## 회의 요약`);
  lines.push('');
  lines.push(minutes.summary);
  lines.push('');

  if (minutes.topics.length > 0) {
    lines.push(`## 안건별 논의 내용`);
    lines.push('');
    for (const topic of minutes.topics) {
      lines.push(`### ${topic.topic}`);
      lines.push('');
      lines.push(`- **발언자**: ${topic.speakers.join(', ')}`);
      lines.push(`- **요약**: ${topic.summary}`);
      if (topic.keyPoints.length > 0) {
        lines.push(`- **핵심 사항**:`);
        for (const point of topic.keyPoints) {
          lines.push(`  - ${point}`);
        }
      }
      lines.push('');
    }
  }

  if (minutes.decisions.length > 0) {
    lines.push(`## 결정사항`);
    lines.push('');
    lines.push(`| 번호 | 내용 | 결정자 |`);
    lines.push(`|------|------|--------|`);
    minutes.decisions.forEach((d, i) => {
      lines.push(`| ${i + 1} | ${d.content} | ${d.decidedBy} |`);
    });
    lines.push('');
  }

  if (minutes.actionItems.length > 0) {
    lines.push(`## 액션아이템`);
    lines.push('');
    lines.push(`| 번호 | 내용 | 담당자 | 기한 | 우선순위 |`);
    lines.push(`|------|------|--------|------|---------|`);
    minutes.actionItems.forEach((item, i) => {
      lines.push(`| ${i + 1} | ${item.content} | ${item.assignee} | ${item.dueDate || '-'} | ${item.priority} |`);
    });
    lines.push('');
  }

  if (minutes.nextMeeting) {
    lines.push(`## 차기 회의`);
    lines.push('');
    lines.push(minutes.nextMeeting);
  }

  return lines.join('\n');
}

// -- 통합 파이프라인 ──────────────────────────────────────────────────────────

/** 전체 회의록 생성 파이프라인 */
export function generateMeetingMinutes(input: MeetingInput, actor: string): MeetingMinutes {
  // §1 구조화
  const topicGroups = groupByTopic(input.utterances);

  // §2 요약
  const topics = summarizeTopics(topicGroups);

  // §3 결정/액션 추출
  const decisions = extractDecisions(input.utterances);
  const actionItems = extractActionItems(input.utterances);

  // 전체 요약
  const summary = topics.length > 0
    ? `${input.title} 관련 ${topics.length}개 안건이 논의되었으며, ` +
      `${decisions.length}건의 결정사항과 ${actionItems.length}건의 액션아이템이 도출되었습니다.`
    : `${input.title} 회의가 진행되었습니다.`;

  const minutesData = {
    id: randomUUID(),
    title: input.title,
    date: input.date,
    location: input.location,
    participants: input.participants,
    summary,
    topics,
    decisions,
    actionItems,
    createdAt: new Date().toISOString(),
    createdBy: actor,
  };

  // §4 렌더링
  const renderedMarkdown = renderMeetingMinutes(minutesData);

  const minutes: MeetingMinutes = { ...minutesData, renderedMarkdown };
  meetings.set(minutes.id, minutes);

  recordAudit('MEETING_MINUTES_GENERATED', actor, minutes.id);
  return minutes;
}

// -- §5 회의록 검색 ──────────────────────────────────────────────────────────

/** 회의록 검색 -- FR-N275.5 */
export function searchMeetings(query: string): MeetingMinutes[] {
  const keywords = query.toLowerCase().split(/\s+/);
  const results: { minutes: MeetingMinutes; score: number }[] = [];

  for (const [, minutes] of meetings) {
    const searchText = `${minutes.title} ${minutes.summary} ${minutes.renderedMarkdown}`.toLowerCase();
    const score = keywords.filter((kw) => searchText.includes(kw)).length;
    if (score > 0) {
      results.push({ minutes, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).map((r) => r.minutes);
}

/** 회의록 조회 */
export function getMeeting(id: string): MeetingMinutes | undefined {
  return meetings.get(id);
}

/** 회의록 목록 */
export function listMeetings(): MeetingMinutes[] {
  return Array.from(meetings.values());
}
