// MTU-N313 민원 챗봇 엔진 테스트
import { describe, it, expect } from 'vitest';
import { CitizenChatbotService } from '../citizen-chatbot-engine.js';

describe('MTU-N313 CitizenChatbot', () => {
  const svc = new CitizenChatbotService('tenant-n313');

  it('FR-N313.1: 의도 분류', () => {
    const result = svc.classify('주민등록 발급 안내');
    expect(result).toBeDefined();
    expect(typeof result.intent).toBe('string');
  });

  it('FR-N313.2: 응답 생성', () => {
    const response = svc.respond('session-1', '민원 접수 방법 알려주세요');
    expect(response).toBeDefined();
  });

  it('FR-N313.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
