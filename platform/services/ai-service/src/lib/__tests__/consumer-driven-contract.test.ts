// MTU-N374 Consumer-Driven Contract 테스트
import { describe, it, expect } from 'vitest';
import { ConsumerDrivenContractService, type Contract, type ActualResponse } from '../consumer-driven-contract.js';

describe('MTU-N374 ConsumerDrivenContract', () => {
  const svc = new ConsumerDrivenContractService('tenant-n374');

  const contract: Contract = {
    contractId: 'c-1',
    consumer: 'web',
    provider: 'api',
    request: { method: 'GET', path: '/users/1' },
    response: { status: 200, bodySchema: { id: 'number', name: 'string' } },
  };

  it('FR-N374.1: 계약 등록', () => {
    svc.register(contract);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('FR-N374.2: Provider 검증 - 통과', () => {
    const actual = new Map<string, ActualResponse>([
      ['c-1', { status: 200, body: { id: 1, name: 'foo' } }],
    ]);
    const results = svc.verify('api', actual);
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it('FR-N374.3: 호환성 매트릭스', () => {
    const actual = new Map<string, ActualResponse>([
      ['c-1', { status: 200, body: { id: 1, name: 'foo' } }],
    ]);
    const results = svc.verify('api', actual);
    const matrix = svc.matrix(results);
    expect(matrix.length).toBeGreaterThan(0);
  });
});
