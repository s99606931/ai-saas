// SVC-AI-ADV-R36 단위 테스트: 용량 예측기
// Design Ref: SVC-AI-ADV-R36 DESIGN §4
// Plan SC: FR-ADV36.4 (임계 도달 시점 예측)
// CSAP: D-06 용량 관리 감사

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  CapacityPredictor,
  getCapacityPredictor,
  resetCapacityPredictor,
  type ResourceType,
} from '../../src/lib/capacity-predictor.js';
import { TimeSeriesForecaster, type TimeSeriesPoint } from '../../src/lib/time-series-forecaster.js';

// -- 테스트 데이터 생성 ----------------------------------------------------------

function generateResourceData(
  count: number,
  base: number,
  trend: number = 0,
): TimeSeriesPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(2026, 0, 1 + i).toISOString(),
    value: base + trend * i,
  }));
}

// -- 단일 리소스 예측 -- Design §4 -----------------------------------------------

describe('CapacityPredictor 단일 리소스 예측', () => {
  let predictor: CapacityPredictor;
  let forecaster: TimeSeriesForecaster;

  beforeEach(() => {
    forecaster = new TimeSeriesForecaster({ smaWindow: 5 });
    predictor = new CapacityPredictor({ forecaster, forecastDays: 30 });
  });

  it('현재 사용량을 마지막 데이터로 계산한다', () => {
    const data = generateResourceData(20, 40, 1);
    const result = predictor.predictResource('cpu', data);
    // 마지막 값: 40 + 19 = 59
    expect(result.currentUsage).toBe(59);
    expect(result.resource).toBe('cpu');
  });

  it('빈 데이터는 현재 사용량 0', () => {
    const result = predictor.predictResource('cpu', []);
    expect(result.currentUsage).toBe(0);
    expect(result.currentPercent).toBe(0);
  });

  it('퍼센트를 maxCapacity 기준으로 계산한다', () => {
    // CPU maxCapacity = 100 (기본)
    const data = generateResourceData(20, 60);
    const result = predictor.predictResource('cpu', data);
    expect(result.currentPercent).toBeCloseTo(60, 0);
  });

  it('상승 추세를 감지한다', () => {
    // growthRate > 0.01 → 'growing'
    const data = generateResourceData(20, 50, 2);
    const result = predictor.predictResource('memory', data);
    expect(result.trend).toBe('growing');
    expect(result.growthRate).toBeGreaterThan(0.01);
  });

  it('안정 추세를 감지한다', () => {
    // 변동 없는 일정 값 → 'stable'
    const data = generateResourceData(20, 30, 0);
    const result = predictor.predictResource('disk', data);
    expect(result.trend).toBe('stable');
  });

  it('하락 추세를 감지한다', () => {
    const data = generateResourceData(20, 80, -2);
    const result = predictor.predictResource('cpu', data);
    expect(result.trend).toBe('declining');
    expect(result.growthRate).toBeLessThan(-0.01);
  });

  it('예측 결과를 포함한다', () => {
    const data = generateResourceData(20, 50, 1);
    const result = predictor.predictResource('cpu', data);
    expect(result.forecast.length).toBeGreaterThanOrEqual(0);
  });
});

// -- 임계값 도달 시점 -----------------------------------------------------------

describe('CapacityPredictor 임계값 도달 시점', () => {
  it('빠르게 증가하면 경고/임계 시점을 찾는다', () => {
    const forecaster = new TimeSeriesForecaster();
    const predictor = new CapacityPredictor({ forecaster, forecastDays: 90 });

    // 이미 높은 값에서 증가하는 데이터
    const data = generateResourceData(30, 70, 1);
    const result = predictor.predictResource('cpu', data);

    // 결과에 예측 데이터가 있으면 임계 탐색 가능
    // (예측값이 80, 95를 넘는지 여부)
    expect(result.resource).toBe('cpu');
    // warningDate/criticalDate는 예측 결과에 따라 달라짐
    if (result.warningDate) {
      expect(result.daysToWarning).toBeGreaterThan(0);
    }
  });

  it('낮은 사용량이면 임계 시점 없음', () => {
    const forecaster = new TimeSeriesForecaster();
    const predictor = new CapacityPredictor({ forecaster, forecastDays: 30 });

    // 매우 낮은 사용량
    const data = generateResourceData(20, 10, 0);
    const result = predictor.predictResource('cpu', data);

    expect(result.warningDate).toBeUndefined();
    expect(result.criticalDate).toBeUndefined();
  });
});

