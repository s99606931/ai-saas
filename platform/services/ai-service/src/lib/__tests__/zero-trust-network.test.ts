// MTU-N304 제로트러스트 네트워크 테스트
import { describe, it, expect } from 'vitest';
import { ZeroTrustNetworkService } from '../zero-trust-network.js';

describe('MTU-N304 ZeroTrustNetwork', () => {
  const svc = new ZeroTrustNetworkService('tenant-n304');

  it('FR-N304.1: 세그먼트 정의', () => {
    const seg = svc.defineSegment('payment-zone', ['payment-api'], 'confidential');
    expect(seg).toBeDefined();
    expect(svc.getSegments().length).toBeGreaterThan(0);
  });

  it('FR-N304.2: 디바이스 신뢰도 평가', () => {
    const trust = svc.assessDevice('user-1', 'dev-1', {
      deviceType: 'managed',
      osVersion: '11',
      patchLevel: 'current',
      encryptionEnabled: true,
      antivirusActive: true,
    });
    expect(trust).toBeDefined();
  });

  it('FR-N304.3: 접근 결정', () => {
    const trust = svc.assessDevice('user-1', 'dev-1', {
      deviceType: 'managed',
      osVersion: '11',
      patchLevel: 'current',
      encryptionEnabled: true,
      antivirusActive: true,
    });
    const req = {
      requestId: 'req-1',
      userId: 'user-1',
      deviceId: 'dev-1',
      sourceIp: '10.0.0.1',
      targetService: 'payment-api',
      targetSegment: 'payment-zone',
      requestedAction: 'read',
      timestamp: '2026-04-11',
    };
    const decision = svc.decide(req, trust);
    expect(decision).toBeDefined();
  });

  it('FR-N304.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
