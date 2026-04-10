// 감사 로그 로거
// Design Ref: D-P00.4
// CSAP: D-06-01 침해사고 관리 — append-only, SHA-256 체인

import type { AuditEntry } from '@public-saas/types';
import { computeHash } from './integrity.js';

/**
 * 감사 로거 옵션
 */
export interface AuditLogOptions {
  /** 서비스 이름 (예: auth-service, user-service) */
  serviceName: string;
  /** 기본 테넌트 ID (서비스 수준 로그) */
  defaultTenantId?: string;
  /** 로그 전송 함수 (DB, 파일, HTTP 등) */
  transport: (entry: AuditEntry) => Promise<void>;
}

/**
 * CSAP D-06 준수 감사 로거
 *
 * - append-only 로그 구조
 * - SHA-256 체인으로 무결성 보장
 * - 모든 민감 작업 전수 기록
 * - 최소 1년 보존
 */
export class AuditLogger {
  private readonly serviceName: string;
  private readonly defaultTenantId: string;
  private readonly transport: (entry: AuditEntry) => Promise<void>;
  private lastHash: string = '0'.repeat(64); // 초기 해시

  constructor(options: AuditLogOptions) {
    this.serviceName = options.serviceName;
    this.defaultTenantId = options.defaultTenantId ?? 'system';
    this.transport = options.transport;
  }

  /**
   * 감사 로그 기록
   *
   * @param entry - 로그 엔트리 (id, timestamp, hash, previousHash는 자동 생성)
   */
  async log(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'hash' | 'previousHash'>): Promise<void> {
    const timestamp = new Date().toISOString();
    const id = `${this.serviceName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const fullEntry: AuditEntry = {
      ...entry,
      tenantId: entry.tenantId ?? this.defaultTenantId,
      id,
      timestamp,
      previousHash: this.lastHash,
      hash: '', // 아래에서 계산
    };

    // SHA-256 해시 계산 (체인 무결성)
    fullEntry.hash = await computeHash(fullEntry);
    this.lastHash = fullEntry.hash;

    await this.transport(fullEntry);
  }
}

/**
 * 감사 로거 팩토리 함수
 */
export function createAuditLogger(options: AuditLogOptions): AuditLogger {
  return new AuditLogger(options);
}

/**
 * 표준 HTTP transport 생성 팩토리
 *
 * 14개 서비스에서 반복되는 감사 로그 전송 패턴을 공통화합니다.
 * - stdout NDJSON 출력 (로그 수집기 연동)
 * - audit-service HTTP POST (가용 시)
 *
 * CSAP D-06: 감사 로그 이중 기록 (stdout + HTTP)
 *
 * @param serviceName - 서비스 이름 (로그 프리픽스)
 * @returns transport 함수
 */
export function createStandardTransport(serviceName: string): (entry: AuditEntry) => Promise<void> {
  return async (entry: AuditEntry): Promise<void> => {
    // stdout NDJSON 출력 (로그 수집기 연동)
    process.stdout.write(JSON.stringify({ level: 'audit', service: serviceName, ...entry }) + '\n');

    // audit-service HTTP 전송 (가용 시)
    const auditServiceUrl = process.env['AUDIT_SERVICE_URL'];
    if (auditServiceUrl) {
      try {
        await fetch(`${auditServiceUrl}/audit/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
      } catch {
        // 감사 서비스 불가 시 stdout 로그만 유지 (이미 기록됨)
      }
    }
  };
}

/**
 * 표준 감사 이벤트 로거 팩토리
 *
 * 14개 서비스의 공통 감사 로그 함수 패턴을 단일 팩토리로 제공합니다.
 *
 * @param serviceName - 서비스 이름
 * @param targetType - 대상 유형 (예: 'user', 'tenant', 'subscription')
 * @returns 감사 이벤트 로깅 함수
 */
export function createServiceAuditLogger(
  serviceName: string,
  targetType: string,
): (
  action: string,
  actor: string,
  target: string,
  tenantId: string,
  ip: string,
  userAgent: string,
  metadata?: Record<string, unknown>,
) => Promise<void> {
  const logger = createAuditLogger({
    serviceName,
    transport: createStandardTransport(serviceName),
  });

  return async (
    action: string,
    actor: string,
    target: string,
    tenantId: string,
    ip: string,
    userAgent: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> => {
    await logger.log({
      actor,
      action,
      target,
      targetType,
      tenantId,
      ip,
      userAgent,
      metadata,
    });
  };
}
