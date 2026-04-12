// MTU-N340 용량 예측 엔진 테스트
import { describe, it, expect } from 'vitest';
import { CapacityForecastEngineService } from '../capacity-forecast-engine.js';

describe('MTU-N340 CapacityForecastEngine', () => {
  const svc = new CapacityForecastEngineService('tenant-n340');

  it('FR-N340.1: 데이터 포인트 기록', () => {
    const dp = svc.record('r1', 'cpu', 60, '%');
    expect(dp).toBeDefined();
  });

  it('FR-N340.2: 트렌드 분석', () => {
    svc.record('r2', 'cpu', 50, '%');
    svc.record('r2', 'cpu', 60, '%');
    svc.record('r2', 'cpu', 70, '%');
    const trend = svc.trend('r2', 'cpu');
    expect(trend).toBeDefined();
  });

  it('FR-N340.3: 용량 예측', () => {
    svc.record('r3', 'memory', 40, 'GB');
    svc.record('r3', 'memory', 45, 'GB');
    const forecast = svc.forecast('r3', 'memory', 100, 30);
    expect(forecast).toBeDefined();
  });

  it('FR-N340.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
