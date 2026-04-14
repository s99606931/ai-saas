// Design Ref: §N2SF — C/S BLOCKED, O+hasConsent→APPROVED/!hasConsent→PENDING_REVIEW
// Plan SC: SC-R603-1, SC-R603-2, SC-R603-3

interface DataSharingRequest {
  requestId: string;
  dataGrade: 'C' | 'S' | 'O';
  requesterId: string;
  receiverAgencyId: string;
  dataCategory: string;
  hasConsent: boolean;
}

type SharingStatus = 'APPROVED' | 'PENDING_REVIEW' | 'BLOCKED';

interface DataSharingResult {
  requestId: string;
  status: SharingStatus;
  requesterIdMasked: string;
  receiverAgencyId: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  requestId: string;
  status: SharingStatus;
  requesterIdMasked: string;
}

export class PublicDataSharingAutomatorV2 {
  private readonly auditLog: AuditEntry[] = [];

  process(input: DataSharingRequest): DataSharingResult {
    const { requestId, dataGrade, requesterId, receiverAgencyId, hasConsent } = input;

    // Plan SC: N2SF N-05 — C/S 등급 AI 전송 금지
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }

    const status: SharingStatus = hasConsent ? 'APPROVED' : 'PENDING_REVIEW';
    const requesterIdMasked = this.maskId(requesterId);

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'DATA_SHARING_PROCESSED',
      requestId,
      status,
      requesterIdMasked,
    });

    return { requestId, status, requesterIdMasked, receiverAgencyId };
  }

  private maskId(id: string): string {
    if (id.length < 4) return '***';
    return id.slice(0, 2) + '***' + id.slice(-2);
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
