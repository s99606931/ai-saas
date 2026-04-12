/**
 * 마이데이터 동의 관리 플랫폼 AI
 * Design Ref: MTU-N455 §3
 * Plan SC: FR-MD.1~5
 */

import { z } from 'zod';

export const ConsentScopeSchema = z.object({
  fieldId: z.string().min(1),
  mandatory: z.boolean(),
  granted: z.boolean(),
});

export type ConsentScope = z.infer<typeof ConsentScopeSchema>;

export const ConsentRecordSchema = z.object({
  consentId: z.string().min(1),
  subjectId: z.string().min(1),
  purpose: z.string().min(1),
  scopes: z.array(ConsentScopeSchema).min(1),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable().optional(),
});

export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

export type ConsentEventType = 'created' | 'updated' | 'revoked' | 'expired';

export interface ConsentEvent {
  eventId: string;
  consentId: string;
  type: ConsentEventType;
  timestamp: string;
  actor: string;
  diff?: Record<string, unknown>;
}

/**
 * Append-only 동의 이력 저장소 (FR-MD.4, CSAP D-06)
 */
export class ConsentAuditLog {
  private events: ConsentEvent[] = [];

  append(event: ConsentEvent): void {
    // 무결성 보장: 수정/삭제 없이 추가만
    this.events.push({ ...event });
  }

  history(consentId: string): ConsentEvent[] {
    return this.events
      .filter((e) => e.consentId === consentId)
      .map((e) => ({ ...e }));
  }

  all(): ConsentEvent[] {
    return this.events.map((e) => ({ ...e }));
  }
}

/**
 * 동의 수명주기 관리자 (FR-MD.1, FR-MD.2, FR-MD.3)
 */
export class ConsentManager {
  private records = new Map<string, ConsentRecord>();
  private auditLog: ConsentAuditLog;
  private eventSeq = 0;

  constructor(auditLog?: ConsentAuditLog) {
    this.auditLog = auditLog ?? new ConsentAuditLog();
  }

  private nextEventId(): string {
    this.eventSeq++;
    return `evt-${Date.now()}-${this.eventSeq}`;
  }

  /**
   * 동의 생성 (FR-MD.1)
   */
  create(input: {
    consentId: string;
    subjectId: string;
    purpose: string;
    scopes: ConsentScope[];
    validityDays: number;
    actor: string;
  }): ConsentRecord {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + input.validityDays);

    const record: ConsentRecord = {
      consentId: input.consentId,
      subjectId: input.subjectId,
      purpose: input.purpose,
      scopes: input.scopes.map((s: ConsentScope) => ({ ...s })),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
    };

    const validated = ConsentRecordSchema.parse(record);
    this.records.set(validated.consentId, validated);
    this.auditLog.append({
      eventId: this.nextEventId(),
      consentId: validated.consentId,
      type: 'created',
      timestamp: now.toISOString(),
      actor: input.actor,
    });
    return validated;
  }

  /**
   * 범위 부분 철회 (FR-MD.3)
   */
  updateScope(consentId: string, fieldId: string, granted: boolean, actor: string): ConsentRecord {
    const record = this.records.get(consentId);
    if (!record) throw new Error(`동의 기록 없음: ${consentId}`);
    if (record.revokedAt) throw new Error('이미 철회된 동의입니다');

    const scope = record.scopes.find((s) => s.fieldId === fieldId);
    if (!scope) throw new Error(`범위 없음: ${fieldId}`);
    if (scope.mandatory && !granted) {
      throw new Error('필수 동의는 철회할 수 없습니다');
    }

    const prevGranted = scope.granted;
    scope.granted = granted;

    this.auditLog.append({
      eventId: this.nextEventId(),
      consentId,
      type: 'updated',
      timestamp: new Date().toISOString(),
      actor,
      diff: { fieldId, prevGranted, newGranted: granted },
    });
    return record;
  }

  /**
   * 전체 철회 (FR-MD.2)
   */
  revoke(consentId: string, actor: string): ConsentRecord {
    const record = this.records.get(consentId);
    if (!record) throw new Error(`동의 기록 없음: ${consentId}`);
    if (record.revokedAt) return record;

    record.revokedAt = new Date().toISOString();
    // 필수가 아닌 범위 모두 false
    for (const scope of record.scopes) {
      if (!scope.mandatory) scope.granted = false;
    }

    this.auditLog.append({
      eventId: this.nextEventId(),
      consentId,
      type: 'revoked',
      timestamp: record.revokedAt,
      actor,
    });
    return record;
  }

  /**
   * 처리 가능 여부 확인 (FR-MD.5)
   */
  canProcess(consentId: string, fieldId: string, now: Date = new Date()): boolean {
    const record = this.records.get(consentId);
    if (!record) return false;
    if (record.revokedAt) return false;
    if (new Date(record.expiresAt) < now) return false;
    const scope = record.scopes.find((s: ConsentScope) => s.fieldId === fieldId);
    return scope?.granted === true;
  }

  get(consentId: string): ConsentRecord | undefined {
    const record = this.records.get(consentId);
    return record
      ? { ...record, scopes: record.scopes.map((s: ConsentScope) => ({ ...s })) }
      : undefined;
  }

  getAuditLog(): ConsentAuditLog {
    return this.auditLog;
  }
}
