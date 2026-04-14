// Design Ref: §판정 — 필드완전+체크섬유효:AUTHENTIC / 필드불완전:INCOMPLETE / 체크섬무효:TAMPERED
// Plan SC: SC-R543-1, SC-R543-2, SC-R543-3

interface DocumentInput {
  documentId: string;
  issuedBy: string;
  issuedAt: string;
  checksum: string;
  requiredFields: string[];
  presentFields: string[];
}

type AuthenticityVerdict = 'AUTHENTIC' | 'INCOMPLETE' | 'TAMPERED';

interface AuthenticityResult {
  documentId: string;
  verdict: AuthenticityVerdict;
  missingFields: string[];
  checksumValid: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  documentId: string;
  verdict: AuthenticityVerdict;
  issuedBy: string;
}

const CHECKSUM_PATTERN = /^[0-9a-fA-F]{16,}$/;

export class PublicDocumentAuthenticityVerifier {
  private readonly auditLog: AuditEntry[] = [];

  verify(input: DocumentInput): AuthenticityResult {
    const { documentId, issuedBy, checksum, requiredFields, presentFields } = input;

    const missingFields = requiredFields.filter((f) => !presentFields.includes(f));
    const checksumValid = CHECKSUM_PATTERN.test(checksum);

    let verdict: AuthenticityVerdict;
    if (missingFields.length > 0) {
      verdict = 'INCOMPLETE';
    } else if (!checksumValid) {
      verdict = 'TAMPERED';
    } else {
      verdict = 'AUTHENTIC';
    }

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'DOCUMENT_VERIFIED',
      documentId,
      verdict,
      issuedBy,
    });

    return { documentId, verdict, missingFields, checksumValid };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
