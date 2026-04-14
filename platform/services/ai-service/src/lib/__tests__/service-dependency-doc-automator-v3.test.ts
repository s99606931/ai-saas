import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceDependencyDocAutomatorV3, type ServiceDep } from '../service-dependency-doc-automator-v3';

describe('ServiceDependencyDocAutomatorV3', () => {
  let automator: ServiceDependencyDocAutomatorV3;

  beforeEach(() => {
    automator = new ServiceDependencyDocAutomatorV3();
  });

  it('assigns depth 0 to root services (no dependsOn)', () => {
    const services: ServiceDep[] = [
      { serviceId: 'A', name: 'auth', dependsOn: [] },
      { serviceId: 'B', name: 'api', dependsOn: ['A'] },
    ];
    const report = automator.analyze(services);
    const a = report.services.find(s => s.serviceId === 'A')!;
    expect(a.depth).toBe(0);
  });

  it('assigns depth 1 to direct dependents', () => {
    const services: ServiceDep[] = [
      { serviceId: 'A', name: 'auth', dependsOn: [] },
      { serviceId: 'B', name: 'api', dependsOn: ['A'] },
    ];
    const report = automator.analyze(services);
    const b = report.services.find(s => s.serviceId === 'B')!;
    expect(b.depth).toBe(1);
  });

  it('counts impactedBy correctly', () => {
    const services: ServiceDep[] = [
      { serviceId: 'A', name: 'db', dependsOn: [] },
      { serviceId: 'B', name: 'api', dependsOn: ['A'] },
      { serviceId: 'C', name: 'web', dependsOn: ['A'] },
    ];
    const report = automator.analyze(services);
    const a = report.services.find(s => s.serviceId === 'A')!;
    expect(a.impactedBy).toBe(2);
  });

  it('detects cyclic dependency', () => {
    const services: ServiceDep[] = [
      { serviceId: 'X', name: 'svc-x', dependsOn: ['Y'] },
      { serviceId: 'Y', name: 'svc-y', dependsOn: ['X'] },
    ];
    const report = automator.analyze(services);
    expect(report.hasCycles).toBe(true);
    expect(report.cycleServices).toContain('X');
    expect(report.cycleServices).toContain('Y');
  });

  it('returns hasCycles false for acyclic graph', () => {
    const services: ServiceDep[] = [
      { serviceId: 'A', name: 'a', dependsOn: [] },
      { serviceId: 'B', name: 'b', dependsOn: ['A'] },
      { serviceId: 'C', name: 'c', dependsOn: ['B'] },
    ];
    const report = automator.analyze(services);
    expect(report.hasCycles).toBe(false);
  });

  it('records audit log', () => {
    automator.analyze([
      { serviceId: 'A', name: 'test', dependsOn: [] },
    ]);
    const log = automator.getAuditLog();
    expect(log[0]!.action).toBe('dependency.analyze');
  });
});
