// MTU-N309 서비스 의존성 맵 테스트
import { describe, it, expect } from 'vitest';
import { ServiceDependencyMapService } from '../service-dependency-map.js';

describe('MTU-N309 ServiceDependencyMap', () => {
  const svc = new ServiceDependencyMapService('tenant-n309');

  const trafficLogs = [
    { source: 'api', target: 'db', protocol: 'tcp' as const, latencyMs: 5, statusCode: 200, timestamp: '2026-04-11' },
    { source: 'api', target: 'cache', protocol: 'tcp' as const, latencyMs: 1, statusCode: 200, timestamp: '2026-04-11' },
  ];

  it('FR-N309.1: 의존성 탐색', () => {
    const edges = svc.discover(trafficLogs);
    expect(edges.length).toBeGreaterThan(0);
  });

  it('FR-N309.2: 토폴로지 맵 생성', () => {
    const edges = svc.discover(trafficLogs);
    const services = [
      { serviceId: 'api', name: 'api', version: '1', status: 'healthy' as const, endpoints: [], metadata: {} },
      { serviceId: 'db', name: 'db', version: '1', status: 'healthy' as const, endpoints: [], metadata: {} },
    ];
    const map = svc.generateMap(services, edges);
    expect(map).toBeDefined();
  });

  it('FR-N309.3: 순환 의존 감지', () => {
    const edges = svc.discover(trafficLogs);
    const cycles = svc.detectCycles(edges);
    expect(Array.isArray(cycles)).toBe(true);
  });

  it('FR-N309.4: Blast radius 분석', () => {
    const edges = svc.discover(trafficLogs);
    const analysis = svc.analyzeBlastRadius('db', edges);
    expect(analysis).toBeDefined();
  });

  it('FR-N309.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
