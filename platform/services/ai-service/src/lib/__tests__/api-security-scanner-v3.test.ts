import { describe, it, expect } from 'vitest';
import { ApiSecurityScannerV3 } from '../api-security-scanner-v3.js';

describe('SVC-AI-ADV-R609 (v3) ApiSecurityScannerV3', () => {
  const svc = new ApiSecurityScannerV3();

  it('FR-R609v3.2: AUTH_MISSING → CRITICAL', () => {
    const r = svc.scan([
      {
        id: 'e1',
        path: '/api/v1/x',
        method: 'GET',
        hasAuth: false,
        hasHttps: true,
        hasRateLimit: true,
        hasInputValidation: true,
      },
    ]);
    expect(r.items[0]?.findings).toContain('AUTH_MISSING');
    expect(r.items[0]?.maxSeverity).toBe('CRITICAL');
    expect(r.criticalCount).toBe(1);
  });

  it('FR-R609v3.2: INPUT_VALIDATION_MISSING → HIGH', () => {
    const r = svc.scan([
      {
        id: 'e2',
        path: '/api/v1/y',
        method: 'POST',
        hasAuth: true,
        hasHttps: true,
        hasRateLimit: true,
        hasInputValidation: false,
      },
    ]);
    expect(r.items[0]?.maxSeverity).toBe('HIGH');
    expect(r.highCount).toBe(1);
  });

  it('FR-R609v3.2: RATE_LIMIT_MISSING → MEDIUM', () => {
    const r = svc.scan([
      {
        id: 'e3',
        path: '/api/v1/z',
        method: 'GET',
        hasAuth: true,
        hasHttps: true,
        hasRateLimit: false,
        hasInputValidation: true,
      },
    ]);
    expect(r.items[0]?.maxSeverity).toBe('MEDIUM');
    expect(r.mediumCount).toBe(1);
  });

  it('FR-R609v3.3: 다중 결함 → 최상 severity', () => {
    const r = svc.scan([
      {
        id: 'e4',
        path: '/api/v1/w',
        method: 'POST',
        hasAuth: false,
        hasHttps: false,
        hasRateLimit: false,
        hasInputValidation: false,
      },
    ]);
    expect(r.items[0]?.findings).toHaveLength(4);
    expect(r.items[0]?.maxSeverity).toBe('CRITICAL');
  });

  it('FR-R609v3.2: 결함 없음 → NONE', () => {
    const r = svc.scan([
      {
        id: 'e5',
        path: '/api/v1/ok',
        method: 'GET',
        hasAuth: true,
        hasHttps: true,
        hasRateLimit: true,
        hasInputValidation: true,
      },
    ]);
    expect(r.items[0]?.maxSeverity).toBe('NONE');
    expect(r.items[0]?.findings).toEqual([]);
  });

  it('FR-R609v3.5: 감사 로그', () => {
    const local = new ApiSecurityScannerV3();
    local.scan([]);
    const log = local.getAuditLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe('API_SECURITY_SCAN');
  });
});
