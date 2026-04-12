import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimePerformanceBenchmarker } from '../realtime-performance-benchmarker';

describe('RealtimePerformanceBenchmarker', () => {
  let benchmarker: RealtimePerformanceBenchmarker;

  beforeEach(() => {
    benchmarker = new RealtimePerformanceBenchmarker();
  });

  it('시나리오를 등록한다', () => {
    benchmarker.registerScenario('s1', 'API 응답시간', 'responseTimeMs', 100, 20);
    const logs = benchmarker.getAuditLog();
    expect(logs.some(l => l.action === 'REGISTER_SCENARIO')).toBe(true);
  });

  it('결과를 기록하고 기준선 비교를 반환한다', () => {
    benchmarker.registerScenario('s1', 'API 응답시간', 'responseTimeMs', 100, 20);
    benchmarker.recordResult('s1', 110, 'run-1');
    benchmarker.recordResult('s1', 120, 'run-2');
    const comparison = benchmarker.compareToBaseline('s1');
    expect(comparison.baselineValue).toBe(100);
    expect(comparison.currentAvg).toBe(115);
    expect(comparison.regressionPercent).toBeGreaterThan(0);
  });

  it('회귀를 탐지한다 (임계값 초과)', () => {
    benchmarker.registerScenario('s1', '응답시간', 'ms', 100, 10);
    for (let i = 0; i < 5; i++) {
      benchmarker.recordResult('s1', 150, `run-${i}`);
    }
    const alerts = benchmarker.detectRegressions();
    expect(alerts.length).toBe(1);
    expect(alerts[0]!.scenarioId).toBe('s1');
  });

  it('회귀 없으면 빈 배열을 반환한다', () => {
    benchmarker.registerScenario('s1', '응답시간', 'ms', 100, 20);
    benchmarker.recordResult('s1', 100, 'run-1');
    benchmarker.recordResult('s1', 105, 'run-2');
    const alerts = benchmarker.detectRegressions();
    expect(alerts.length).toBe(0);
  });

  it('결과 없으면 regressionPercent=0이다', () => {
    benchmarker.registerScenario('s1', '응답시간', 'ms', 100, 10);
    const comparison = benchmarker.compareToBaseline('s1');
    expect(comparison.regressionPercent).toBe(0);
    expect(comparison.isRegression).toBe(false);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    benchmarker.registerScenario('s1', '응답시간', 'ms', 100, 10);
    expect(() => benchmarker.recordResult('s1', 100, 'run-1', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 시나리오 비교 시 오류를 던진다', () => {
    expect(() => benchmarker.compareToBaseline('unknown')).toThrow('시나리오 미등록');
  });

  it('심각한 회귀는 critical severity로 분류된다', () => {
    benchmarker.registerScenario('s1', '응답시간', 'ms', 100, 10);
    for (let i = 0; i < 5; i++) {
      benchmarker.recordResult('s1', 250, `run-${i}`);
    }
    const alerts = benchmarker.detectRegressions();
    expect(alerts[0]!.severity).toBe('critical');
  });
});
