// Design Ref: SVC-AI-ADV-R670.design.md — AI기반 데이터 보존 정책 자동화 v3
// Plan SC: FR-R670.1~5

import { createHash } from 'crypto';

export type DataCategory = 'audit' | 'health' | 'citizen' | 'temp';

interface RetentionInput {
  category: DataCategory;
  createdAt: Date;
  recordOwner: string;
}
interface RetentionResult {
  retentionDays: number;
  expired: boolean;
  maskedOwner: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const RETENTION_DAYS: Record<DataCategory, number> = {
  audit: 365,
  health: 1095,
  citizen: 1825,
  temp: 30,
};
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class DataRetentionPolicyAIV3 {
  private auditLog: AuditEntry[] = [];

  evaluate(input: RetentionInput, dataGrade?: string, now: Date = new Date()): RetentionResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const retentionDays = RETENTION_DAYS[input.category];
    const ageDays = (now.getTime() - input.createdAt.getTime()) / MS_PER_DAY;
    const expired = ageDays > retentionDays;
    const maskedOwner = createHash('sha256').update(input.recordOwner).digest('hex').substring(0, 16);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'EVALUATE_RETENTION',
      details: { category: input.category, retentionDays, expired },
    });
    return { retentionDays, expired, maskedOwner };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
