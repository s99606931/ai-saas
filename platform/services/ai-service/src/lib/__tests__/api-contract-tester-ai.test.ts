import { describe, it, expect, beforeEach } from 'vitest';
import { ApiContractTesterAI } from '../api-contract-tester-ai';

describe('ApiContractTesterAI', () => {
  let tester: ApiContractTesterAI;

  beforeEach(() => {
    tester = new ApiContractTesterAI();
  });

  it('계약을 등록한다', () => {
    tester.registerContract('/api/users', 'GET', [{ name: 'id', type: 'number', required: true }]);
    const logs = tester.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_CONTRACT')).toBe(true);
  });

  it('유효한 응답이면 valid=true를 반환한다', () => {
    tester.registerContract('/api/users', 'GET', [
      { name: 'id', type: 'number', required: true },
      { name: 'name', type: 'string', required: true },
    ]);
    const result = tester.validateResponse('/api/users', 'GET', { id: 1, name: '홍길동' });
    expect(result.valid).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  it('필수 필드 누락 시 위반을 탐지한다', () => {
    tester.registerContract('/api/items', 'POST', [
      { name: 'title', type: 'string', required: true },
    ]);
    const result = tester.validateResponse('/api/items', 'POST', {});
    expect(result.valid).toBe(false);
    expect(result.violations[0]!.violationType).toBe('missing_field');
  });

  it('타입 불일치를 탐지한다', () => {
    tester.registerContract('/api/data', 'GET', [
      { name: 'count', type: 'number', required: true },
    ]);
    const result = tester.validateResponse('/api/data', 'GET', { count: '100' });
    expect(result.violations.some(v => v.violationType === 'type_mismatch')).toBe(true);
  });

  it('배열 타입을 올바르게 검증한다', () => {
    tester.registerContract('/api/list', 'GET', [
      { name: 'items', type: 'array', required: true },
    ]);
    const result = tester.validateResponse('/api/list', 'GET', { items: [1, 2, 3] });
    expect(result.valid).toBe(true);
  });

  it('미등록 계약 검증 시 오류를 던진다', () => {
    expect(() => tester.validateResponse('/unknown', 'GET', {})).toThrow('계약 미등록');
  });

  it('C등급 데이터 전송을 차단한다', () => {
    tester.registerContract('/api/test', 'GET', []);
    expect(() => tester.validateResponse('/api/test', 'GET', {}, 'C' as never)).toThrow('BLOCKED');
  });

  it('경로별 위반 목록을 필터링하여 반환한다', () => {
    tester.registerContract('/api/a', 'GET', [{ name: 'x', type: 'string', required: true }]);
    tester.registerContract('/api/b', 'GET', [{ name: 'y', type: 'number', required: true }]);
    tester.validateResponse('/api/a', 'GET', {});
    tester.validateResponse('/api/b', 'GET', {});
    const violations = tester.getContractViolations('/api/a');
    expect(violations.every(v => v.path === '/api/a')).toBe(true);
  });
});
