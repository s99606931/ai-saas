import { describe, it, expect, beforeEach } from 'vitest';
import { ApiUsageForecasterAI } from '../api-usage-forecaster-ai';

describe('ApiUsageForecasterAI', () => {
  let forecaster: ApiUsageForecasterAI;

  beforeEach(() => {
    forecaster = new ApiUsageForecasterAI();
  });

  it('API를 등록한다', () => {
    forecaster.registerApi('api-1', '/api/users', 10000, 80);
    expect(forecaster.getAuditLog().some(l => l.action === 'REGISTER_API')).toBe(true);
  });

  it('호출 수를 기록한다', () => {
    forecaster.registerApi('api-1', '/api/users', 10000);
    forecaster.recordCallCount('api-1', 500, '2026-04-13T10');
    expect(forecaster.getAuditLog().some(l => l.action === 'RECORD_CALL_COUNT')).toBe(true);
  });

  it('상승 추세에서 높은 예측값을 반환한다', () => {
    forecaster.registerApi('api-1', '/api/users', 10000);
    for (let i = 1; i <= 5; i++) {
      forecaster.recordCallCount('api-1', i * 100, `2026-04-13T0${i}`);
    }
    const forecast = forecaster.forecastUsage('api-1', 5);
    expect(forecast.predictedPeak).toBeGreaterThan(500);
  });

  it('데이터 없으면 predictedPeak=0이다', () => {
    forecaster.registerApi('api-1', '/api/users', 10000);
    const forecast = forecaster.forecastUsage('api-1', 24);
    expect(forecast.predictedPeak).toBe(0);
  });

  it('용량 경고를 반환한다', () => {
    forecaster.registerApi('api-1', '/api/heavy', 100, 80);
    for (let i = 0; i < 5; i++) {
      forecaster.recordCallCount('api-1', 90, `2026-04-13T0${i}`);
    }
    const alerts = forecaster.getCapacityAlerts();
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    forecaster.registerApi('api-1', '/api/test', 10000);
    expect(() => forecaster.recordCallCount('api-1', 100, '2026-04-13T01', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 API 기록 시 오류를 던진다', () => {
    expect(() => forecaster.recordCallCount('unknown', 100, '2026-04-13T01')).toThrow('API 미등록');
  });
});
