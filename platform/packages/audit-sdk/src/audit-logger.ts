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
  async log(
    entry: Omit<AuditEntry, 'id' | 'timestamp' | 'hash' | 'previousHash'>,
  ): Promise<void> {
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
