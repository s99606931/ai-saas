// Design Ref: §클래스 설계 — PrivacyComplianceAutomatorV2
// Plan SC: SVC-AI-ADV-R473

import { createHash } from 'crypto'

type DataType = 'personal' | 'sensitive' | 'public'

interface PrivacyItem {
  itemId: string
  dataType: DataType
  purpose: string
  retentionDays: number
  consentRequired: boolean
}

interface ConsentRecord {
  itemId: string
  consentGiven: boolean
  timestamp: string
}

interface AuditEntry {
  timestamp: string
  action: string
  itemId: string
  maskedItemId?: string
  details?: Record<string, unknown>
}

export class PrivacyComplianceAutomatorV2 {
  private items = new Map<string, PrivacyItem>()
  private consentRecords: ConsentRecord[] = []
  private auditLog: AuditEntry[] = []

  registerItem(
    itemId: string,
    dataType: DataType,
    purpose: string,
    retentionDays: number,
    consentRequired: boolean
  ): PrivacyItem {
    const item: PrivacyItem = { itemId, dataType, purpose, retentionDays, consentRequired }
    this.items.set(itemId, item)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_ITEM',
      itemId,
      details: { dataType, purpose, retentionDays, consentRequired },
    })
    return item
  }

  recordConsent(itemId: string, consentGiven: boolean, dataGrade?: string): void {
    // N2SF N-05: C/S 등급 데이터 AI API 전송 금지
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }

    if (!this.items.has(itemId)) {
      throw new Error(`항목을 찾을 수 없습니다: ${itemId}`)
    }

    const record: ConsentRecord = {
      itemId,
      consentGiven,
      timestamp: new Date().toISOString(),
    }
    this.consentRecords.push(record)

    const maskedItemId = createHash('sha256').update(itemId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'RECORD_CONSENT',
      itemId,
      maskedItemId,
      details: { consentGiven },
    })
  }

  getComplianceRate(): number {
    const requiredItems = Array.from(this.items.values()).filter(
      (item) => item.consentRequired
    )
    if (requiredItems.length === 0) return 100

    let consentedCount = 0
    for (const item of requiredItems) {
      const itemRecords = this.consentRecords
        .filter((r) => r.itemId === item.itemId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      const latest = itemRecords[itemRecords.length - 1]
      if (latest && latest.consentGiven) {
        consentedCount++
      }
    }

    return (consentedCount / requiredItems.length) * 100
  }

  getNonConsentItems(): PrivacyItem[] {
    const requiredItems = Array.from(this.items.values()).filter(
      (item) => item.consentRequired
    )
    return requiredItems.filter((item) => {
      const itemRecords = this.consentRecords
        .filter((r) => r.itemId === item.itemId)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      const latest = itemRecords[itemRecords.length - 1]
      return !latest || !latest.consentGiven
    })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
