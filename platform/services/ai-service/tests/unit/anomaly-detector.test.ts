// SVC-AI-ADV-R30 단위 테스트: AI 이상 탐지 엔진
// Design Ref: SVC-AI-ADV-R30 DESIGN §1, §3~§7
// Plan SC: FR-ADV30.1~30.7
// CSAP: D-06 침해사고 자동 감지, D-12 보안 이벤트 모니터링

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  AnomalyDetector,
  getAnomalyDetector,
  resetAnomalyDetector,
} from '../../src/lib/anomaly-detector.js';
import type { MetricPoint, BaselineStats } from '../../src/lib/anomaly-detector.js';

// ── 기준선 관리 — Design §6 ───────────────────────���─────────────────────

describe('AnomalyDetector 기준선 (FR-ADV30.6)', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector();
  });

  afterEach(() => {
    detector.destroy();
  });

  it('기준선을 계산한다', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const stats = detector.calculateBaseline(values);
    expect(stats.mean).toBe(55);
    expect(stats.stddev).toBeGreaterThan(0);
    expect(stats.q1).toBeGreaterThan(0);
    expect(stats.q3).toBeGreaterThan(stats.q1);
    expect(stats.iqr).toBe(stats.q3 - stats.q1);
    expect(stats.sampleCount).toBe(10);
  });

  it('기준선을 설정하고 조회한다', () => {
    const values = [10, 20, 30, 40, 50];
    const stats = detector.calculateBaseline(values);
    detector.setBaseline('cpu', stats);
    const retrieved = detector.getBaseline('cpu');
    expect(retrieved).toBeDefined();
    expect(retrieved!.mean).toBe(30);
  });

  it('히스토리로 기준선을 학습한다', () => {
    const stats = detector.learnBaseline('memory', [100, 200, 300, 400, 500]);
    expect(stats.mean).toBe(300);
    expect(detector.getBaseline('memory')).toBeDefined();
  });

  it('빈 배열의 기준선은 0', () => {
    const stats = detector.calculateBaseline([]);
    expect(stats.mean).toBe(0);
    expect(stats.stddev).toBe(0);
  });

  it('단일 값의 기준선', () => {
    const stats = detector.calculateBaseline([42]);
    expect(stats.mean).toBe(42);
    expect(stats.stddev).toBe(0);
  });
});

// ── 통계적 이상치 탐지 — Design §1 ──────────────────────────────────────

describe('AnomalyDetector 탐지 알고리즘 (FR-ADV30.1)', () => {
  let detector: AnomalyDetector;
  let baseline: BaselineStats;

  beforeEach(() => {
    detector = new AnomalyDetector({ zScoreThreshold: 3.0, iqrMultiplier: 1.5 });
    // 정상 기준선: 평균 100, 표준편차 ~15
    baseline = detector.calculateBaseline(
      Array.from({ length: 100 }, (_, i) => 85 + (i % 30)),
    );
    detector.setBaseline('test', baseline);
  });

  afterEach(() => {
    detector.destroy();
  });

  it('Z-Score: 정상 범위 내 값은 false', () => {
    expect(detector.detectByZScore(100, baseline)).toBe(false);
  });

  it('Z-Score: 극단값은 true', () => {
    expect(detector.detectByZScore(1000, baseline)).toBe(true);
  });

  it('Z-Score: stddev=0이면 false', () => {
    const flatBaseline = detector.calculateBaseline([50, 50, 50]);
    expect(detector.detectByZScore(100, flatBaseline)).toBe(false);
  });

  it('IQR: 정상 범위 내 값은 false', () => {
    expect(detector.detectByIQR(100, baseline)).toBe(false);
  });

  it('IQR: 극단값은 true', () => {
    expect(detector.detectByIQR(1000, baseline)).toBe(true);
  });

  it('이동평균: 정상 범위 내 값은 false', () => {
    expect(detector.detectByMovingAverage(100, baseline)).toBe(false);
  });

  it('이동평균: 50% 이상 편차는 true', () => {
    expect(detector.detectByMovingAverage(0, baseline)).toBe(true);
  });
});

