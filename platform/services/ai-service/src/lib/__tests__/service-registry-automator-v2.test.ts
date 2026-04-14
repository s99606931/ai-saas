import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceRegistryAutomatorV2, type ServiceEntry } from '../service-registry-automator-v2';

describe('ServiceRegistryAutomatorV2', () => {
  let registry: ServiceRegistryAutomatorV2;

  beforeEach(() => {
    registry = new ServiceRegistryAutomatorV2();
  });

  it('registers a service and returns it in snapshot', () => {
    const entry: ServiceEntry = {
      serviceId: 'SVC1',
      name: 'auth-service',
      version: '1.0.0',
      endpoint: 'http://auth:8080',
      healthCheckUrl: 'http://auth:8080/health',
    };
    registry.register(entry);
    const snapshot = registry.getSnapshot();
    expect(snapshot[0]!.serviceId).toBe('SVC1');
  });

  it('classifies DOWN service as UNHEALTHY', () => {
    const updates = [{ serviceId: 'SVC2', status: 'DOWN' as const, responseMs: 100 }];
    const report = registry.updateHealth(updates);
    expect(report.services[0]!.registryStatus).toBe('UNHEALTHY');
  });

  it('classifies high responseMs as UNHEALTHY (responseMs>5000)', () => {
    const updates = [{ serviceId: 'SVC3', status: 'UP' as const, responseMs: 6000 }];
    const report = registry.updateHealth(updates);
    expect(report.services[0]!.registryStatus).toBe('UNHEALTHY');
  });

  it('classifies DEGRADED service as DEGRADED', () => {
    const updates = [{ serviceId: 'SVC4', status: 'DEGRADED' as const, responseMs: 200 }];
    const report = registry.updateHealth(updates);
    expect(report.services[0]!.registryStatus).toBe('DEGRADED');
  });

  it('classifies UP service with normal responseMs as HEALTHY', () => {
    const updates = [{ serviceId: 'SVC5', status: 'UP' as const, responseMs: 50 }];
    const report = registry.updateHealth(updates);
    expect(report.services[0]!.registryStatus).toBe('HEALTHY');
  });

  it('counts healthy and unhealthy correctly', () => {
    const updates = [
      { serviceId: 'SVC6', status: 'UP' as const, responseMs: 100 },
      { serviceId: 'SVC7', status: 'DOWN' as const, responseMs: 200 },
    ];
    const report = registry.updateHealth(updates);
    expect(report.healthy).toBe(1);
    expect(report.unhealthy).toBe(1);
  });

  it('records audit log on register and updateHealth', () => {
    const entry: ServiceEntry = {
      serviceId: 'SVC8',
      name: 'test',
      version: '1.0',
      endpoint: 'http://test',
      healthCheckUrl: 'http://test/health',
    };
    registry.register(entry);
    registry.updateHealth([{ serviceId: 'SVC8', status: 'UP', responseMs: 80 }]);
    const log = registry.getAuditLog();
    expect(log.some(e => e.action === 'registry.register')).toBe(true);
    expect(log.some(e => e.action === 'registry.healthUpdate')).toBe(true);
  });
});
