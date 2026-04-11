// TLS 인증서 생명주기 관리 -- FR-N334.1~FR-N334.4
// Design Ref: MTU-N334 | CSAP: D-06, D-08, D-09

export interface Certificate { readonly certId: string; readonly tenantId: string; readonly domain: string; readonly issuer: string; readonly serialNumber: string; readonly issuedAt: string; readonly expiresAt: string; readonly status: 'active' | 'expiring' | 'expired' | 'revoked'; readonly autoRenew: boolean; }
export interface RenewalSchedule { readonly scheduleId: string; readonly certId: string; readonly renewBefore: number; readonly scheduledAt: string; readonly status: 'pending' | 'completed' | 'failed'; }
export interface CertAuditEntry { readonly timestamp: string; readonly actor: string; readonly tenantId: string; readonly action: string; readonly target: string; readonly details: Record<string, unknown>; }

const auditLog: CertAuditEntry[] = [];
function recordAudit(entry: Omit<CertAuditEntry, 'timestamp'>): void { auditLog.push({ ...entry, timestamp: new Date().toISOString() }); }
export function getCertAuditLog(tenantId: string): readonly CertAuditEntry[] { return auditLog.filter(e => e.tenantId === tenantId); }

const certStore: Map<string, Certificate[]> = new Map();
const scheduleStore: RenewalSchedule[] = [];

export function registerCertificate(tenantId: string, domain: string, issuer: string, issuedAt: string, expiresAt: string, autoRenew: boolean = true): Certificate {
  const now = new Date();
  const expires = new Date(expiresAt);
  const daysUntilExpiry = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let status: Certificate['status'] = 'active';
  if (daysUntilExpiry <= 0) status = 'expired';
  else if (daysUntilExpiry <= 30) status = 'expiring';
  const cert: Certificate = { certId: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, tenantId, domain, issuer, serialNumber: Math.random().toString(36).slice(2, 18).toUpperCase(), issuedAt, expiresAt, status, autoRenew };
  const existing = certStore.get(tenantId) ?? [];
  existing.push(cert);
  certStore.set(tenantId, existing);
  recordAudit({ actor: 'system', tenantId, action: 'CERT_REGISTERED', target: cert.certId, details: { domain, issuer, expiresAt, status } });
  return cert;
}

export function getCertificates(tenantId: string): readonly Certificate[] { return certStore.get(tenantId) ?? []; }

export function checkExpiry(cert: Certificate, warningDays: number = 30): { expiring: boolean; daysRemaining: number; message: string } {
  const now = new Date();
  const expires = new Date(cert.expiresAt);
  const days = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return { expiring: true, daysRemaining: 0, message: `인증서 만료됨: ${cert.domain}` };
  if (days <= warningDays) return { expiring: true, daysRemaining: days, message: `인증서 ${days}일 후 만료: ${cert.domain}` };
  return { expiring: false, daysRemaining: days, message: `인증서 정상: ${cert.domain} (${days}일 남음)` };
}

export function scheduleRenewal(certId: string, renewBeforeDays: number = 30): RenewalSchedule {
  const schedule: RenewalSchedule = { scheduleId: `ren-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, certId, renewBefore: renewBeforeDays, scheduledAt: new Date().toISOString(), status: 'pending' };
  scheduleStore.push(schedule);
  return schedule;
}

export function getExpiringCertificates(tenantId: string, days: number = 30): readonly Certificate[] {
  const certs = certStore.get(tenantId) ?? [];
  return certs.filter(c => { const r = checkExpiry(c, days); return r.expiring; });
}

export class CertificateManagerService {
  constructor(private readonly tenantId: string) {}
  register(domain: string, issuer: string, issued: string, expires: string, auto?: boolean): Certificate { return registerCertificate(this.tenantId, domain, issuer, issued, expires, auto); }
  list(): readonly Certificate[] { return getCertificates(this.tenantId); }
  checkExpiry(cert: Certificate, days?: number): ReturnType<typeof checkExpiry> { return checkExpiry(cert, days); }
  expiring(days?: number): readonly Certificate[] { return getExpiringCertificates(this.tenantId, days); }
  scheduleRenewal(certId: string, days?: number): RenewalSchedule { return scheduleRenewal(certId, days); }
  getAuditLog(): readonly CertAuditEntry[] { return getCertAuditLog(this.tenantId); }
}
