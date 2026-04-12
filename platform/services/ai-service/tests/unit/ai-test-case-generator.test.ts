// MTU-N375 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  generateHappyPath,
  generateBoundaryCases,
  generateExceptionCases,
  generateAllCases,
  renderVitestCode,
  getTestGenAuditLog,
  AiTestCaseGeneratorService,
  type FunctionSignature,
} from '../../src/lib/ai-test-case-generator';

const sig: FunctionSignature = {
  name: 'addNumbers',
  params: [
    { name: 'a', type: 'number', min: 0, max: 100 },
    { name: 'b', type: 'number', min: 0, max: 100 },
  ],
  returnType: 'number',
};

describe('MTU-N375 AiTestCaseGenerator', () => {
  it('해피 패스 생성', () => {
    const tc = generateHappyPath(sig);
    expect(tc.expectedBehavior).toBe('success');
    expect(tc.inputs.a).toBe(0);
  });

  it('경계값 생성', () => {
    const cases = generateBoundaryCases(sig);
    expect(cases.length).toBeGreaterThan(0);
    expect(cases.every((c) => c.expectedBehavior === 'boundary')).toBe(true);
  });

  it('예외 케이스 생성', () => {
    const cases = generateExceptionCases(sig);
    expect(cases.length).toBeGreaterThan(0);
  });

  it('전체 케이스 통합', () => {
    const cases = generateAllCases('t1', sig);
    expect(cases.length).toBeGreaterThan(5);
  });

  it('문자열 파라미터 경계값', () => {
    const s: FunctionSignature = { name: 'fn', params: [{ name: 's', type: 'string' }], returnType: 'void' };
    const cases = generateBoundaryCases(s);
    expect(cases.some((c) => c.inputs.s === '')).toBe(true);
  });

  it('배열 파라미터 경계값', () => {
    const s: FunctionSignature = { name: 'fn', params: [{ name: 'arr', type: 'array' }], returnType: 'void' };
    const cases = generateBoundaryCases(s);
    expect(cases.some((c) => Array.isArray(c.inputs.arr) && (c.inputs.arr as unknown[]).length === 0)).toBe(true);
  });

  it('옵셔널 파라미터 예외 생성 스킵', () => {
    const s: FunctionSignature = {
      name: 'fn',
      params: [{ name: 'x', type: 'number', optional: true }],
      returnType: 'void',
    };
    const cases = generateExceptionCases(s);
    const missing = cases.filter((c) => c.description.includes('누락'));
    expect(missing.length).toBe(0);
  });

  it('Vitest 코드 렌더', () => {
    const cases = [generateHappyPath(sig)];
    const code = renderVitestCode(sig, cases);
    expect(code).toContain('describe');
    expect(code).toContain('addNumbers');
  });

  it('서비스 클래스', () => {
    const svc = new AiTestCaseGeneratorService('t2');
    const cases = svc.generate(sig);
    expect(cases.length).toBeGreaterThan(0);
  });

  it('감사 로그 테넌트 격리', () => {
    generateAllCases('tA', sig);
    generateAllCases('tB', sig);
    expect(getTestGenAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