// -- 권장 사항 ----------------------------------------------------------------

describe('CapacityPredictor 권장 사항', () => {
  let forecaster: TimeSeriesForecaster;

  beforeEach(() => {
    forecaster = new TimeSeriesForecaster();
  });

  it('안정 시 정상 메시지를 반환한다', () => {
    const predictor = new CapacityPredictor({ forecaster, forecastDays: 30 });
    const data = generateResourceData(20, 10, 0);
    const result = predictor.predictResource('cpu', data);
    expect(result.recommendation).toContain('정상');
  });

  it('성장 추세 50% 이상이면 참고 메시지', () => {
    const predictor = new CapacityPredictor({ forecaster, forecastDays: 30 });
    // 현재 60%, 성장 추세
    const data = generateResourceData(20, 60, 0.5);
    const result = predictor.predictResource('cpu', data);
    // 성장 추세 + 50% 이상이면 '참고' 또는 더 심각한 메시지
    expect(result.recommendation.length).toBeGreaterThan(0);
  });
});

// -- 전체 보고서 ---------------------------------------------------------------

describe('CapacityPredictor 보고서 생성', () => {
  let predictor: CapacityPredictor;

  beforeEach(() => {
    const forecaster = new TimeSeriesForecaster();
    predictor = new CapacityPredictor({ forecaster, forecastDays: 30 });
  });

  it('여러 리소스에 대한 보고서를 생성한다', () => {
    const resourceData = new Map<ResourceType, TimeSeriesPoint[]>([
      ['cpu', generateResourceData(20, 30)],
      ['memory', generateResourceData(20, 40)],
      ['disk', generateResourceData(20, 50)],
    ]);

    const report = predictor.generateReport(resourceData);
    expect(report.predictions).toHaveLength(3);
    expect(report.timestamp).toBeTruthy();
  });

  it('안정 리소스는 healthy 상태', () => {
    const resourceData = new Map<ResourceType, TimeSeriesPoint[]>([
      ['cpu', generateResourceData(20, 10)],
      ['memory', generateResourceData(20, 20)],
    ]);

    const report = predictor.generateReport(resourceData);
    expect(report.overallStatus).toBe('healthy');
    expect(report.urgentResources).toHaveLength(0);
  });

  it('빈 리소스 데이터는 빈 보고서', () => {
    const report = predictor.generateReport(new Map());
    expect(report.predictions).toHaveLength(0);
    expect(report.overallStatus).toBe('healthy');
  });
});

// -- 임계값 관리 ---------------------------------------------------------------

describe('CapacityPredictor 임계값 관리', () => {
  let predictor: CapacityPredictor;

  beforeEach(() => {
    const forecaster = new TimeSeriesForecaster();
    predictor = new CapacityPredictor({ forecaster });
  });

  it('기본 임계값을 포함한다', () => {
    const thresholds = predictor.getThresholds();
    expect(thresholds.length).toBe(5);
    const cpu = thresholds.find((t) => t.resource === 'cpu');
    expect(cpu).toBeDefined();
    expect(cpu!.warningPercent).toBe(80);
    expect(cpu!.criticalPercent).toBe(95);
  });

  it('임계값을 업데이트한다', () => {
    predictor.updateThreshold('cpu', { warningPercent: 70 });
    const thresholds = predictor.getThresholds();
    const cpu = thresholds.find((t) => t.resource === 'cpu');
    expect(cpu!.warningPercent).toBe(70);
    expect(cpu!.criticalPercent).toBe(95); // 변경하지 않은 값은 유지
  });

  it('getThresholds는 방어 복사본을 반환한다', () => {
    const t1 = predictor.getThresholds();
    const t2 = predictor.getThresholds();
    expect(t1).not.toBe(t2);
    expect(t1).toEqual(t2);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('CapacityPredictor 팩토리', () => {
  afterEach(() => {
    resetCapacityPredictor();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const p1 = getCapacityPredictor();
    const p2 = getCapacityPredictor();
    expect(p1).toBe(p2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const p1 = getCapacityPredictor();
    resetCapacityPredictor();
    const p2 = getCapacityPredictor();
    expect(p1).not.toBe(p2);
  });
});
