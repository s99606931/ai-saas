// MTU-N374 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  registerContract,
  verifyResponse,
  verifyProvider,
  buildCompatibilityMatrix,
  getContractAuditLog,
  ConsumerDrivenContractService,
  type Contract,
  type ActualResponse,
} from '../../src/lib/consumer-driven-contract';

const sample: Contract = {
  contractId: 'c-1',
  consumer: 'portal',
  provider: 'user-service',
  request: { method: 'GET', path: '/users/1' },
  response: {
    status: 200,
    bodySchema: { id: 'number', name: 'string', active: 'boolean' },
  },
};

describe('MTU-N374 ConsumerDrivenContract', () => {
  it('계약 등록', () => {
    registerContract('t1', sample);
    expect(getContractAuditLog('t1').length).toBeGreaterThan(0);
  });

  it('응답 검증 통과', () => {
    const actual: ActualResponse = { status: 200, body: { id: 1, name: 'A', active: true } };
    const r = verifyResponse(sample, actual);
    expect(r.passed).toBe(true);
  });

  it('응답 상태 불일치', () => {
    const actual: ActualResponse = { status: 500, body: { id: 1, name: 'A', active: true } };
    const r = verifyResponse(sample, actual);
    expect(r.passed).toBe(false);
    expect(r.violations[0]).toContain('status');
  });

  it('필드 누락', () => {
    const actual: ActualResponse = { status: 200, body: { id: 1 } };
    const r = verifyResponse(sample, actual);
    expect(r.violations.some((v) => v.includes('missing'))).toBe(true);
  });

  it('타입 불일치', () => {
    const actual: ActualResponse = { status: 200, body: { id: '1', name: 'A', active: true } };
    const r = verifyResponse(sample, actual);
    expect(r.violations.some((v) => v.includes('id'))).toBe(true);
  });

  it('공급자 검증', () => {
    registerContract('t-verify', {
      ...sample,
      contractId: 'c-verify',
      provider: 'prov-a',
    });
    const actuals = new Map<string, ActualResponse>([['c-verify', { status: 200, body: { id: 1, name: 'A', active: true } }]]);
    const results = verifyProvider('t-verify', 'prov-a', actuals);
    expect(results.length).toBeGreaterThan(0);
  });

  it('호환성 매트릭스', () => {
    registerContract('t-mx', { ...sample, contractId: 'c-mx-1' });
    const actuals = new Map<string, ActualResponse>([['c-mx-1', { status: 200, body: { id: 1, name: 'A', active: true } }]]);
    const results = verifyProvider('t-mx', 'user-service', actuals);
    const matrix = buildCompatibilityMatrix(results);
    expect(matrix.length).toBeGreaterThan(0);
  });

  it('누락 실제 응답 감지', () => {
    registerContract('t-miss', { ...sample, contractId: 'c-miss', provider: 'prov-miss' });
    const results = verifyProvider('t-miss', 'prov-miss', new Map());
    expect(results.some((r) => r.violations.includes('no actual response'))).toBe(true);
  });

  it('서비스 클래스', () => {
    const svc = new ConsumerDrivenContractService('t-svc');
    svc.register({ ...sample, contractId: 'c-svc' });
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('감사 로그 테넌트 격리', () => {
    registerContract('t-iso-a', { ...sample, contractId: 'c-iso-a' });
    registerContract('t-iso-b', { ...sample, contractId: 'c-iso-b' });
    expect(getContractAuditLog('t-iso-a').every((e) => e.tenantId === 't-iso-a')).toBe(true);
  });
});
