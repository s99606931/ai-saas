// MTU-N371 서비스 메시 트레이스 분석기 테스트
import { describe, it, expect } from 'vitest';
import { ServiceMeshTraceAnalyzerService, type OtelSpan } from '../service-mesh-trace-analyzer.js';

describe('MTU-N371 ServiceMeshTraceAnalyzer', () => {
  const svc = new ServiceMeshTraceAnalyzerService('tenant-n371');

  const spans: OtelSpan[] = [
    { traceId: 't1', spanId: 's1', serviceName: 'gateway', operationName: 'GET /api', startTimeNs: 0, durationNs: 100_000_000, status: 'ok' },
    { traceId: 't1', spanId: 's2', parentSpanId: 's1', serviceName: 'api', operationName: 'handle', startTimeNs: 10_000_000, durationNs: 600_000_000, status: 'ok' },
    { traceId: 't1', spanId: 's3', parentSpanId: 's2', serviceName: 'db', operationName: 'query', startTimeNs: 20_000_000, durationNs: 80_000_000, status: 'error' },
  ];

  it('FR-N371.1: 서비스 그래프 구축', () => {
    const g = svc.buildGraph(spans);
    expect(g.services).toContain('gateway');
    expect(g.edges.length).toBeGreaterThan(0);
  });

  it('FR-N371.2: 레이턴시 + 병목 탐지', () => {
    const res = svc.analyze(spans, 500, 0.05);
    expect(res.bottlenecks.length).toBeGreaterThan(0);
  });

  it('FR-N371.3: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
