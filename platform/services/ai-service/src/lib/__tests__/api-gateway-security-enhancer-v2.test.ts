import { describe, it, expect, beforeEach } from 'vitest';
import { ApiGatewaySecurityEnhancerV2, type ApiRequest } from '../api-gateway-security-enhancer-v2';

describe('ApiGatewaySecurityEnhancerV2', () => {
  let enhancer: ApiGatewaySecurityEnhancerV2;

  beforeEach(() => {
    enhancer = new ApiGatewaySecurityEnhancerV2();
  });

  it('detects RATE_ABUSE and sets HIGH risk with BLOCK', () => {
    const requests: ApiRequest[] = [
      { clientId: 'C1', endpoint: '/api', requestsPerMin: 1500, errorRate: 0.01, uniqueIPs: 10 },
    ];
    const result = enhancer.analyze(requests);
    expect(result[0]!.anomalies).toContain('RATE_ABUSE');
    expect(result[0]!.riskLevel).toBe('HIGH');
    expect(result[0]!.policy).toBe('BLOCK');
  });

  it('detects ERROR_STORM and sets MEDIUM risk with THROTTLE', () => {
    const requests: ApiRequest[] = [
      { clientId: 'C2', endpoint: '/api', requestsPerMin: 100, errorRate: 0.5, uniqueIPs: 10 },
    ];
    const result = enhancer.analyze(requests);
    expect(result[0]!.anomalies).toContain('ERROR_STORM');
    expect(result[0]!.riskLevel).toBe('MEDIUM');
    expect(result[0]!.policy).toBe('THROTTLE');
  });

  it('detects IP_SWEEP and sets HIGH risk', () => {
    const requests: ApiRequest[] = [
      { clientId: 'C3', endpoint: '/api', requestsPerMin: 100, errorRate: 0.01, uniqueIPs: 600 },
    ];
    const result = enhancer.analyze(requests);
    expect(result[0]!.anomalies).toContain('IP_SWEEP');
    expect(result[0]!.riskLevel).toBe('HIGH');
  });

  it('marks NORMAL for safe request with ALLOW', () => {
    const requests: ApiRequest[] = [
      { clientId: 'C4', endpoint: '/api', requestsPerMin: 50, errorRate: 0.01, uniqueIPs: 5 },
    ];
    const result = enhancer.analyze(requests);
    expect(result[0]!.anomalies).toContain('NORMAL');
    expect(result[0]!.riskLevel).toBe('LOW');
    expect(result[0]!.policy).toBe('ALLOW');
  });

  it('can detect multiple anomalies simultaneously', () => {
    const requests: ApiRequest[] = [
      { clientId: 'C5', endpoint: '/api', requestsPerMin: 2000, errorRate: 0.6, uniqueIPs: 700 },
    ];
    const result = enhancer.analyze(requests);
    expect(result[0]!.anomalies).toContain('RATE_ABUSE');
    expect(result[0]!.anomalies).toContain('ERROR_STORM');
    expect(result[0]!.anomalies).toContain('IP_SWEEP');
  });

  it('records audit log', () => {
    enhancer.analyze([
      { clientId: 'C6', endpoint: '/api', requestsPerMin: 10, errorRate: 0.0, uniqueIPs: 1 },
    ]);
    const log = enhancer.getAuditLog();
    expect(log[0]!.action).toBe('gateway.analyze');
  });
});
