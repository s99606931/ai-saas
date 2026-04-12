import { describe, it, expect, beforeEach } from 'vitest';
import { AutonomousInfraOptimizer, type ResourceMetric } from '../autonomous-infra-optimizer';

describe('AutonomousInfraOptimizer', () => {
  let optimizer: AutonomousInfraOptimizer;

  const metric = (nodeId: string, type: ResourceMetric['type'], util: number): ResourceMetric => ({
    nodeId, type, utilizationPct: util, timestamp: Date.now(),
  });

  beforeEach(() => {
    optimizer = new AutonomousInfraOptimizer();
  });

  // FR-R171.1 메트릭 수집
  it('FR-R171.1 메트릭 기록', () => {
    optimizer.recordMetric(metric('node-1', 'cpu', 70));
    const report = optimizer.generateReport();
    expect(report.totalNodes).toBe(1);
  });

  // FR-R171.2 이상 탐지
  it('FR-R171.2 고사용률 이상 탐지', () => {
    optimizer.recordMetric(metric('node-1', 'cpu', 90));
    const anomalies = optimizer.detectAnomalies(85, 15);
    expect(anomalies.some((a) => a.includes('node-1'))).toBe(true);
  });

  it('FR-R171.2 저사용률 이상 탐지', () => {
    optimizer.recordMetric(metric('node-2', 'memory', 5));
    const anomalies = optimizer.detectAnomalies(85, 15);
    expect(anomalies.some((a) => a.includes('node-2'))).toBe(true);
  });

  it('FR-R171.2 정상 범위 이상 없음', () => {
    optimizer.recordMetric(metric('node-3', 'cpu', 50));
    const anomalies = optimizer.detectAnomalies(85, 15);
    expect(anomalies.length).toBe(0);
  });

  // FR-R171.3 자율 액션 생성
  it('FR-R171.3 고사용률 → scale_up', () => {
    optimizer.recordMetric(metric('node-1', 'cpu', 90));
    optimizer.recordMetric(metric('node-1', 'memory', 88));
    const actions = optimizer.generateActions();
    expect(actions.some((a) => a.nodeId === 'node-1' && a.action === 'scale_up')).toBe(true);
  });

  it('FR-R171.3 저사용률 → scale_down', () => {
    optimizer.recordMetric(metric('node-1', 'cpu', 5));
    optimizer.recordMetric(metric('node-1', 'memory', 8));
    const actions = optimizer.generateActions();
    expect(actions.some((a) => a.action === 'scale_down')).toBe(true);
  });

  it('FR-R171.3 빈 메트릭 → 액션 없음', () => {
    const actions = optimizer.generateActions();
    expect(actions).toHaveLength(0);
  });

  // FR-R171.4 리포트 생성
  it('FR-R171.4 리포트 구조 확인', () => {
    optimizer.recordMetric(metric('node-1', 'cpu', 70));
    const report = optimizer.generateReport();
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('totalNodes');
    expect(report).toHaveProperty('avgUtilization');
    expect(report).toHaveProperty('actions');
    expect(report).toHaveProperty('estimatedSavingPct');
  });

  // FR-R171.5 감사 로그
  it('FR-R171.5 감사 로그 기록', () => {
    optimizer.generateActions();
    const log = optimizer.getAuditLog();
    expect(log.some((e) => e.action === 'ACTIONS_GENERATED')).toBe(true);
  });
});
