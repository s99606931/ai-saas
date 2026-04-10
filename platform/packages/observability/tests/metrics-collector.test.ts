// MetricsCollector 단위 테스트
// Design Ref: SVC-OBSERVE-R15 Plan
// Plan SC: FR-OBS.3

import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector, Counter, Gauge, Histogram } from '../src/metrics-collector.js';

describe('Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter('requests_total', 'Total requests');
  });

  it('초기값이 0이다', () => {
    expect(counter.get()).toBe(0);
  });

  it('증가시킨다', () => {
    counter.inc();
    counter.inc();
    expect(counter.get()).toBe(2);
  });

  it('특정 값만큼 증가시킨다', () => {
    counter.inc({}, 5);
    expect(counter.get()).toBe(5);
  });

  it('레이블별 독립 카운팅한다', () => {
    counter.inc({ method: 'GET' });
    counter.inc({ method: 'POST' });
    counter.inc({ method: 'GET' });

    expect(counter.get({ method: 'GET' })).toBe(2);
    expect(counter.get({ method: 'POST' })).toBe(1);
  });

  it('Prometheus 텍스트 형식으로 직렬화한다', () => {
    counter.inc({ method: 'GET' }, 10);
    counter.inc({ method: 'POST' }, 3);

    const output = counter.serialize();
    expect(output).toContain('# HELP requests_total Total requests');
    expect(output).toContain('# TYPE requests_total counter');
    expect(output).toContain('requests_total{method="GET"} 10');
    expect(output).toContain('requests_total{method="POST"} 3');
  });
});

describe('Gauge', () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge('active_connections', 'Active connections');
  });

  it('값을 설정한다', () => {
    gauge.set({}, 42);
    expect(gauge.get()).toBe(42);
  });

  it('증가/감소한다', () => {
    gauge.inc();
    gauge.inc();
    gauge.dec();
    expect(gauge.get()).toBe(1);
  });

  it('Prometheus 형식으로 직렬화한다', () => {
    gauge.set({ service: 'auth' }, 15);

    const output = gauge.serialize();
    expect(output).toContain('# TYPE active_connections gauge');
    expect(output).toContain('active_connections{service="auth"} 15');
  });
});

describe('Histogram', () => {
  let histogram: Histogram;

  beforeEach(() => {
    histogram = new Histogram('response_time', 'Response time in seconds', [0.1, 0.5, 1, 5]);
  });

  it('관찰값을 기록한다', () => {
    histogram.observe({}, 0.3);
    histogram.observe({}, 0.7);
    histogram.observe({}, 2.0);

    expect(histogram.getCount()).toBe(3);
    expect(histogram.getSum()).toBeCloseTo(3.0);
  });

  it('Prometheus 형식으로 직렬화한다', () => {
    histogram.observe({ path: '/api' }, 0.05);
    histogram.observe({ path: '/api' }, 0.3);
    histogram.observe({ path: '/api' }, 0.8);

    const output = histogram.serialize();
    expect(output).toContain('# TYPE response_time histogram');
    expect(output).toContain('response_time_bucket{le="0.1"');
    expect(output).toContain('response_time_bucket{le="0.5"');
    expect(output).toContain('response_time_bucket{le="+Inf"');
    expect(output).toContain('response_time_count');
    expect(output).toContain('response_time_sum');
  });
});

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector('auth_service');
  });

  it('카운터를 생성/반환한다', () => {
    const c1 = collector.counter('requests', 'Total requests');
    const c2 = collector.counter('requests', 'Total requests');

    expect(c1).toBe(c2); // 동일 인스턴스
    c1.inc();
    expect(c2.get()).toBe(1);
  });

  it('게이지를 생성/반환한다', () => {
    const g = collector.gauge('connections', 'Active connections');
    g.set({}, 5);
    expect(g.get()).toBe(5);
  });

  it('히스토그램을 생성/반환한다', () => {
    const h = collector.histogram('latency', 'Request latency');
    h.observe({}, 0.1);
    expect(h.getCount()).toBe(1);
  });

  it('서비스명 접두사를 추가한다', () => {
    const c = collector.counter('errors', 'Error count');
    expect(c.name).toBe('auth_service_errors');
  });

  it('전체 메트릭을 Prometheus 형식으로 직렬화한다', () => {
    collector.counter('requests', 'Requests').inc({ method: 'GET' });
    collector.gauge('memory', 'Memory usage').set({}, 512);
    collector.histogram('latency', 'Latency').observe({}, 0.1);

    const output = collector.serialize();
    expect(output).toContain('auth_service_requests');
    expect(output).toContain('auth_service_memory');
    expect(output).toContain('auth_service_latency');
  });

  it('메트릭 수를 반환한다', () => {
    collector.counter('a', 'A');
    collector.gauge('b', 'B');
    collector.histogram('c', 'C');

    expect(collector.getMetricCount()).toBe(3);
  });

  it('전체 초기화한다', () => {
    const c = collector.counter('test', 'Test');
    c.inc({}, 100);
    expect(c.get()).toBe(100);

    collector.reset();
    expect(c.get()).toBe(0);
  });
});
