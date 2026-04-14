// Design Ref: SVC-AI-ADV-R687.design.md — AI기반 시스템 간 데이터 정합성 v2
// Plan SC: FR-R687.1~5

import { createHash } from 'crypto';

export type ReconcileLevel = 'CRITICAL' | 'WARNING' | 'OK';
export type ReconcileAction = 'HALT_SYNC' | 'AUTO_HEAL' | 'NONE';

export interface ReconcilePair {
  pairId: string;
  sourceEmail: string;
  sourceRecord: Record<string, string>;
  targetRecord: Record<string, string>;
}

export interface ReconcileResult {
  pairId: string;
  maskedSource: string;
  mismatches: string[];
  driftRatio: number;
  level: ReconcileLevel;
  action: ReconcileAction;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details?: Record<string, unknown>;
}

function maskPII(value: string): string {
  return createHash('sha256').update(value).digest('hex').substring(0, 16);
}

export class CrossSystemReconcilerAIV2 {
  private readonly auditLog: AuditEntry[] = [];

  reconcile(pair: ReconcilePair, dataGrade?: string): ReconcileResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }

    const keys = Array.from(
      new Set([...Object.keys(pair.sourceRecord), ...Object.keys(pair.targetRecord)]),
    );
    if (keys.length === 0) {
      throw new Error('EMPTY_RECORDS');
    }

    const mismatches: string[] = [];
    for (const key of keys) {
      if (pair.sourceRecord[key] !== pair.targetRecord[key]) {
        mismatches.push(key);
      }
    }
    const driftRatio = Number((mismatches.length / keys.length).toFixed(4));

    let level: ReconcileLevel;
    let action: ReconcileAction;
    if (driftRatio >= 0.3) {
      level = 'CRITICAL';
      action = 'HALT_SYNC';
    } else if (driftRatio >= 0.1) {
      level = 'WARNING';
      action = 'AUTO_HEAL';
    } else {
      level = 'OK';
      action = 'NONE';
    }

    const maskedSource = maskPII(pair.sourceEmail);
    const result: ReconcileResult = {
      pairId: pair.pairId,
      maskedSource,
      mismatches,
      driftRatio,
      level,
      action,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECONCILE',
      details: { pairId: pair.pairId, maskedSource, level, driftRatio },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
