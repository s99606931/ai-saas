import { describe, it, expect, beforeEach } from 'vitest';
import { UserBehaviorAnomalyDetector, type UserEvent, type UserBaseline } from '../user-behavior-anomaly-detector';

describe('UserBehaviorAnomalyDetector', () => {
  let detector: UserBehaviorAnomalyDetector;
  const now = Date.now();

  const makeEvent = (overrides: Partial<UserEvent> & { userId: string }): UserEvent => ({
    tenantId: 'tenant-1',
    action: 'READ',
    resourcePath: '/api/data',
    timestamp: now,
    ipAddress: '192.168.1.1',
    statusCode: 200,
    ...overrides,
  });

  beforeEach(() => {
    detector = new UserBehaviorAnomalyDetector();
  });

  // FR-R177.1 이벤트 기록
  it('FR-R177.1 이벤트 기록', () => {
    detector.recordEvent(makeEvent({ userId: 'u1' }));
    const alerts = detector.detect('u1');
    expect(Array.isArray(alerts)).toBe(true);
  });

  // FR-R177.2 베이스라인 등록
  it('FR-R177.2 베이스라인 등록', () => {
    const baseline: UserBaseline = {
      userId: 'u1',
      avgRequestsPerHour: 10,
      typicalHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
      commonIps: ['192.168.1.1'],
    };
    detector.registerBaseline(baseline);
    // 베이스라인 있어도 정상 범위 이벤트 → 이상 없음
    detector.recordEvent(makeEvent({ userId: 'u1' }));
    const alerts = detector.detect('u1');
    expect(alerts.some((a) => a.type === 'EXCESSIVE_REQUESTS')).toBe(false);
  });

  // FR-R177.3 이상 탐지
  it('FR-R177.3 과도한 요청 탐지 (기본 임계값 100)', () => {
    // 같은 시간대에 110건
    for (let i = 0; i < 110; i++) {
      detector.recordEvent(makeEvent({ userId: 'u2', timestamp: now }));
    }
    const alerts = detector.detect('u2');
    expect(alerts.some((a) => a.type === 'EXCESSIVE_REQUESTS')).toBe(true);
  });

  it('FR-R177.3 베이스라인 기반 과도한 요청 탐지', () => {
    detector.registerBaseline({
      userId: 'u3',
      avgRequestsPerHour: 5,
      typicalHours: [9, 10],
      commonIps: ['1.1.1.1'],
    });
    // 5 * 3 = 15 임계값보다 많이
    for (let i = 0; i < 20; i++) {
      detector.recordEvent(makeEvent({ userId: 'u3', timestamp: now }));
    }
    const alerts = detector.detect('u3');
    expect(alerts.some((a) => a.type === 'EXCESSIVE_REQUESTS')).toBe(true);
  });

  it('FR-R177.3 인증 실패 5건 이상 → CREDENTIAL_STUFFING', () => {
    for (let i = 0; i < 6; i++) {
      detector.recordEvent(makeEvent({ userId: 'u4', statusCode: 401 }));
    }
    const alerts = detector.detect('u4');
    expect(alerts.some((a) => a.type === 'CREDENTIAL_STUFFING')).toBe(true);
  });

  it('FR-R177.3 대량 내보내기 3건 이상', () => {
    for (let i = 0; i < 3; i++) {
      detector.recordEvent(makeEvent({ userId: 'u5', action: 'EXPORT', resourcePath: '/api/export' }));
    }
    const alerts = detector.detect('u5');
    expect(alerts.some((a) => a.type === 'BULK_EXPORT')).toBe(true);
  });

  it('FR-R177.3 이벤트 없는 사용자 이상 없음', () => {
    const alerts = detector.detect('nonexistent');
    expect(alerts).toHaveLength(0);
  });

  // FR-R177.4 경고 조회
  it('FR-R177.4 테넌트별 경고 필터', () => {
    for (let i = 0; i < 6; i++) {
      detector.recordEvent(makeEvent({ userId: 'u6', statusCode: 403, tenantId: 'T1' }));
    }
    detector.detect('u6');
    const alerts = detector.getAlerts('T1');
    expect(alerts.every((a) => a.tenantId === 'T1')).toBe(true);
  });

  // FR-R177.5 감사 로그
  it('FR-R177.5 이상 탐지 감사 로그', () => {
    for (let i = 0; i < 6; i++) {
      detector.recordEvent(makeEvent({ userId: 'u7', statusCode: 401 }));
    }
    detector.detect('u7');
    const log = detector.getAuditLog();
    expect(log.some((e) => e.action === 'ANOMALY_DETECTED')).toBe(true);
  });
});
