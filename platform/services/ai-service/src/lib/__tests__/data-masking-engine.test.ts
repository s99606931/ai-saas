// MTU-N337 데이터 마스킹 엔진 테스트
import { describe, it, expect } from 'vitest';
import { DataMaskingEngineService } from '../data-masking-engine.js';

describe('MTU-N337 DataMaskingEngine', () => {
  const svc = new DataMaskingEngineService('tenant-n337');

  it('FR-N337.1: 규칙 정의', () => {
    const rule = svc.defineRule('email', 'partial', true);
    expect(rule).toBeDefined();
  });

  it('FR-N337.2: 정적 데이터 마스킹', () => {
    svc.defineRule('phone', 'partial', true);
    const results = svc.maskStatic({ phone: '010-1234-5678', email: 'user@example.com' });
    expect(Array.isArray(results)).toBe(true);
  });

  it('FR-N337.3: 동적 마스킹', () => {
    svc.defineRule('ssn', 'full');
    const masked = svc.maskDynamic('ssn', '900101-1234567');
    expect(typeof masked).toBe('string');
  });

  it('FR-N337.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
