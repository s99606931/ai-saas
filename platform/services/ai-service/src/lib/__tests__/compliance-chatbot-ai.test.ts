import { describe, it, expect, beforeEach } from 'vitest';
import { ComplianceChatbotAi, type ComplianceRule } from '../compliance-chatbot-ai';

describe('ComplianceChatbotAi', () => {
  let bot: ComplianceChatbotAi;

  const rules: ComplianceRule[] = [
    {
      id: 'CSAP-D08-1',
      standard: 'CSAP',
      title: '접근 통제',
      description: 'RBAC 기반 권한 분리 필수',
      keywords: ['RBAC', '접근', '권한'],
      severity: 'high',
    },
    {
      id: 'ISMS-P-1',
      standard: 'ISMS-P',
      title: '개인정보 처리방침',
      description: '개인정보 수집 동의 절차 필수',
      keywords: ['개인정보', '동의', '수집'],
      severity: 'high',
    },
    {
      id: 'N2SF-N05',
      standard: 'N2SF',
      title: '데이터 등급 분류',
      description: 'C/S 등급 데이터 외부 전송 금지',
      keywords: ['등급', '데이터', 'C등급', 'S등급'],
      severity: 'high',
    },
  ];

  beforeEach(() => {
    bot = new ComplianceChatbotAi();
    for (const rule of rules) {
      bot.registerRule(rule);
    }
  });

  // FR-R164.1 규정 KB 등록 + 검색
  it('FR-R164.1 키워드로 규정 검색', () => {
    const results = bot.searchRules('RBAC 접근 통제');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.id).toBe('CSAP-D08-1');
  });

  it('FR-R164.1 미매칭 쿼리', () => {
    const results = bot.searchRules('존재하지않는규정xyz');
    expect(results.length).toBe(0);
  });

  // FR-R164.2 제목으로 검색
  it('FR-R164.2 제목 포함 검색', () => {
    const results = bot.searchRules('개인정보 처리방침');
    expect(results.some((r) => r.id === 'ISMS-P-1')).toBe(true);
  });

  // FR-R164.3 대화 응답
  it('FR-R164.3 규정 발견 시 응답 반환', () => {
    const reply = bot.chat('session-1', 'user-1', '권한 접근 RBAC');
    expect(reply.role).toBe('assistant');
    expect(reply.content).toContain('CSAP');
    expect(reply.referenceIds).toContain('CSAP-D08-1');
  });

  it('FR-R164.3 규정 미발견 시 안내 반환', () => {
    const reply = bot.chat('session-1', 'user-1', '전혀관련없는질문xyz');
    expect(reply.content).toContain('찾지 못했습니다');
  });

  // FR-R164.4 대화 이력
  it('FR-R164.4 대화 이력 조회', () => {
    bot.chat('session-2', 'user-2', 'C등급 데이터');
    const history = bot.getHistory('session-2');
    expect(history.length).toBe(2); // user + assistant
    expect(history[0]!.role).toBe('user');
    expect(history[1]!.role).toBe('assistant');
  });

  it('FR-R164.4 세션 초기화', () => {
    bot.chat('session-3', 'user-3', 'test');
    bot.clearSession('session-3');
    expect(bot.getHistory('session-3').length).toBe(0);
  });

  // FR-R164.5 감사 로그 (CSAP D-06)
  it('FR-R164.5 감사 로그 기록', () => {
    bot.chat('session-4', 'user-4', '개인정보');
    const log = bot.getAuditLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0]!.action).toBe('CHAT_QUERY');
    expect(log[0]!.userId).toBe('user-4');
  });

  // 다중 표준 검색
  it('N2SF 등급 키워드 검색', () => {
    const results = bot.searchRules('C등급 데이터 분류');
    expect(results.some((r) => r.standard === 'N2SF')).toBe(true);
  });
});
