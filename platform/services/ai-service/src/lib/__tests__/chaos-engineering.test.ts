// MTU-N307 카오스 엔지니어링 테스트
import { describe, it, expect } from 'vitest';
import { ChaosEngineeringService } from '../chaos-engineering.js';

describe('MTU-N307 ChaosEngineering', () => {
  const svc = new ChaosEngineeringService('tenant-n307');

  it('FR-N307.1: 실험 생성', () => {
    const exp = svc.create('network-latency-test', 'network_latency', 'payment-api', 60);
    expect(exp).toBeDefined();
    expect(svc.getExperiments().length).toBeGreaterThan(0);
  });

  it('FR-N307.2: 안전장치 설정', () => {
    const exp = svc.create('cpu-stress', 'cpu_stress', 'worker');
    const guards = svc.setupGuards(exp.experimentId);
    expect(Array.isArray(guards)).toBe(true);
  });

  it('FR-N307.3: 실험 실행', () => {
    const exp = svc.create('dns-failure', 'dns_failure', 'api-gw');
    svc.setupGuards(exp.experimentId);
    const result = svc.execute(exp.experimentId);
    expect(result).toBeDefined();
  });

  it('FR-N307.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
