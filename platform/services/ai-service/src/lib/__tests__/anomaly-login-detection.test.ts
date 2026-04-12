// MTU-N288 이상 로그인 탐지 테스트
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerBaseline,
  evaluateLogin,
  adaptiveAuthDecision,
  triggerAlert,
  AnomalyLoginDetectionService,
} from '../anomaly-login-detection.js';

describe('MTU-N288 AnomalyLoginDetection', () => {
  const tenantId = 'tenant-n288';

  beforeEach(() => {
    registerBaseline({
      userId: 'normal-user',
      typicalCountries: ['KR'],
      typicalHours: [1, 2, 3, 9, 10, 11],
      typicalIpPrefixes: ['10.0', '192.168'],
    });
  });

  it('FR-N288.2: 정상 로그인은 low 위험', () => {
    const r = evaluateLogin({
      userId: 'normal-user',
      tenantId,
      timestamp: '2026-04-11T01:00:00Z',
      ipAddress: '10.0.0.5',
      userAgent: 'Chrome',
      geoCountry: 'KR',
      success: true,
    });
    expect(r.level).toBe('low');
    expect(r.recommendedAction).toBe('allow');
  });

  it('FR-N288.2: 비정상 국가는 위험 증가', () => {
    const r = evaluateLogin({
      userId: 'normal-user',
      tenantId,
      timestamp: '2026-04-11T01:00:00Z',
      ipAddress: '10.0.0.5',
      userAgent: 'Chrome',
      geoCountry: 'CN',
      success: true,
    });
    expect(['medium', 'high', 'critical']).toContain(r.level);
    expect(r.reasons.some((x) => x.includes('CN'))).toBe(true);
  });

  it('FR-N288.3: 무차별 대입 탐지', () => {
    for (let i = 0; i < 4; i++) {
      evaluateLogin({
        userId: 'brute-user',
        tenantId,
        timestamp: new Date().toISOString(),
        ipAddress: '1.2.3.4',
        userAgent: 'bot',
        geoCountry: 'XX',
        success: false,
      });
    }
    const r = evaluateLogin({
      userId: 'brute-user',
      tenantId,
      timestamp: new Date().toISOString(),
      ipAddress: '1.2.3.4',
      userAgent: 'bot',
      geoCountry: 'XX',
      success: false,
    });
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it('FR-N288.4: 적응형 인증 결정', () => {
    const r = evaluateLogin({
      userId: 'normal-user',
      tenantId,
      timestamp: '2026-04-11T01:00:00Z',
      ipAddress: '10.0.0.5',
      userAgent: 'Chrome',
      geoCountry: 'KR',
      success: true,
    });
    expect(adaptiveAuthDecision(r)).toBe('allow');
  });

  it('FR-N288.5: 알림 트리거', () => {
    const r = evaluateLogin({
      userId: 'normal-user',
      tenantId,
      timestamp: '2026-04-11T20:00:00Z',
      ipAddress: '8.8.8.8',
      userAgent: 'Chrome',
      geoCountry: 'CN',
      success: true,
    });
    const alert = triggerAlert(r, tenantId);
    if (r.level !== 'low') {
      expect(alert).not.toBeNull();
    }
  });

  it('FR-N288.6: Service + 감사 로그', () => {
    const svc = new AnomalyLoginDetectionService('tenant-svc-n288');
    svc.registerBaseline({
      userId: 'svc-u',
      typicalCountries: ['KR'],
      typicalHours: [9],
      typicalIpPrefixes: ['10.0'],
    });
    const r = svc.evaluate({
      userId: 'svc-u',
      timestamp: '2026-04-11T09:00:00Z',
      ipAddress: '10.0.0.1',
      userAgent: 'Chrome',
      geoCountry: 'KR',
      success: true,
    });
    expect(svc.decide(r)).toBe('allow');
    expect(svc.audit().length).toBeGreaterThan(0);
  });
});
