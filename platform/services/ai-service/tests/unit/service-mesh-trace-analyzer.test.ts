// MTU-N371 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  buildServiceGraph,
  computeLatencyStats,
  detectBottlenecks,
  analyzeTrace,
  getMeshAuditLog,
  ServiceMeshTraceAnalyzerService,
  type OtelSpan,
} from '../../src/lib/service-mesh-trace-analyzer';

function mkSpan(partial: Partial<OtelSpan> & { spanId: string; serviceName: string }): OtelSpan {
  return {
    traceId: 't1',
    parentSpanId: undefined,
    operationName: 'op',
    startTimeNs: 0,
    durationNs: 10_000_000,
    status: 'ok',
    ...partial,
  };
}

describe('MTU-N371 ServiceMeshTraceAnalyzer', () => {
  it('서비스 목록 추출', () => {
    const spans = [mkSpan({ spanId: 's1', serviceName: 'gw' }), mkSpan({ spanId: 's2', serviceName: 'auth' })];
    const g = buildServiceGraph(spans);
    expect(g.services).toEqual(['auth', 'gw']);
  });

  it('부모-자식 에지 생성', () => {
    const spans = [
      mkSpan({ spanId: 's1', serviceName: 'gw' }),
      mkSpan({ spanId: 's2', serviceName: 'auth', parentSpanId: 's1' }),
    ];
    const g = buildServiceGraph(spans);
    expect(g.edges.length).toBe(1);
    expect(g.edges[0]?.from).toBe('gw');
    expect(g.edges[0]?.to).toBe('auth');
  });

  it('에러 카운트 집계', () => {
    const spans = [
      mkSpan({ spanId: 's1', serviceName: 'gw' }),
      mkSpan({ spanId: 's2', serviceName: 'auth', parentSpanId: 's1', status: 'error' }),
    ];
    const g = buildServiceGraph(spans);
    expect(g.edges[0]?.errorCount).toBe(1);
  });

  it('p95 지연 계산', () => {
    const spans = Array.from({ length: 100 }, (_, i) =>
      mkSpan({ spanId: `s${i}`, serviceName: 'api', durationNs: (i + 1) * 1_000_000 }),
    );
    const stats = computeLatencyStats(spans);
    expect(stats[0]?.p95Ms).toBeGreaterThanOrEqual(95);
  });

  it('에러율 계산', () => {
    const spans = [
      mkSpan({ spanId: 's1', serviceName: 'api', status: 'error' }),
      mkSpan({ spanId: 's2', serviceName: 'api', status: 'ok' }),
    ];
    const stats = computeLatencyStats(spans);
    expect(stats[0]?.errorRate).toBe(0.5);
  });

  it('병목 탐지 - p95 초과', () => {
    const stats = [{ service: 'api', operation: 'get', count: 10, p50Ms: 100, p95Ms: 800, p99Ms: 900, errorRate: 0 }];
    const b = detectBottlenecks(stats, 500, 0.05);
    expect(b.length).toBe(1);
    expect(b[0]?.service).toBe('api');
  });

  it('병목 탐지 - 에러율 초과', () => {
    const stats = [{ service: 'api', operation: 'get', count: 10, p50Ms: 100, p95Ms: 200, p99Ms: 300, errorRate: 0.2 }];
    const b = detectBottlenecks(stats, 500, 0.05);
    expect(b.length).toBe(1);
  });

  it('analyzeTrace 통합', () => {
    const spans = [mkSpan({ spanId: 's1', serviceName: 'gw' })];
    const r = analyzeTrace('t1', spans);
    expect(r.graph.services.length).toBe(1);
    expect(getMeshAuditLog('t1').length).toBeGreaterThan(0);
  });

  it('서비스 클래스 - analyze', () => {
    const svc = new ServiceMeshTraceAnalyzerService('t2');
    const r = svc.analyze([mkSpan({ spanId: 's1', serviceName: 'api' })]);
    expect(r.graph.services.length).toBe(1);
  });

  it('감사 로그 테넌트 격리', () => {
    analyzeTrace('tenant-a', [mkSpan({ spanId: 'x', serviceName: 'a' })]);
    analyzeTrace('tenant-b', [mkSpan({ spanId: 'y', serviceName: 'b' })]);
    expect(getMeshAuditLog('tenant-a').every((e) => e.tenantId === 'tenant-a')).toBe(true);
  });

  it('빈 스팬 처리', () => {
    const r = analyzeTrace('t1', []);
    expect(r.graph.services.length).toBe(0);
    expect(r.bottlenecks.length).toBe(0);
  });
});
