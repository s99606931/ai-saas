// AI 회의 보조 시스템 -- FR-N384.1~FR-N384.5
// Design Ref: MTU-N384 | CSAP: D-06, D-08

export interface MeetingSegment {
  readonly segmentId: string;
  readonly speaker: string;
  readonly language: string;
  readonly text: string;
  readonly startMs: number;
  readonly endMs: number;
}

export interface TranslatedSegment extends MeetingSegment {
  readonly translatedText: string;
  readonly targetLang: string;
}

export interface ActionItem {
  readonly itemId: string;
  readonly description: string;
  readonly assignee?: string;
  readonly dueDate?: string;
}

export interface MeetingSummary {
  readonly segmentCount: number;
  readonly totalDurationMs: number;
  readonly speakers: readonly string[];
  readonly summary: string;
  readonly actionItems: readonly ActionItem[];
}

export interface MeetingAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: MeetingAuditEntry[] = [];

function recordAudit(entry: Omit<MeetingAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getMeetingAuditLog(tenantId: string): readonly MeetingAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

// 간단 번역 매핑 (실제로는 외부 번역 호출)
const TRANSLATION_STUB: Record<string, Record<string, string>> = {
  '회의를 시작합니다': { en: 'Meeting starts', ja: '会議を始めます' },
  '감사합니다': { en: 'Thank you', ja: 'ありがとうございます' },
};

export function translateSegment(segment: MeetingSegment, targetLang: string): TranslatedSegment {
  const mapped = TRANSLATION_STUB[segment.text]?.[targetLang];
  const translatedText = mapped ?? `[${targetLang}] ${segment.text}`;
  return { ...segment, translatedText, targetLang };
}

export function translateAll(segments: readonly MeetingSegment[], targetLang: string): readonly TranslatedSegment[] {
  return segments.map((s) => translateSegment(s, targetLang));
}

export function summarize(tenantId: string, segments: readonly MeetingSegment[]): MeetingSummary {
  const speakers = Array.from(new Set(segments.map((s) => s.speaker))).sort();
  const totalDuration = segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0);
  const fullText = segments.map((s) => s.text).join(' ');
  const summary = fullText.length > 200 ? fullText.slice(0, 200) + '...' : fullText;
  const actionItems = extractActionItems(segments);
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'MEETING_SUMMARIZED',
    target: 'meeting',
    details: { segments: segments.length, speakers: speakers.length, actions: actionItems.length },
  });
  return {
    segmentCount: segments.length,
    totalDurationMs: totalDuration,
    speakers,
    summary,
    actionItems,
  };
}

export function extractActionItems(segments: readonly MeetingSegment[]): readonly ActionItem[] {
  const items: ActionItem[] = [];
  const actionKeywords = ['해야', '예정', '담당', '처리', '완료해', '확인해'];
  let id = 0;
  for (const seg of segments) {
    if (actionKeywords.some((k) => seg.text.includes(k))) {
      items.push({
        itemId: `ai-${id++}`,
        description: seg.text,
        assignee: seg.speaker,
      });
    }
  }
  return items;
}

export class MeetingAssistantAiService {
  constructor(private readonly tenantId: string) {}
  translate(segment: MeetingSegment, targetLang: string): TranslatedSegment {
    return translateSegment(segment, targetLang);
  }
  translateAll(segments: readonly MeetingSegment[], targetLang: string): readonly TranslatedSegment[] {
    return translateAll(segments, targetLang);
  }
  summarize(segments: readonly MeetingSegment[]): MeetingSummary {
    return summarize(this.tenantId, segments);
  }
  getAuditLog(): readonly MeetingAuditEntry[] {
    return getMeetingAuditLog(this.tenantId);
  }
}
