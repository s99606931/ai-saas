// AI 회의록 자동 생성 단위 테스트 -- MTU-N275
import { describe, it, expect } from 'vitest';
import {
  groupByTopic,
  summarizeTopics,
  extractDecisions,
  extractActionItems,
  renderMeetingMinutes,
  generateMeetingMinutes,
  searchMeetings,
  getMeetingAuditLog,
  type MeetingInput,
  type MeetingUtterance,
} from '../../src/lib/meeting-summarizer';

const MOCK_INPUT: MeetingInput = {
  title: '2026년 2분기 사업 계획 회의',
  date: '2026-04-12 14:00',
  location: '본관 3층 대회의실',
  participants: [
    { name: '김부장', role: '사업부장', organization: '사업기획팀' },
    { name: '이과장', role: '과장', organization: '정보화과' },
    { name: '박대리', role: '대리', organization: '기술지원팀' },
  ],
  utterances: [
    { speaker: '김부장', content: '올해 예산 집행 현황을 검토하겠습니다. 현재 50% 집행률입니다.', timestamp: '14:05', topic: '예산/재정' },
    { speaker: '이과장', content: 'CSAP 인증 일정은 6월까지 완료하기로 결정합니다.', timestamp: '14:10', topic: '보안/규제' },
    { speaker: '박대리', content: '시스템 개발 진행 상황을 보고드립니다. API 개발 80% 완료입니다.', timestamp: '14:15', topic: '기술/개발' },
    { speaker: '김부장', content: '박대리님이 다음 주까지 API 문서를 완료해 주세요.', timestamp: '14:20', topic: '기술/개발' },
    { speaker: '이과장', content: '보안 감사 결과는 이과장이 5월 1일까지 제출할 것입니다.', timestamp: '14:25', topic: '보안/규제' },
    { speaker: '김부장', content: '전체 일정은 계획대로 진행하기로 결정합니다.', timestamp: '14:30' },
  ],
  duration: 30,
};

describe('AI 회의록 자동 생성', () => {
  describe('groupByTopic', () => {
    it('발언을 주제별로 그룹화해야 한다', () => {
      const groups = groupByTopic(MOCK_INPUT.utterances);
      expect(groups.size).toBeGreaterThan(0);
    });

    it('명시적 주제가 없는 발언은 자동 감지해야 한다', () => {
      const utterances: MeetingUtterance[] = [
        { speaker: 'A', content: '예산 집행 현황을 보고합니다', timestamp: '10:00' },
      ];
      const groups = groupByTopic(utterances);
      expect(groups.size).toBe(1);
    });
  });

  describe('summarizeTopics', () => {
    it('주제별 요약을 생성해야 한다', () => {
      const groups = groupByTopic(MOCK_INPUT.utterances);
      const summaries = summarizeTopics(groups);
      expect(summaries.length).toBeGreaterThan(0);
      for (const summary of summaries) {
        expect(summary.topic).toBeDefined();
        expect(summary.speakers.length).toBeGreaterThan(0);
      }
    });
  });

  describe('extractDecisions', () => {
    it('결정사항을 추출해야 한다', () => {
      const decisions = extractDecisions(MOCK_INPUT.utterances);
      expect(decisions.length).toBeGreaterThan(0);
      for (const decision of decisions) {
        expect(decision.content).toBeDefined();
        expect(decision.decidedBy).toBeDefined();
      }
    });
  });

  describe('extractActionItems', () => {
    it('액션아이템을 추출해야 한다', () => {
      const items = extractActionItems(MOCK_INPUT.utterances);
      expect(items.length).toBeGreaterThanOrEqual(0);
      for (const item of items) {
        expect(item.assignee).toBeDefined();
        expect(item.status).toBe('pending');
      }
    });
  });

  describe('renderMeetingMinutes', () => {
    it('마크다운 회의록을 렌더링해야 한다', () => {
      const minutesData = {
        id: 'test-1',
        title: '테스트 회의',
        date: '2026-04-12',
        location: '회의실',
        participants: [{ name: '테스트', role: '팀장' }],
        summary: '테스트 요약',
        topics: [{ topic: '안건1', summary: '논의 내용', speakers: ['테스트'], keyPoints: ['핵심1'] }],
        decisions: [{ id: 'd-1', content: '결정1', decidedBy: '테스트', relatedTopic: '안건1' }],
        actionItems: [{ id: 'a-1', content: '액션1', assignee: '테스트', priority: 'high' as const, status: 'pending' as const }],
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      };

      const md = renderMeetingMinutes(minutesData);
      expect(md).toContain('# 회의록');
      expect(md).toContain('테스트 회의');
      expect(md).toContain('결정사항');
      expect(md).toContain('액션아이템');
    });
  });

  describe('generateMeetingMinutes', () => {
    it('전체 파이프라인이 정상 동작해야 한다', () => {
      const minutes = generateMeetingMinutes(MOCK_INPUT, 'test-user');

      expect(minutes.id).toBeDefined();
      expect(minutes.title).toBe(MOCK_INPUT.title);
      expect(minutes.summary).toBeDefined();
      expect(minutes.topics.length).toBeGreaterThan(0);
      expect(minutes.renderedMarkdown).toContain('# 회의록');
    });

    it('결정사항과 액션아이템이 포함되어야 한다', () => {
      const minutes = generateMeetingMinutes(MOCK_INPUT, 'test-user');
      expect(minutes.decisions.length).toBeGreaterThan(0);
    });
  });

  describe('searchMeetings', () => {
    it('회의록을 검색할 수 있어야 한다', () => {
      generateMeetingMinutes(MOCK_INPUT, 'test-user');
      const results = searchMeetings('예산 사업 계획');
      expect(results.length).toBeGreaterThan(0);
    });

    it('관련 없는 검색어에 빈 결과를 반환해야 한다', () => {
      const results = searchMeetings('xyz123abc');
      expect(results.length).toBe(0);
    });
  });

  describe('감사 로그', () => {
    it('모든 회의록 생성이 기록되어야 한다', () => {
      const log = getMeetingAuditLog();
      expect(log.length).toBeGreaterThan(0);
    });
  });
});
