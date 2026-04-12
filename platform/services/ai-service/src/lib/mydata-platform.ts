// 공공 마이데이터 연동 플랫폼 -- FR-N386.1~FR-N386.5
// Design Ref: MTU-N386 | CSAP: D-06, D-08, D-09

export type ConsentStatus = 'active' | 'revoked' | 'expired';

export interface Consent {
  readonly consentId: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly dataCategories: readonly string[];
  readonly purpose: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  status: ConsentStatus;
}

export interface DataRequest {
  readonly requestId: string;
  readonly consentId: string;
  readonly category: string;
  readonly requestedAt: number;
}

export interface MydataAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const consents: Consent[] = [];
const auditLog: MydataAuditEntry[] = [];

function recordAudit(entry: Omit<MydataAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getMydataAuditLog(tenantId: string): readonly MydataAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

export function createConsent(
  tenantId: string,
  userId: string,
  dataCategories: readonly string[],
  purpose: string,
  durationDays = 30,
): Consent {
  const now = Date.now();
  const consent: Consent = {
    consentId: `c-${now}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    tenantId,
    dataCategories,
    purpose,
    createdAt: now,
    expiresAt: now + durationDays * 86400_000,
    status: 'active',
  };
  consents.push(consent);
  recordAudit({
    actor: userId,
    tenantId,
    action: 'CONSENT_CREATED',
    target: consent.consentId,
    details: { categories: dataCategories, purpose },
  });
  return consent;
}

export function revokeConsent(tenantId: string, consentId: string, userId: string): void {
  const consent = consents.find((c) => c.consentId === consentId && c.tenantId === tenantId);
  if (!consent) throw new Error(`동의 없음: ${consentId}`);
  if (consent.userId !== userId) throw new Error('권한 없음');
  consent.status = 'revoked';
  recordAudit({
    actor: userId,
    tenantId,
    action: 'CONSENT_REVOKED',
    target: consentId,
    details: {},
  });
}

export function checkConsentValid(consentId: string, category: string, now = Date.now()): boolean {
  const consent = consents.find((c) => c.consentId === consentId);
  if (!consent) return false;
  if (consent.status !== 'active') return false;
  if (consent.expiresAt < now) {
    consent.status = 'expired';
    return false;
  }
  return consent.dataCategories.includes(category);
}

export function requestData(tenantId: string, consentId: string, category: string): DataRequest {
  if (!checkConsentValid(consentId, category)) {
    throw new Error(`유효하지 않은 동의: ${consentId}/${category}`);
  }
  const req: DataRequest = {
    requestId: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    consentId,
    category,
    requestedAt: Date.now(),
  };
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'DATA_REQUESTED',
    target: req.requestId,
    details: { consentId, category },
  });
  return req;
}

export function maskData(data: Record<string, unknown>, sensitiveFields: readonly string[]): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...data };
  for (const field of sensitiveFields) {
    if (field in masked) {
      const value = String(masked[field]);
      masked[field] = value.length <= 4 ? '****' : value.slice(0, 2) + '****' + value.slice(-2);
    }
  }
  return masked;
}

export function listConsents(tenantId: string, userId: string): readonly Consent[] {
  return consents.filter((c) => c.tenantId === tenantId && c.userId === userId);
}

export class MydataPlatformService {
  constructor(private readonly tenantId: string) {}
  create(userId: string, categories: readonly string[], purpose: string, days = 30): Consent {
    return createConsent(this.tenantId, userId, categories, purpose, days);
  }
  revoke(consentId: string, userId: string): void {
    revokeConsent(this.tenantId, consentId, userId);
  }
  request(consentId: string, category: string): DataRequest {
    return requestData(this.tenantId, consentId, category);
  }
  mask(data: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
    return maskData(data, fields);
  }
  list(userId: string): readonly Consent[] {
    return listConsents(this.tenantId, userId);
  }
  getAuditLog(): readonly MydataAuditEntry[] {
    return getMydataAuditLog(this.tenantId);
  }
}