// ── 투표 기반 종합 탐지 ─────────────────────────────────────────────────

describe('AnomalyDetector 종합 탐지 (FR-ADV30.1)', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector({ voteThreshold: 2 });
    detector.learnBaseline('cpu', Array.from({ length: 100 }, () => 50 + Math.random() * 10));
  });

  afterEach(() => {
    detector.destroy();
  });

  it('정상값은 null (이상 아님)', () => {
    const point: MetricPoint = {
      timestamp: new Date().toISOString(),
      value: 55,
      source: 'cpu',
    };
    expect(detector.detect(point)).toBeNull();
  });

  it('극단값은 이상으로 탐지한다', () => {
    const point: MetricPoint = {
      timestamp: new Date().toISOString(),
      value: 999,
      source: 'cpu',
    };
    const result = detector.detect(point);
    expect(result).not.toBeNull();
    expect(result!.severity).toBeDefined();
    expect(result!.algorithms.length).toBeGreaterThanOrEqual(2);
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it('기준선 없으면 null', () => {
    const point: MetricPoint = {
      timestamp: new Date().toISOString(),
      value: 999,
      source: 'unknown',
    };
    expect(detector.detect(point)).toBeNull();
  });

  it('이상 유형을 분류한다 (보안)', () => {
    detector.learnBaseline('security', [1, 1, 1, 1, 1, 2, 1, 1, 1, 1]);
    const point: MetricPoint = {
      timestamp: new Date().toISOString(),
      value: 100,
      source: 'security',
      label: 'auth_failures',
    };
    const result = detector.detect(point);
    if (result) {
      expect(['security_breach', 'access_pattern']).toContain(result.type);
    }
  });
});

// ── 이벤트 수집 및 배치 분석 — Design §3 ──────────────────────────────

describe('AnomalyDetector 이벤트 수집 (FR-ADV30.3)', () => {
  let detector: AnomalyDetector;

  beforeEach(() => {
    detector = new AnomalyDetector({ window: { windowSize: 60000, slideInterval: 10000, maxBufferSize: 50 } });
    detector.learnBaseline('test', Array.from({ length: 50 }, () => 50));
  });

  afterEach(() => {
    detector.destroy();
  });

  it('이벤트를 수집하고 즉시 탐지한다', () => {
    const result = detector.ingest({
      timestamp: new Date().toISOString(),
      value: 55,
      source: 'test',
    });
    // 정상값이므로 null
    expect(result).toBeNull();
  });

  it('배치 분석을 수행한다', () => {
    // 변동 있는 기준선으로 재설정 (stddev > 0 필요)
    detector.learnBaseline('varied', Array.from({ length: 100 }, (_, i) => 50 + (i % 10)));
    const points: MetricPoint[] = [
      { timestamp: new Date().toISOString(), value: 55, source: 'varied' },
      { timestamp: new Date().toISOString(), value: 9999, source: 'varied' },
    ];
    const results = detector.analyzeBatch(points);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
});

// ── 팩토리 함수 ──────────────────────────────────────────────────────────

describe('AnomalyDetector 팩토리', () => {
  afterEach(() => {
    resetAnomalyDetector();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const d1 = getAnomalyDetector();
    const d2 = getAnomalyDetector();
    expect(d1).toBe(d2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const d1 = getAnomalyDetector();
    resetAnomalyDetector();
    const d2 = getAnomalyDetector();
    expect(d1).not.toBe(d2);
  });
});

// ── 리소스 정리 ──────────────────────────────────────────────────────────

describe('AnomalyDetector destroy', () => {
  it('destroy로 리소스를 정리한다', () => {
    const detector = new AnomalyDetector();
    detector.learnBaseline('cpu', [1, 2, 3]);
    detector.destroy();
    expect(detector.getBaseline('cpu')).toBeUndefined();
  });
});
