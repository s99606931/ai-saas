import { describe, it, expect } from 'vitest';
import {
  PredictiveWorkloadDistributor,
  type WorkloadNode,
} from '../predictive-workload-distributor.js';

describe('SVC-AI-ADV-R349 PredictiveWorkloadDistributor', () => {
  const svc = new PredictiveWorkloadDistributor();
  const nodes: WorkloadNode[] = [
    { id: 'n1', capacity: 100, load: 10 },
    { id: 'n2', capacity: 100, load: 50 },
  ];

  it('FR-349.1: 이동평균 예측', () => {
    const plan = svc.plan([10, 20, 30], 3, nodes);
    expect(plan.predicted).toBe(20);
  });

  it('FR-349.2: 용량 초과 overflow', () => {
    const tinyNodes: WorkloadNode[] = [{ id: 'n1', capacity: 5, load: 4 }];
    const plan = svc.plan([100], 1, tinyNodes);
    expect(plan.overflow).toBeGreaterThan(0);
  });

  it('저부하 노드 우선 할당', () => {
    const plan = svc.plan([10, 10, 10], 3, nodes);
    const n1 = plan.assignments.find((a) => a.nodeId === 'n1');
    const n2 = plan.assignments.find((a) => a.nodeId === 'n2');
    expect((n1?.addedLoad ?? 0) >= (n2?.addedLoad ?? 0)).toBe(true);
  });

  it('FR-349.3: C/S 차단', () => {
    expect(() => svc.plan([1], 1, nodes, 'S')).toThrow('N2SF_BLOCKED');
  });

  it('FR-349.4: 감사 로그', () => {
    svc.plan([10], 1, nodes);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });

  it('INVALID_PARAMS', () => {
    expect(() => svc.plan([], 1, nodes)).toThrow('INVALID_PARAMS');
    expect(() => svc.plan([1], 1, [])).toThrow('INVALID_PARAMS');
  });
});
