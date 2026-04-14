// Design Ref: §상태 기준 — SecurityCertManagerAi
// Plan SC: SVC-AI-ADV-R505

type CertStatus = 'valid' | 'expiring' | 'expired'

interface Certificate {
  certId: string
  domain: string
  issuer: string
  expiresAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  certId: string
  details?: Record<string, unknown>
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export class SecurityCertManagerAi {
  private certs = new Map<string, Certificate>()
  private auditLog: AuditEntry[] = []

  registerCert(certId: string, domain: string, issuer: string, expiresAt: string): Certificate {
    const cert: Certificate = { certId, domain, issuer, expiresAt }
    this.certs.set(certId, cert)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_CERT',
      certId,
      details: { domain, issuer, expiresAt },
    })
    return cert
  }

  renewCert(certId: string, newExpiresAt: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const cert = this.certs.get(certId)
    if (!cert) throw new Error(`인증서를 찾을 수 없습니다: ${certId}`)
    cert.expiresAt = newExpiresAt
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RENEW_CERT',
      certId,
      details: { newExpiresAt },
    })
  }

  getExpiringCerts(thresholdDays: number): Certificate[] {
    const now = Date.now()
    return Array.from(this.certs.values()).filter((cert) => {
      const expiry = new Date(cert.expiresAt).getTime()
      const daysLeft = (expiry - now) / MS_PER_DAY
      return daysLeft >= 0 && daysLeft <= thresholdDays
    })
  }

  getCertStatus(certId: string): CertStatus {
    const cert = this.certs.get(certId)
    if (!cert) throw new Error(`인증서를 찾을 수 없습니다: ${certId}`)
    const now = Date.now()
    const expiry = new Date(cert.expiresAt).getTime()
    const daysLeft = (expiry - now) / MS_PER_DAY
    if (daysLeft < 0) return 'expired'
    if (daysLeft <= 30) return 'expiring'
    return 'valid'
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
