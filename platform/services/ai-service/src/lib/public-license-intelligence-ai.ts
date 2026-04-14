// Design Ref: §완비율 공식 — PublicLicenseIntelligenceAi
// Plan SC: SVC-AI-ADV-R503

import { createHash } from 'crypto'

interface LicenseItem {
  licenseId: string
  name: string
  requiredDocuments: string[]
  processingDays: number
}

interface ApplicationRecord {
  licenseId: string
  applicantId: string
  submittedDocuments: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  licenseId: string
  maskedApplicantId?: string
  details?: Record<string, unknown>
}

export class PublicLicenseIntelligenceAi {
  private licenses = new Map<string, LicenseItem>()
  private applications = new Map<string, ApplicationRecord>()
  private auditLog: AuditEntry[] = []

  registerLicense(
    licenseId: string,
    name: string,
    requiredDocuments: string[],
    processingDays: number
  ): LicenseItem {
    const license: LicenseItem = { licenseId, name, requiredDocuments, processingDays }
    this.licenses.set(licenseId, license)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_LICENSE',
      licenseId,
      details: { name, requiredDocuments, processingDays },
    })
    return license
  }

  submitApplication(
    licenseId: string,
    applicantId: string,
    submittedDocuments: string[],
    dataGrade?: string
  ): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.licenses.has(licenseId)) throw new Error(`인허가를 찾을 수 없습니다: ${licenseId}`)
    this.applications.set(licenseId, { licenseId, applicantId, submittedDocuments })
    const maskedApplicantId = createHash('sha256').update(applicantId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'SUBMIT_APPLICATION',
      licenseId,
      maskedApplicantId,
      details: { submittedCount: submittedDocuments.length },
    })
  }

  getCompletionRate(licenseId: string): number {
    const license = this.licenses.get(licenseId)
    if (!license) throw new Error(`인허가를 찾을 수 없습니다: ${licenseId}`)
    if (license.requiredDocuments.length === 0) return 100
    const application = this.applications.get(licenseId)
    if (!application) return 0
    const matched = application.submittedDocuments.filter((d) =>
      license.requiredDocuments.includes(d)
    ).length
    return (matched / license.requiredDocuments.length) * 100
  }

  getMissingDocuments(licenseId: string): string[] {
    const license = this.licenses.get(licenseId)
    if (!license) throw new Error(`인허가를 찾을 수 없습니다: ${licenseId}`)
    const application = this.applications.get(licenseId)
    if (!application) return [...license.requiredDocuments]
    return license.requiredDocuments.filter(
      (d) => !application.submittedDocuments.includes(d)
    )
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
