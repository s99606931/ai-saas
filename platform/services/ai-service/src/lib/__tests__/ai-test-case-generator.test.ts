// MTU-N375 AI 테스트 케이스 자동 생성기 테스트
import { describe, it, expect } from 'vitest';
import { AiTestCaseGeneratorService, type FunctionSignature } from '../ai-test-case-generator.js';

describe('MTU-N375 AiTestCaseGenerator', () => {
  const svc = new AiTestCaseGeneratorService('tenant-n375');

  const sig: FunctionSignature = {
    name: 'calcScore',
    params: [
      { name: 'value', type: 'number', min: 0, max: 100 },
      { name: 'weight', type: 'number', min: 0, max: 10 },
    ],
    returnType: 'number',
  };

  it('FR-N375.1: 테스트 케이스 생성', () => {
    const cases = svc.generate(sig);
    expect(cases.length).toBeGreaterThan(3);
    expect(cases.some((c) => c.expectedBehavior === 'success')).toBe(true);
    expect(cases.some((c) => c.expectedBehavior === 'boundary')).toBe(true);
  });

  it('FR-N375.2: Vitest 코드 렌더링', () => {
    const cases = svc.generate(sig);
    const code = svc.render(sig, cases);
    expect(code).toContain('describe');
    expect(code).toContain('calcScore');
  });

  it('FR-N375.3: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
