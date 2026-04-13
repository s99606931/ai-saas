import { describe, it, expect, beforeEach } from 'vitest';
import { AIChatbotRouter } from '../ai-chatbot-router';

describe('AIChatbotRouter', () => {
  let ai: AIChatbotRouter;

  beforeEach(() => {
    ai = new AIChatbotRouter();
  });

  it('PII를 마스킹한다', () => {
    const s = ai.sanitize('제 전화번호는 010-1234-5678 입니다');
    expect(s).toContain('[전화번호]');
    expect(s).not.toContain('010-1234-5678');
  });

  it('복지 키워드를 welfare 에이전트로 분류', () => {
    const d = ai.route('r1', '기초생활 수급 신청 방법 알려주세요');
    expect(d.primaryAgent).toBe('welfare');
    expect(d.intent.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('세금 키워드를 tax로 분류', () => {
    const d = ai.route('r1', '종합소득세 환급 신청');
    expect(d.primaryAgent).toBe('tax');
  });

  it('긴급 키워드는 fallback으로 emergency 포함', () => {
    const d = ai.route('r1', '민원 신고하고 화재 위험 알려주세요');
    expect(d.fallbackAgents).toContain('emergency');
  });

  it('키워드 없으면 general_info로 폴백', () => {
    const d = ai.route('r1', '그냥 궁금해서요');
    expect(d.primaryAgent).toBe('general_info');
  });

  it('C등급 차단', () => {
    expect(() => ai.route('r1', '안녕', 'C' as unknown as never)).toThrow(/BLOCKED/);
  });
});
