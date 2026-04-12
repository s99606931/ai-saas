// MTU-N320 WAF 규칙 생성기 테스트
import { describe, it, expect } from 'vitest';
import { WAFRuleGeneratorService } from '../waf-rule-generator.js';

describe('MTU-N320 WAFRuleGenerator', () => {
  const svc = new WAFRuleGeneratorService('tenant-n320');

  it('FR-N320.1: 기본 규칙 생성', () => {
    const rules = svc.generateDefaults();
    expect(rules.length).toBeGreaterThan(0);
    expect(svc.getRules().length).toBeGreaterThan(0);
  });

  it('FR-N320.2: 요청 평가', () => {
    svc.generateDefaults();
    const events = svc.evaluate('/api/users?id=1\' OR 1=1', '', '1.2.3.4');
    expect(Array.isArray(events)).toBe(true);
  });

  it('FR-N320.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
