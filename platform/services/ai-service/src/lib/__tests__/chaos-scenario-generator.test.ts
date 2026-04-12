// MTU-N377 카오스 시나리오 생성기 테스트
import { describe, it, expect } from 'vitest';
import { ChaosScenarioGeneratorService, type ServiceNode } from '../chaos-scenario-generator.js';

describe('MTU-N377 ChaosScenarioGenerator', () => {
  const svc = new ChaosScenarioGeneratorService('tenant-n377');

  const topology: ServiceNode[] = [
    { name: 'gateway', criticality: 'high', dependencies: [] },
    { name: 'api', criticality: 'medium', dependencies: ['gateway'] },
    { name: 'db', criticality: 'critical', dependencies: [] },
    { name: 'cache', criticality: 'low', dependencies: [] },
  ];

  it('FR-N377.1: 시나리오 생성 (critical 제외)', () => {
    const scenarios = svc.generate(topology);
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios.every((s) => s.target !== 'db')).toBe(true);
  });

  it('FR-N377.2: 블래스트 반경 계산', () => {
    const scenarios = svc.generate(topology);
    const gw = scenarios.find((s) => s.target === 'gateway');
    expect(gw).toBeDefined();
    expect(gw!.blastRadius.length).toBeGreaterThanOrEqual(1);
  });

  it('FR-N377.3: 안전성 검증', () => {
    const scenarios = svc.generate(topology);
    const check = svc.validate(scenarios[0]!, 10);
    expect(check.safe).toBe(true);
  });

  it('FR-N377.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
