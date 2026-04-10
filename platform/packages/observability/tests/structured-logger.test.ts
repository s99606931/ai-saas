// StructuredLogger 단위 테스트
// Design Ref: SVC-OBSERVE-R15 Plan
// Plan SC: FR-OBS.2

import { describe, it, expect, beforeEach } from 'vitest';
import { StructuredLogger, type LogEntry } from '../src/structured-logger.js';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let entries: LogEntry[];

  beforeEach(() => {
    entries = [];
    logger = new StructuredLogger({
      service: 'test-service',
      level: 'trace',
      output: (entry) => entries.push(entry),
    });
  });

  it('JSON 구조화 로그를 생성한다', () => {
    logger.info('서비스 시작');

    expect(entries).toHaveLength(1);
    expect(entries[0]!.service).toBe('test-service');
    expect(entries[0]!.level).toBe('info');
    expect(entries[0]!.levelValue).toBe(30);
    expect(entries[0]!.message).toBe('서비스 시작');
    expect(entries[0]!.timestamp).toBeDefined();
  });

  it('모든 로그 레벨을 지원한다', () => {
    logger.trace('trace');
    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');
    logger.fatal('fatal');

    expect(entries).toHaveLength(6);
    expect(entries.map((e) => e.level)).toEqual([
      'trace', 'debug', 'info', 'warn', 'error', 'fatal',
    ]);
  });

  it('최소 로그 레벨 이하를 필터링한다', () => {
    const warnLogger = new StructuredLogger({
      service: 'test',
      level: 'warn',
      output: (entry) => entries.push(entry),
    });

    warnLogger.trace('무시');
    warnLogger.debug('무시');
    warnLogger.info('무시');
    warnLogger.warn('포함');
    warnLogger.error('포함');

    expect(entries).toHaveLength(2);
    expect(entries[0]!.level).toBe('warn');
    expect(entries[1]!.level).toBe('error');
  });

  it('추가 컨텍스트를 포함한다', () => {
    logger.info('요청 처리', { method: 'GET', path: '/api/users', statusCode: 200 });

    expect(entries[0]!.context).toEqual({
      method: 'GET',
      path: '/api/users',
      statusCode: 200,
    });
  });

  it('에러 정보를 포함한다', () => {
    const err = new Error('DB 연결 실패');
    logger.error('데이터베이스 에러', { db: 'postgres' }, err);

    expect(entries[0]!.error).toBeDefined();
    expect(entries[0]!.error!.name).toBe('Error');
    expect(entries[0]!.error!.message).toBe('DB 연결 실패');
    expect(entries[0]!.error!.stack).toBeDefined();
  });

  it('테넌트/요청 ID를 자동 포함한다', () => {
    logger.setContext('tenant-001', 'req-abc');
    logger.info('테넌트 작업');

    expect(entries[0]!.tenantId).toBe('tenant-001');
    expect(entries[0]!.requestId).toBe('req-abc');
  });

  it('PII 필드를 자동 마스킹한다', () => {
    logger.info('사용자 생성', {
      name: 'John',
      email: 'john@example.com',
      password: 'secret123',
      apiKey: 'sk-1234',
      phone: '010-1234-5678',
    });

    const ctx = entries[0]!.context!;
    expect(ctx['name']).toBe('John'); // PII 아님
    expect(ctx['email']).toBe('***MASKED***');
    expect(ctx['password']).toBe('***MASKED***');
    expect(ctx['apiKey']).toBe('***MASKED***');
    expect(ctx['phone']).toBe('***MASKED***');
  });

  it('중첩 객체의 PII도 마스킹한다', () => {
    logger.info('결제', {
      user: {
        name: 'Kim',
        creditCard: '1234-5678-9012-3456',
      },
    });

    const ctx = entries[0]!.context! as Record<string, Record<string, unknown>>;
    expect(ctx['user']!['name']).toBe('Kim');
    expect(ctx['user']!['creditCard']).toBe('***MASKED***');
  });

  it('maskPii=false 시 마스킹을 비활성화한다', () => {
    const noMask = new StructuredLogger({
      service: 'test',
      level: 'trace',
      maskPii: false,
      output: (entry) => entries.push(entry),
    });

    noMask.info('데이터', { email: 'visible@example.com' });

    expect(entries[0]!.context!['email']).toBe('visible@example.com');
  });

  it('child() 로거가 부모 컨텍스트를 상속한다', () => {
    logger.setContext('parent-tenant', 'parent-req');
    const child = logger.child({ requestId: 'child-req' });

    child.info('자식 로그');

    expect(entries[0]!.tenantId).toBe('parent-tenant');
    expect(entries[0]!.requestId).toBe('child-req');
  });

  it('child() 로거가 독립적으로 동작한다', () => {
    const child = logger.child({ tenantId: 'child-tenant' });
    child.info('child');
    logger.info('parent');

    expect(entries[0]!.tenantId).toBe('child-tenant');
    expect(entries[1]!.tenantId).toBeUndefined();
  });
});
