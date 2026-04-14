// Design Ref: §설계결정 — AI기반 민원인 데이터 프라이버시 보호 v2
// Plan SC: FR-R630.1~5

import { createHash } from 'crypto'

interface PiiField { name: string; category: 'name' | 'ssn' | 'phone' | 'address' | 'email' | 'other' }
interface MaskStat { field: string; count: number }
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

export class CitizenDataPrivacyGuardianV2 {
  private piiFields = new Map<string, PiiField>()
  private maskCounts = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerPiiField(name: string, category: PiiField['category']): void {
    this.piiFields.set(name, { name, category })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_PII', details: { name, category } })
  }

  maskValue(field: string, value: string, dataGrade?: string): string {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`)
    }
    if (!this.piiFields.has(field)) {
      throw new Error('FIELD_NOT_REGISTERED')
    }
    const hash = createHash('sha256').update(value).digest('hex').substring(0, 16)
    this.maskCounts.set(field, (this.maskCounts.get(field) ?? 0) + 1)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'MASK_VALUE', details: { field } })
    return hash
  }

  getStats(): MaskStat[] {
    return Array.from(this.maskCounts.entries()).map(([field, count]) => ({ field, count }))
  }

  listFields(): PiiField[] {
    return Array.from(this.piiFields.values())
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
