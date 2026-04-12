// MTU-N384 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  translateSegment,
  translateAll,
  summarize,
  extractActionItems,
  getMeetingAuditLog,
  MeetingAssistantAiService,
  type MeetingSegment,
} from '../../src/lib/meeting-assistant-ai';

const segments: MeetingSegment[] = [
  { segmentId: 's1', speaker: 'A', language: 'ko', text: '회의를 시작합니다', startMs: 0, endMs: 3000 },
  { segmentId: 's2', speaker: 'B', language: 'ko', text: '이 업무를 처리해야 합니다', startMs: 3000, endMs: 6000 },
];

describe('MTU-N384 MeetingAssistantAi', () => {
  it('세그먼트 번역 - 매핑 존재', () => {
    const t = translateSegment(segments[0] as MeetingSegment, 'en');
    expect(t.translatedText).toBe('Meeting starts');
  });

  it('세그먼트 번역 - 매핑 없음', () => {
    const t = translateSegment(segments[1] as MeetingSegment, 'en');
    expect(t.translatedText).toContain('[en]');
  });

  it('전체 번역', () => {
    const ts = translateAll(segments, 'en');
    expect(ts.length).toBe(2);
  });

  it('요약 생성', () => {
    const s = summarize('t1', segments);
    expect(s.segmentCount).toBe(2);
    expect(s.speakers.length).toBe(2);
  });

  it('총 지속 시간', () => {
    const s = summarize('t1', segments);
    expect(s.totalDurationMs).toBe(6000);
  });

  it('액션 아이템 추출', () => {
    const items = extractActionItems(segments);
    expect(items.length).toBeGreaterThan(0);
  });

  it('액션 없는 경우', () => {
    const items = extractActionItems([
      { segmentId: 's', speaker: 'x', language: 'ko', text: '날씨 좋네요', startMs: 0, endMs: 1000 },
    ]);
    expect(items.length).toBe(0);
  });

  it('화자 중복 제거', () => {
    const s = summarize('t1', [
      { segmentId: 's1', speaker: 'A', language: 'ko', text: 'x', startMs: 0, endMs: 1 },
      { segmentId: 's2', speaker: 'A', language: 'ko', text: 'y', startMs: 1, endMs: 2 },
    ]);
    expect(s.speakers).toEqual(['A']);
  });

  it('서비스 클래스', () => {
    const svc = new MeetingAssistantAiService('t2');
    const s = svc.summarize(segments);
    expect(s.segmentCount).toBe(2);
  });

  it('감사 로그 기록', () => {
    summarize('tenant-audit', segments);
    expect(getMeetingAuditLog('tenant-audit').length).toBeGreaterThan(0);
  });
});
