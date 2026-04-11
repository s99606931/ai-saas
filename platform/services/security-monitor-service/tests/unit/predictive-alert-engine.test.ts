// MTU-N242 단위 테스트: 예측적 장애 방지 엔진
// Design Ref: MTU-N242 Design
// CSAP: D-06 감사 로깅, D-12 시스템 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PredictiveAlertEngine,
  PredictionScenario,
  MetricDataPoint,
} from '../../src/lib/predictive-alert-engine';

/**
 * 선형 증가 시계열 생성 (value = startValue + rate * t)
 */
function generateLinearSeries(
  startValue: number,
  ratePerSecond: number,
  count: number,
  intervalMs: number = 60000,
  startTime: number = Date.now() - count * intervalMs,
): MetricDataPoint[] {
  const points: MetricDataPoint[] = [];
  for (let i = 0; i < count; i++) {
    const ts = startTime + i * intervalMs;
    const elapsed = (i * intervalMs) / 1000;
    points.push({
      timestamp: ts,
      value: startValue + ratePerSecond * elapsed,
    });
  }
  return points;
}

describe('PredictiveAlertEngine', () => {
  let engine: PredictiveAlertEngine;

  beforeEach(() => {
    engine = new PredictiveAlertEngine();
  });

  describe('ingestMetric', () => {
    it('메트릭 데이터 포인트 기록', () => {
      engine.ingestMetric('test_metric', 42);
      expect(engine.getMetricCount('test_metric')).toBe(1);
    });

    it('일괄 수집', () => {
      const points = generateLinearSeries(0, 1, 20);
      engine.ingestMetrics('test_metric', points);
      expect(engine.getMetricCount('test_metric')).toBe(20);
    });

    it('메트릭 이름 목록 조회', () => {
      engine.ingestMetric('metric_a', 1);
      engine.ingestMetric('metric_b', 2);

      const names = engine.getMetricNames();
      expect(names).toContain('metric_a');
      expect(names).toContain('metric_b');
    });

    it('최대 포인트 수 초과 시 오래된 데이터 제거', () => {
      const smallEngine = new PredictiveAlertEngine({ maxDataPoints: 5 });
      for (let i = 0; i < 10; i++) {
        smallEngine.ingestMetric('test', i, Date.now() + i * 1000);
      }
      expect(smallEngine.getMetricCount('test')).toBe(5);
    });
  });

  describe('linearRegression', () => {
    it('완벽한 선형 데이터 (R²=1)', () => {
      // y = 2x + 10 (x in seconds)
      const points: MetricDataPoint[] = [];
      const t0 = 1000000;
      for (let i = 0; i < 10; i++) {
        points.push({
          timestamp: t0 + i * 1000,
          value: 10 + 2 * i,
        });
      }

      const result = engine.linearRegression(points);
      expect(result.slope).toBeCloseTo(2, 5);
      expect(result.intercept).toBeCloseTo(10, 5);
      expect(result.rSquared).toBeCloseTo(1, 3);
    });

    it('데이터 포인트 부족 시 기본값 반환', () => {
      const result = engine.linearRegression([]);
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(0);
      expect(result.rSquared).toBe(0);
    });

    it('단일 포인트 시 기본값 반환', () => {
      const result = engine.linearRegression([{ timestamp: 1000, value: 42 }]);
      expect(result.slope).toBe(0);
    });

    it('상수값 시 기울기 0', () => {
      const points: MetricDataPoint[] = [];
      for (let i = 0; i < 10; i++) {
        points.push({ timestamp: 1000 + i * 1000, value: 50 });
      }

      const result = engine.linearRegression(points);
      expect(result.slope).toBeCloseTo(0, 5);
      expect(result.intercept).toBeCloseTo(50, 5);
    });
  });

  describe('predictLinear', () => {
    it('미래 값 예측', () => {
      // y = 1*x + 0 (초 단위), 10초 후 = 10
      const points: MetricDataPoint[] = [];
      const t0 = 1000;
      for (let i = 0; i < 10; i++) {
        points.push({ timestamp: t0 + i * 1000, value: i });
      }

      const predicted = engine.predictLinear(points, 10);
      // 마지막 x = 9초, 10초 후 x = 19초 → y ≈ 19
      expect(predicted).toBeCloseTo(19, 0);
    });

    it('빈 데이터 시 0 반환', () => {
      expect(engine.predictLinear([], 3600)).toBe(0);
    });
  });

  describe('predict', () => {
    it('데이터 부족 시 null 반환', () => {
      // 기본 시나리오의 minDataPoints = 10, 데이터 미입력
      const result = engine.predict(PredictionScenario.DiskFull);
      expect(result).toBeNull();
    });

    it('디스크 용량 고갈 예측', () => {
      // 디스크 여유 공간이 감소 추세: 50% → threshold(10%) 이하 예측
      const points = generateLinearSeries(50, -0.001, 20, 60000);
      engine.ingestMetrics('node_filesystem_free_bytes', points);

      const result = engine.predict(PredictionScenario.DiskFull);
      expect(result).not.toBeNull();
      expect(result!.scenario).toBe(PredictionScenario.DiskFull);
      expect(result!.dataPointCount).toBe(20);
      expect(result!.windows.length).toBeGreaterThan(0);
    });

    it('메모리 OOM 예측 — 증가 추세', () => {
      // 메모리 사용률 점진 증가: 60% → 90% 초과 예측
      const points = generateLinearSeries(60, 0.01, 20, 60000);
      engine.ingestMetrics('container_memory_usage_bytes', points);

      const result = engine.predict(PredictionScenario.MemoryOOM);
      expect(result).not.toBeNull();
      expect(result!.scenario).toBe(PredictionScenario.MemoryOOM);
    });

    it('SLO 위반 예측 — 에러율 증가', () => {
      // 에러율 0.5% → 5% 초과 예측
      const points = generateLinearSeries(0.5, 0.001, 20, 60000);
      engine.ingestMetrics('error_rate_5m', points);

      const result = engine.predict(PredictionScenario.SLOBreach);
      expect(result).not.toBeNull();
      expect(result!.scenario).toBe(PredictionScenario.SLOBreach);
    });

    it('회귀 품질 미달 시 breach 미표시', () => {
      // 무작위 데이터 — R² 낮음
      const points: MetricDataPoint[] = [];
      const t0 = Date.now() - 20 * 60000;
      for (let i = 0; i < 20; i++) {
        points.push({
          timestamp: t0 + i * 60000,
          value: Math.random() * 100,
        });
      }
      engine.ingestMetrics('node_filesystem_free_bytes', points);

      const result = engine.predict(PredictionScenario.DiskFull);
      // R² < 0.5이면 breach 모두 false
      if (result && result.regressionQuality < 0.5) {
        for (const w of result.windows) {
          expect(w.breachExpected).toBe(false);
        }
      }
    });

    it('존재하지 않는 시나리오 시 null 반환', () => {
      const customEngine = new PredictiveAlertEngine({ scenarios: [] });
      const result = customEngine.predict(PredictionScenario.DiskFull);
      expect(result).toBeNull();
    });
  });

  describe('evaluateAll', () => {
    it('알림 없음 — 정상 범위', () => {
      // 모든 시나리오에 안정적인 데이터 입력
      const stablePoints = generateLinearSeries(30, 0, 20, 60000);
      engine.ingestMetrics('node_filesystem_free_bytes', stablePoints);

      const alerts = engine.evaluateAll();
      // 기울기=0이면 현재값 유지 → DiskFull threshold(10%) 미달 아님
      const diskAlerts = alerts.filter(a => a.scenario === PredictionScenario.DiskFull);
      expect(diskAlerts).toHaveLength(0);
    });

    it('디스크 고갈 예측 알림 생성', () => {
      // 급격한 감소 추세: 50 → 0 방향
      const points = generateLinearSeries(50, -0.05, 20, 60000);
      engine.ingestMetrics('node_filesystem_free_bytes', points);

      const alerts = engine.evaluateAll();
      const diskAlerts = alerts.filter(a => a.scenario === PredictionScenario.DiskFull);
      expect(diskAlerts.length).toBeGreaterThan(0);

      const alert = diskAlerts[0]!;
      expect(alert.severity).toBe('critical');
      expect(alert.title).toContain('디스크 용량 고갈');
      expect(alert.labels['scenario']).toBe('DISK_FULL');
    });

    it('알림 이력에 추가', () => {
      const points = generateLinearSeries(50, -0.05, 20, 60000);
      engine.ingestMetrics('node_filesystem_free_bytes', points);

      engine.evaluateAll();

      const history = engine.getAlertHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    it('알림에 필수 필드 포함', () => {
      const points = generateLinearSeries(50, -0.05, 20, 60000);
      engine.ingestMetrics('node_filesystem_free_bytes', points);

      const alerts = engine.evaluateAll();
      if (alerts.length > 0) {
        const alert = alerts[0]!;
        expect(alert.alertId).toMatch(/^pred-/);
        expect(alert.firedAt).toBeTruthy();
        expect(alert.description).toBeTruthy();
        expect(typeof alert.currentValue).toBe('number');
        expect(typeof alert.predictedValue).toBe('number');
        expect(typeof alert.threshold).toBe('number');
      }
    });
  });

  describe('getAccuracy', () => {
    it('초기 정확도', () => {
      const accuracy = engine.getAccuracy();
      expect(accuracy.totalPredictions).toBe(0);
      expect(accuracy.accuracy).toBe(0);
      expect(accuracy.falsePositiveRate).toBe(0);
    });

    it('예측 정확도 추적', () => {
      // 알림 생성
      const points = generateLinearSeries(50, -0.05, 20, 60000);
      engine.ingestMetrics('node_filesystem_free_bytes', points);
      engine.evaluateAll();

      // 검증 (실제 breach 발생)
      engine.validatePrediction(PredictionScenario.DiskFull, true);

      const accuracy = engine.getAccuracy();
      // 검증된 예측이 있을 수 있음 (checkAt 조건 충족 여부에 따라)
      expect(accuracy.totalPredictions).toBeGreaterThan(0);
    });
  });

  describe('getScenarios', () => {
    it('기본 5개 시나리오 구성', () => {
      const scenarios = engine.getScenarios();
      expect(scenarios).toHaveLength(5);

      const names = scenarios.map(s => s.scenario);
      expect(names).toContain(PredictionScenario.DiskFull);
      expect(names).toContain(PredictionScenario.MemoryOOM);
      expect(names).toContain(PredictionScenario.CertExpiry);
      expect(names).toContain(PredictionScenario.SLOBreach);
      expect(names).toContain(PredictionScenario.PVSaturation);
    });

    it('시나리오별 예측 윈도우 확인', () => {
      const scenarios = engine.getScenarios();
      const disk = scenarios.find(s => s.scenario === PredictionScenario.DiskFull)!;
      // Design Ref: 4h/24h/7d
      expect(disk.windows).toHaveLength(3);
      expect(disk.windows.map(w => w.name)).toEqual(['4h', '24h', '7d']);
    });

    it('메모리 시나리오 윈도우 1h/4h', () => {
      const scenarios = engine.getScenarios();
      const mem = scenarios.find(s => s.scenario === PredictionScenario.MemoryOOM)!;
      expect(mem.windows).toHaveLength(2);
      expect(mem.windows.map(w => w.name)).toEqual(['1h', '4h']);
    });

    it('인증서 시나리오 윈도우 30d/7d/1d', () => {
      const scenarios = engine.getScenarios();
      const cert = scenarios.find(s => s.scenario === PredictionScenario.CertExpiry)!;
      expect(cert.windows).toHaveLength(3);
      expect(cert.windows.map(w => w.name)).toEqual(['30d', '7d', '1d']);
    });
  });

  describe('getDashboardSummary', () => {
    it('대시보드 요약 데이터 구조', () => {
      const summary = engine.getDashboardSummary();
      expect(summary.scenarios).toHaveLength(5);
      expect(summary.recentAlerts).toBeInstanceOf(Array);
      expect(summary.accuracy).toBeDefined();
      expect(summary.accuracy.totalPredictions).toBe(0);
    });

    it('데이터 입력 후 대시보드 업데이트', () => {
      const points = generateLinearSeries(50, -0.05, 20, 60000);
      engine.ingestMetrics('node_filesystem_free_bytes', points);
      engine.evaluateAll();

      const summary = engine.getDashboardSummary();
      const diskScenario = summary.scenarios.find(
        s => s.scenario === PredictionScenario.DiskFull,
      )!;
      expect(diskScenario.dataPoints).toBe(20);
      expect(diskScenario.regressionQuality).not.toBeNull();
    });
  });

  describe('알림 이력', () => {
    it('최근 알림 조회 제한', () => {
      const points = generateLinearSeries(50, -0.05, 20, 60000);
      engine.ingestMetrics('node_filesystem_free_bytes', points);

      // 여러 번 평가
      for (let i = 0; i < 5; i++) {
        engine.evaluateAll();
      }

      const limited = engine.getAlertHistory(2);
      expect(limited.length).toBeLessThanOrEqual(2);
    });
  });

  describe('커스텀 시나리오', () => {
    it('사용자 정의 시나리오 구성', () => {
      const customEngine = new PredictiveAlertEngine({
        scenarios: [
          {
            scenario: PredictionScenario.PVSaturation,
            metricName: 'custom_pv_usage',
            windows: [{ name: '12h', seconds: 12 * 3600 }],
            threshold: 95,
            direction: 'above',
            severity: 'critical',
            minDataPoints: 5,
            minRSquared: 0.3,
          },
        ],
      });

      expect(customEngine.getScenarios()).toHaveLength(1);

      // 데이터 입력 및 예측
      const points = generateLinearSeries(80, 0.01, 10, 60000);
      customEngine.ingestMetrics('custom_pv_usage', points);

      const result = customEngine.predict(PredictionScenario.PVSaturation);
      expect(result).not.toBeNull();
      expect(result!.windows).toHaveLength(1);
      expect(result!.windows[0]!.windowName).toBe('12h');
    });
  });
});
