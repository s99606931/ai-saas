/**
 * 중앙 감사 로그 수집기
 * Design Ref: MTU-N179 §3
 * Plan SC: FR-AUDIT.1~8
 * CSAP D-06: 침해사고 관리 - 감사 로깅
 */

import { createHash } from 'crypto';
import { z } from 'zod';

// 감사 이벤트 소스 유형
export enum AuditSource {
  Application = 'application',
  Kubernetes = 'kubernetes',
  Keycloak = 'keycloak',
  GitOps = 'gitops',
  CICD = 'cicd',
  Infrastructure = 'infrastructure',
}

// 감사 이벤트 심각도
export enum AuditSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

// 감사 이벤트 스키마 (CSAP D-12 입력검증)
const AuditEventSchema = z.object({
  timestamp: z.string().datetime(),
  source: z.nativeEnum(AuditSource),
  severity: z.nativeEnum(AuditSeverity),
  actor: z.object({
    id: z.string(),
    type: z.enum(['user', 'service', 'system']),
    ip: z.string().optional(),
  }),
  action: z.string(),
  resource: z.object({
    type: z.string(),
    id: z.string(),
    name: z.string().optional(),
  }),
  result: z.enum(['success', 'failure', 'denied']),
  details: z.record(z.unknown()).optional(),
  metadata: z
    .object({
      namespace: z.string().optional(),
      cluster: z.string().optional(),
      environment: z.string().optional(),
    })
    .optional(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// FR-AUDIT.5: 해시 체인 무결성 검증
interface AuditRecord {
  event: AuditEvent;
  hash: string;
  previousHash: string;
  sequenceNumber: number;
}

/**
 * 중앙 감사 수집기
 */
export class CentralAuditCollector {
  private records: AuditRecord[] = [];
  private lastHash = '0000000000000000000000000000000000000000000000000000000000000000';
  private sequenceNumber = 0;

  /**
   * FR-AUDIT.1: 감사 이벤트 수집
   * 모든 소스의 이벤트를 통합 수집
   */
  collect(event: AuditEvent): AuditRecord {
    const validated = AuditEventSchema.parse(event);

    this.sequenceNumber++;

    // FR-AUDIT.5: 해시 체인 생성
    const hash = this.computeHash(validated, this.lastHash, this.sequenceNumber);

    const record: AuditRecord = {
      event: validated,
      hash,
      previousHash: this.lastHash,
      sequenceNumber: this.sequenceNumber,
    };

    this.records.push(record);
    this.lastHash = hash;

    return record;
  }

  /**
   * FR-AUDIT.5: 해시 체인 무결성 검증
   * 체인의 모든 레코드가 변조되지 않았는지 확인
   */
  verifyIntegrity(): { valid: boolean; brokenAt?: number; totalRecords: number } {
    let previousHash = '0000000000000000000000000000000000000000000000000000000000000000';

    for (let i = 0; i < this.records.length; i++) {
      const record = this.records[i];

      // 이전 해시 일치 확인
      if (record.previousHash !== previousHash) {
        return { valid: false, brokenAt: i, totalRecords: this.records.length };
      }

      // 해시 재계산 확인
      const expectedHash = this.computeHash(record.event, record.previousHash, record.sequenceNumber);
      if (record.hash !== expectedHash) {
        return { valid: false, brokenAt: i, totalRecords: this.records.length };
      }

      previousHash = record.hash;
    }

    return { valid: true, totalRecords: this.records.length };
  }

  /**
   * FR-AUDIT.8: 감사 로그 검색
   */
  search(filters: {
    source?: AuditSource;
    actor?: string;
    action?: string;
    startTime?: string;
    endTime?: string;
    result?: string;
    limit?: number;
  }): AuditRecord[] {
    let results = this.records;

    if (filters.source) {
      results = results.filter((r) => r.event.source === filters.source);
    }
    if (filters.actor) {
      results = results.filter((r) => r.event.actor.id === filters.actor);
    }
    if (filters.action) {
      results = results.filter((r) => r.event.action.includes(filters.action));
    }
    if (filters.startTime) {
      results = results.filter((r) => r.event.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      results = results.filter((r) => r.event.timestamp <= filters.endTime!);
    }
    if (filters.result) {
      results = results.filter((r) => r.event.result === filters.result);
    }

    const limit = filters.limit || 100;
    return results.slice(-limit);
  }

  /**
   * FR-AUDIT.6: CSAP D-06 준수 증적 생성
   */
  generateCSAPEvidence(
    startDate: string,
    endDate: string,
  ): {
    period: string;
    totalEvents: number;
    bySource: Record<string, number>;
    byResult: Record<string, number>;
    criticalEvents: number;
    integrityStatus: string;
    retentionDays: number;
  } {
    const periodRecords = this.records.filter((r) => r.event.timestamp >= startDate && r.event.timestamp <= endDate);

    const bySource: Record<string, number> = {};
    const byResult: Record<string, number> = {};
    let criticalEvents = 0;

    for (const record of periodRecords) {
      bySource[record.event.source] = (bySource[record.event.source] || 0) + 1;
      byResult[record.event.result] = (byResult[record.event.result] || 0) + 1;
      if (record.event.severity === AuditSeverity.Critical) {
        criticalEvents++;
      }
    }

    const integrity = this.verifyIntegrity();

    return {
      period: `${startDate} ~ ${endDate}`,
      totalEvents: periodRecords.length,
      bySource,
      byResult,
      criticalEvents,
      integrityStatus: integrity.valid ? 'PASS - 무결성 검증 통과' : 'FAIL - 무결성 위반',
      retentionDays: 365, // FR-AUDIT.7: 1년 보존
    };
  }

  /**
   * 전체 레코드 수
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * SHA-256 해시 체인 계산
   */
  private computeHash(event: AuditEvent, previousHash: string, seq: number): string {
    const data = JSON.stringify({ event, previousHash, seq });
    return createHash('sha256').update(data).digest('hex');
  }
}
