// MTU-N289 API UEBA 테스트
import { describe, it, expect } from 'vitest';
import { APITrafficUEBAService } from '../api-traffic-ueba.js';

describe('MTU-N289 APITrafficUEBA', () => {
  const svc = new APITrafficUEBAService('tenant-n289');

  function event(over: Partial<{ endpoint: string; userId: string; statusCode: number; responseTimeMs: number; payloadSizeBytes: number }> = {}) {
    return {
      eventId: `evt-${Math.random().toString(36).slice(2, 8)}`,
      userId: over.userId ?? 'u1',
      endpoint: over.endpoint ?? '/api/users',
      method: 'GET' as const,
      statusCode: over.statusCode ?? 200,
      responseTimeMs: over.responseTimeMs ?? 50,
      payloadSizeBytes: over.payloadSizeBytes ?? 200,
      ipAddress: '10.0.0.1',
      userAgent: 'Chrome/120',
      timestamp: new Date().toISOString(),
    };
  }

  it('FR-N289.1/2: 기준선 + 이상 처리', () => {
    for (let i = 0; i < 10; i++) {
      svc.processEvent(event());
    }
    const r = svc.processEvent(event());
    expect(r.baseline).toBeDefined();
    expect(Array.isArray(r.anomalies)).toBe(true);
  });

  it('FR-N289.3: 위협 리포트', () => {
    const r = svc.generateReport(24);
    expect(r).toBeDefined();
  });

  it('FR-N289.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
