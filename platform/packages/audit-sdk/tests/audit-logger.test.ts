// audit-sdk 테스트
// Design Ref: D-P00.4
// Plan SC: FR-P00.4
// CSAP: D-06 감사 로그 SDK 검증

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AuditLogger,
  createAuditLogger,
  createStandardTransport,
  createServiceAuditLogger,
} from '../src/audit-logger.js';

describe('AuditLogger', () => {
  let transportFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    transportFn = vi.fn().mockResolvedValue(undefined);
  });

  it('로그 엔트리에 id, timestamp, hash, previousHash를 자동 생성한다', async () => {
    const logger = new AuditLogger({
      serviceName: 'test-service',
      transport: transportFn,
    });

    await logger.log({
      actor: 'user-1',
      action: 'TEST_ACTION',
      target: 'resource-1',
      targetType: 'test',
      tenantId: 'tenant-1',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    expect(transportFn).toHaveBeenCalledOnce();
    const entry = transportFn.mock.calls[0][0];
    expect(entry.id).toContain('test-service-');
    expect(entry.timestamp).toBeDefined();
    expect(entry.hash).toHaveLength(64); // SHA-256 hex
    expect(entry.previousHash).toBe('0'.repeat(64)); // 첫 엔트리
  });

  it('연속 로그 시 SHA-256 해시 체인이 형성된다', async () => {
    const logger = new AuditLogger({
      serviceName: 'test-service',
      transport: transportFn,
    });

    await logger.log({
      actor: 'user-1',
      action: 'FIRST',
      target: 'r1',
      targetType: 'test',
      tenantId: 't1',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    await logger.log({
      actor: 'user-2',
      action: 'SECOND',
      target: 'r2',
      targetType: 'test',
      tenantId: 't1',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    const firstEntry = transportFn.mock.calls[0][0];
    const secondEntry = transportFn.mock.calls[1][0];

    // 두 번째 엔트리의 previousHash는 첫 번째 엔트리의 hash
    expect(secondEntry.previousHash).toBe(firstEntry.hash);
    // 해시가 서로 다름
    expect(firstEntry.hash).not.toBe(secondEntry.hash);
  });

  it('defaultTenantId가 적용된다', async () => {
    const logger = new AuditLogger({
      serviceName: 'test-service',
      defaultTenantId: 'default-tenant',
      transport: transportFn,
    });

    await logger.log({
      actor: 'user-1',
      action: 'TEST',
      target: 'r1',
      targetType: 'test',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    const entry = transportFn.mock.calls[0][0];
    expect(entry.tenantId).toBe('default-tenant');
  });

  it('명시적 tenantId가 defaultTenantId를 오버라이드한다', async () => {
    const logger = new AuditLogger({
      serviceName: 'test-service',
      defaultTenantId: 'default-tenant',
      transport: transportFn,
    });

    await logger.log({
      actor: 'user-1',
      action: 'TEST',
      target: 'r1',
      targetType: 'test',
      tenantId: 'explicit-tenant',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    const entry = transportFn.mock.calls[0][0];
    expect(entry.tenantId).toBe('explicit-tenant');
  });
});

describe('createAuditLogger', () => {
  it('AuditLogger 인스턴스를 반환한다', () => {
    const logger = createAuditLogger({
      serviceName: 'test',
      transport: vi.fn().mockResolvedValue(undefined),
    });
    expect(logger).toBeInstanceOf(AuditLogger);
  });
});

describe('createStandardTransport', () => {
  it('stdout에 NDJSON을 출력한다', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const transport = createStandardTransport('test-service');
    await transport({
      id: 'test-1',
      actor: 'u1',
      action: 'TEST',
      target: 'r1',
      targetType: 'test',
      tenantId: 't1',
      timestamp: '2026-04-07T00:00:00.000Z',
      hash: 'abc',
      previousHash: '000',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    expect(writeSpy).toHaveBeenCalledOnce();
    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.level).toBe('audit');
    expect(parsed.service).toBe('test-service');
    expect(parsed.action).toBe('TEST');

    writeSpy.mockRestore();
  });

  it('AUDIT_SERVICE_URL 미설정 시 HTTP 전송을 건너뛴다', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const originalEnv = process.env['AUDIT_SERVICE_URL'];
    delete process.env['AUDIT_SERVICE_URL'];

    const transport = createStandardTransport('test-service');
    await transport({
      id: 'test-1',
      actor: 'u1',
      action: 'TEST',
      target: 'r1',
      targetType: 'test',
      tenantId: 't1',
      timestamp: '2026-04-07T00:00:00.000Z',
      hash: 'abc',
      previousHash: '000',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    // stdout 출력만 발생 (HTTP 전송 없음)
    expect(writeSpy).toHaveBeenCalledOnce();

    writeSpy.mockRestore();
    if (originalEnv) process.env['AUDIT_SERVICE_URL'] = originalEnv;
  });
});

describe('createServiceAuditLogger', () => {
  it('감사 이벤트 로깅 함수를 반환한다', async () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const logEvent = createServiceAuditLogger('billing-service', 'billing');
    await logEvent('PAYMENT_PROCESSED', 'user-1', 'invoice-123', 'tenant-1', '192.168.1.1', 'Mozilla/5.0', {
      amount: 10000,
    });

    expect(writeSpy).toHaveBeenCalledOnce();
    const output = writeSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output.trim());
    expect(parsed.service).toBe('billing-service');
    expect(parsed.action).toBe('PAYMENT_PROCESSED');
    expect(parsed.actor).toBe('user-1');
    expect(parsed.targetType).toBe('billing');
    expect(parsed.metadata).toEqual({ amount: 10000 });

    writeSpy.mockRestore();
  });
});
