// MTU-N367 API 남용 탐지 테스트
import { describe, it, expect } from 'vitest';
import { ApiAbuseDetectorService, type APICallRecord } from '../api-abuse-detector.js';

describe('MTU-N367 ApiAbuseDetector', () => {
  const svc = new ApiAbuseDetectorService('tenant-n367');

  const makeCalls = (clientId: string, count: number, endpointPrefix = '/api/v1/items'): APICallRecord[] =>
    Array.from({ length: count }, (_, i) => ({
      callId: `c-${i}`,
      clientId,
      endpoint: `${endpointPrefix}/${i}`,
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 50,
      timestamp: new Date(Date.now() + i * 10).toISOString(),
    }));

  it('FR-N367.1: 급격한 호출 탐지', () => {
    const calls = makeCalls('client-a', 150);
    const patterns = svc.detectBurst(calls, 60000, 100);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('FR-N367.2: 스크래핑 탐지', () => {
    const calls = Array.from({ length: 60 }, (_, i) => ({
      callId: `c-${i}`,
      clientId: 'client-b',
      endpoint: `/api/v1/r${i}`,
      method: 'GET',
      statusCode: 200,
      responseTimeMs: 10,
      timestamp: new Date().toISOString(),
    }));
    const patterns = svc.detectScraping(calls);
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('FR-N367.3: 대응 결정', () => {
    const calls = makeCalls('client-c', 200);
    const patterns = svc.detectBurst(calls, 60000, 100);
    const decisions = svc.decide(patterns);
    expect(decisions.length).toBeGreaterThan(0);
  });

  it('FR-N367.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
