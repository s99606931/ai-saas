// Design Ref: §핵심 알고리즘 — 만료 계산 + 통과율 + 인증 상태
// Plan SC: FR-R244.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type ExpiryStatus = 'valid' | 'expiring_soon' | 'expired';

interface CertificationItem {
  id: string;
  description: string;
}

interface Certification {
  id: string;
  name: string;
  expiryDate: string;
  items: CertificationItem[];
}

interface ItemCheckRecord {
  certId: string;
  itemId: string;
  passed: boolean;
  evidence: string;
  checkedAt: string;
}

interface ExpiryAlert {
  certId: string;
  certName: string;
  expiryDate: string;
  daysRemaining: number;
  urgency: 'critical' | 'warning';
}

interface CertificationReport {
  certId: string;
  certName: string;
  passRate: number;
  passedItems: string[];
  failedItems: string[];
  expiryStatus: ExpiryStatus;
  daysToExpiry: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R244.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class SecurityCertificationAI {
  private certifications = new Map<string, Certification>();
  private checkRecords: ItemCheckRecord[] = [];
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R244.1
  registerCertification(id: string, name: string, expiryDate: string, items: CertificationItem[]): void {
    this.certifications.set(id, { id, name, expiryDate, items });
    this.log('REGISTER_CERTIFICATION', { id, name, expiryDate, itemCount: items.length });
  }

  // Plan SC: FR-R244.2
  recordItemCheck(certId: string, itemId: string, passed: boolean, evidence: string, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    const cert = this.certifications.get(certId);
    if (!cert) throw new Error(`인증 미등록: ${certId}`);
    if (!cert.items.find(i => i.id === itemId)) throw new Error(`항목 미등록: ${itemId}`);

    this.checkRecords.push({ certId, itemId, passed, evidence, checkedAt: new Date().toISOString() });
    this.log('RECORD_ITEM_CHECK', { certId, itemId, passed });
  }

  // Plan SC: FR-R244.3
  getExpiryAlerts(thresholdDays: number = 30): ExpiryAlert[] {
    const alerts: ExpiryAlert[] = [];
    const now = Date.now();

    for (const cert of this.certifications.values()) {
      const expiryMs = new Date(cert.expiryDate).getTime();
      const daysRemaining = Math.floor((expiryMs - now) / (1000 * 60 * 60 * 24));

      if (daysRemaining <= thresholdDays) {
        alerts.push({
          certId: cert.id,
          certName: cert.name,
          expiryDate: cert.expiryDate,
          daysRemaining,
          urgency: daysRemaining <= 7 ? 'critical' : 'warning',
        });
      }
    }

    this.log('GET_EXPIRY_ALERTS', { count: alerts.length, thresholdDays });
    return alerts;
  }

  // Plan SC: FR-R244.4
  generateReport(certId: string): CertificationReport {
    const cert = this.certifications.get(certId);
    if (!cert) throw new Error(`인증 미등록: ${certId}`);

    const passedItems: string[] = [];
    const failedItems: string[] = [];

    for (const item of cert.items) {
      const records = this.checkRecords
        .filter(r => r.certId === certId && r.itemId === item.id)
        .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());

      const latestRecord = records[0];
      if (latestRecord?.passed) {
        passedItems.push(item.id);
      } else {
        failedItems.push(item.id);
      }
    }

    const passRate = cert.items.length === 0 ? 0 : Math.round((passedItems.length / cert.items.length) * 100);

    const now = Date.now();
    const expiryMs = new Date(cert.expiryDate).getTime();
    const daysToExpiry = Math.floor((expiryMs - now) / (1000 * 60 * 60 * 24));
    let expiryStatus: ExpiryStatus;
    if (daysToExpiry < 0) {
      expiryStatus = 'expired';
    } else if (daysToExpiry <= 30) {
      expiryStatus = 'expiring_soon';
    } else {
      expiryStatus = 'valid';
    }

    this.log('GENERATE_REPORT', { certId, passRate, expiryStatus });
    return { certId, certName: cert.name, passRate, passedItems, failedItems, expiryStatus, daysToExpiry };
  }

  // Plan SC: FR-R244.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
