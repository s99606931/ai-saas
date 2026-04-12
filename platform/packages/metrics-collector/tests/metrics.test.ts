// Metrics Collector 테스트
// Plan SC: FR-MT.1~FR-MT.6

import { describe, it, expect, beforeEach } from 'vitest';
import { Counter, Gauge, Histogram, MetricsRegistry } from '../src/metrics.js';

describe('FR-MT.1: Counter', () => {
  let counter: Counter;

  beforeEach(() => {
    counter = new Counter('http_requests_total', 'HTTP 요청 총합');
  });

  it('기본 증가', () => {
    counter.inc();
    expect(counter.value()).toBe(1);
    counter.inc(5);
    expect(counter.value()).toBe(6);
  });

  it('음수 증가 거부', () => {
    expect(() => counter.inc(-1)).toThrow();
  });

  it('라벨별 독립 카운트', () => {
    counter.inc(1, { method: 'GET' });
    counter.inc(2, { method: 'POST' });
    expect(counter.value({ method: 'GET' })).toBe(1);
    expect(counter.value({ method: 'POST' })).toBe(2);
  });

  it('reset', () => {
    counter.inc(10);
    counter.reset();
    expect(counter.value()).toBe(0);
  });

  it('유효하지 않은 이름 거부', () => {
    expect(() => new Counter('123invalid', 'help')).toThrow();
  });
});

describe('FR-MT.2: Gauge', () => {
  let gauge: Gauge;

  beforeEach(() => {
    gauge = new Gauge('active_connections', '활성 연결 수');
  });

  it('set', () => {
    gauge.set(42);
    expect(gauge.value()).toBe(42);
  });

  it('inc/dec', () => {
    gauge.set(10);
    gauge.inc(5);
    expect(gauge.value()).toBe(15);
    gauge.dec(3);
    expect(gauge.value()).toBe(12);
  });

  it('음수 값 허용', () => {
    gauge.set(-5);
    expect(gauge.value()).toBe(-5);
  });
});

describe('FR-MT.3: Histogram', () => {
  let hist: Histogram;

  beforeEach(() => {
    hist = new Histogram('request_duration', '요청 시간', [0.1, 0.5, 1, 5]);
  });

  it('observe 후 sum/count', () => {
    hist.observe(0.05);
    hist.observe(0.3);
    hist.observe(2);
    expect(hist.count()).toBe(3);
    expect(hist.sum()).toBeCloseTo(2.35);
  });

  it('버킷 누적 개수', () => {
    hist.observe(0.05); // le=0.1, 0.5, 1, 5
    hist.observe(0.3); // le=0.5, 1, 5
    hist.observe(10); // le=none
    const exported = hist.export();
    expect(exported).toContain('le="0.1"} 1');
    expect(exported).toContain('le="0.5"} 2');
    expect(exported).toContain('le="+Inf"} 3');
  });

  it('빈 버킷 거부', () => {
    expect(() => new Histogram('x', 'y', [])).toThrow();
  });

  it('라벨별 독립 분포', () => {
    hist.observe(0.2, { route: '/api' });
    hist.observe(2, { route: '/slow' });
    expect(hist.count({ route: '/api' })).toBe(1);
    expect(hist.count({ route: '/slow' })).toBe(1);
  });
});

describe('FR-MT.4: 라벨 처리', () => {
  it('라벨 키 정렬 후 직렬화', () => {
    const counter = new Counter('test', 'test');
    counter.inc(1, { b: '2', a: '1' });
    const output = counter.export();
    expect(output).toContain('a="1",b="2"');
  });

  it('특수문자 이스케이프', () => {
    const counter = new Counter('test', 'test');
    counter.inc(1, { path: 'a"b\\c' });
    const output = counter.export();
    expect(output).toContain('a\\"b\\\\c');
  });
});

describe('FR-MT.5: Prometheus 포맷', () => {
  it('Counter export 형식', () => {
    const counter = new Counter('requests_total', 'Total requests');
    counter.inc(5);
    const output = counter.export();
    expect(output).toContain('# HELP requests_total Total requests');
    expect(output).toContain('# TYPE requests_total counter');
    expect(output).toContain('requests_total 5');
  });

  it('Gauge export 형식', () => {
    const gauge = new Gauge('temperature', 'Temp');
    gauge.set(23.5);
    const output = gauge.export();
    expect(output).toContain('# TYPE temperature gauge');
    expect(output).toContain('temperature 23.5');
  });

  it('Histogram export 형식', () => {
    const hist = new Histogram('latency', 'Latency', [0.5, 1]);
    hist.observe(0.3);
    const output = hist.export();
    expect(output).toContain('# TYPE latency histogram');
    expect(output).toContain('latency_bucket');
    expect(output).toContain('latency_sum');
    expect(output).toContain('latency_count');
  });
});

describe('FR-MT.6: Registry', () => {
  it('메트릭 등록/조회', () => {
    const reg = new MetricsRegistry();
    const counter = reg.register(new Counter('c1', 'help'));
    expect(reg.get('c1')).toBe(counter);
    expect(reg.size()).toBe(1);
  });

  it('중복 등록 거부', () => {
    const reg = new MetricsRegistry();
    reg.register(new Counter('c1', 'help'));
    expect(() => reg.register(new Counter('c1', 'help'))).toThrow();
  });

  it('exportPrometheus 통합', () => {
    const reg = new MetricsRegistry();
    reg.register(new Counter('c1', 'Counter 1')).inc(3);
    reg.register(new Gauge('g1', 'Gauge 1')).set(7);
    const output = reg.exportPrometheus();
    expect(output).toContain('c1 3');
    expect(output).toContain('g1 7');
  });

  it('unregister', () => {
    const reg = new MetricsRegistry();
    reg.register(new Counter('c1', 'help'));
    expect(reg.unregister('c1')).toBe(true);
    expect(reg.size()).toBe(0);
  });

  it('clear', () => {
    const reg = new MetricsRegistry();
    reg.register(new Counter('c1', 'help'));
    reg.register(new Counter('c2', 'help'));
    reg.clear();
    expect(reg.size()).toBe(0);
  });
});
