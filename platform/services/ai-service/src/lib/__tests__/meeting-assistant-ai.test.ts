// MTU-N384 회의 보조 AI 테스트
import { describe, it, expect } from 'vitest';
import { MeetingAssistantAiService, type MeetingSegment } from '../meeting-assistant-ai.js';

describe('MTU-N384 MeetingAssistantAi', () => {
  const svc = new MeetingAssistantAiService('tenant-n384');

  const segments: MeetingSegment[] = [
    { segmentId: 'seg1', speaker: 'A', language: 'ko', text: '회의를 시작합니다', startMs: 0, endMs: 2000 },
    { segmentId: 'seg2', speaker: 'B', language: 'ko', text: '이번 주까지 보고서를 완료해 주세요', startMs: 2000, endMs: 5000 },
    { segmentId: 'seg3', speaker: 'A', language: 'ko', text: '감사합니다', startMs: 5000, endMs: 6000 },
  ];

  it('FR-N384.1: 세그먼트 번역', () => {
    const t = svc.translate(segments[0]!, 'en');
    expect(t.translatedText).toContain('Meeting');
  });

  it('FR-N384.2: 회의 요약 + 액션 아이템', () => {
    const summary = svc.summarize(segments);
    expect(summary.speakers.length).toBe(2);
    expect(summary.actionItems.length).toBeGreaterThan(0);
  });

  it('FR-N384.3: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
