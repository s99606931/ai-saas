// MTU-N296 회의록 AI 테스트
import { describe, it, expect } from 'vitest';
import { MeetingMinutesAIService } from '../meeting-minutes-ai.js';

describe('MTU-N296 MeetingMinutesAI', () => {
  const svc = new MeetingMinutesAIService('tenant-n296');

  it('FR-N296.1~6: 회의록 요약 + 액션아이템 + 감사', () => {
    const summary = svc.summarize({
      meetingId: 'm-1',
      tenantId: 'tenant-n296',
      title: '월간 정기회의',
      date: '2026-04-11',
      participants: [
        { name: '홍길동', role: '팀장', department: '기획' },
        { name: '이영희', role: '담당', department: '개발' },
      ],
      transcript: '안녕하세요. 첫 번째 안건은 예산 증액입니다. 이영희 담당이 4월 30일까지 보고서를 제출해 주세요. 두 번째 안건은 일정 조정입니다.',
      duration: 60,
    });
    expect(summary.meetingId).toBe('m-1');
    expect(summary.actionItems).toBeDefined();

    svc.archive(summary);
    const found = svc.search('정기');
    expect(Array.isArray(found)).toBe(true);

    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
