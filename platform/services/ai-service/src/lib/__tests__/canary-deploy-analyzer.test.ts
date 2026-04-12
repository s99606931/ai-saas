// MTU-N310 카나리 배포 분석 테스트
import { describe, it, expect } from 'vitest';
import { CanaryDeployAnalyzerService } from '../canary-deploy-analyzer.js';

describe('MTU-N310 CanaryDeployAnalyzer', () => {
  const svc = new CanaryDeployAnalyzerService('tenant-n310');

  const baseline = {
    version: 'baseline' as const,
    metrics: { latency: 100, errorRate: 0.01 },
    sampleSize: 1000,
    collectedAt: '2026-04-11',
  };
  const canary = {
    version: 'canary' as const,
    metrics: { latency: 105, errorRate: 0.011 },
    sampleSize: 1000,
    collectedAt: '2026-04-11',
  };

  it('FR-N310.1: 설정 생성', () => {
    const cfg = svc.createConfig('payment-api', 'v1', 'v2');
    expect(cfg).toBeDefined();
    expect(svc.getConfigs().length).toBeGreaterThan(0);
  });

  it('FR-N310.2: 메트릭 비교', () => {
    const comparisons = svc.compare(baseline, canary, ['latency', 'errorRate']);
    expect(comparisons.length).toBe(2);
  });

  it('FR-N310.3: 카나리 결정', () => {
    const cfg = svc.createConfig('orders', 'v1', 'v2');
    const analysis = svc.analyze(cfg, baseline, canary);
    expect(analysis).toBeDefined();
  });

  it('FR-N310.4: 롤백 실행', () => {
    const cfg = svc.createConfig('users', 'v1', 'v2');
    const record = svc.rollback(cfg.configId, 'error spike');
    expect(record).toBeDefined();
  });

  it('FR-N310.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
