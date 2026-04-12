// MTU-N319 DLP 엔진 테스트
import { describe, it, expect } from 'vitest';
import { DLPEngineService } from '../dlp-engine.js';

describe('MTU-N319 DLPEngine', () => {
  const svc = new DLPEngineService('tenant-n319');

  it('FR-N319.1: 내장 규칙 초기화', () => {
    const rules = svc.initRules();
    expect(rules.length).toBeGreaterThan(0);
  });

  it('FR-N319.2: 규칙 추가', () => {
    const rule = svc.addRule('credit-card', '\\d{4}-\\d{4}-\\d{4}-\\d{4}', 'restricted', 'block');
    expect(rule).toBeDefined();
  });

  it('FR-N319.3: 콘텐츠 스캔', () => {
    svc.initRules();
    const result = svc.scan('chat', '주민번호 900101-1234567 포함');
    expect(result).toBeDefined();
  });

  it('FR-N319.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
