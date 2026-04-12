// Design Ref: §R274 — AI 감사 자동화 엔진
// Plan SC: SVC-AI-ADV-R274-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type Severity = 'LOW' | 'MED' | 'HIGH'
export type EvidenceStatus = 'PASS' | 'FAIL' | 'PENDING'

export interface ChecklistItem {
  itemId: string
  clause: string
  description: string
  severity: Severity
}

export interface Evidence {
  itemId: string
  content: string
  status: EvidenceStatus
  submittedAt: string
}

export interface AuditReport {
  totalItems: number
  passCount: number
  failCount: number
  pendingCount: number
  riskScore: number
  compliancePct: number
  failedItems: Array<{
    itemId: string
    clause: string
    severity: Severity
    description: string
  }>
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

export class AiAuditAutomation {
  private items = new Map<string, ChecklistItem>()
  private evidences = new Map<string, Evidence>()
  private auditLog: AuditEntry[] = []

  registerChecklist(items: ChecklistItem[], caller: string): void {
    if (items.length === 0) throw new Error('items 최소 1개 필요')
    for (const item of items) {
      if (!item.itemId) throw new Error('itemId 필수')
      if (this.items.has(item.itemId)) {
        throw new Error(`중복 itemId: ${item.itemId}`)
      }
      this.items.set(item.itemId, { ...item })
    }
    this.appendAudit('checklist.register', this.mask(caller), {
      count: items.length,
    })
  }

  submitEvidence(
    itemId: string,
    content: string,
    status: EvidenceStatus,
    grade: DataGrade,
    caller: string
  ): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 증적 등록 금지 (N2SF N-05)`)
    }
    if (!this.items.has(itemId)) {
      throw new Error(`itemId 없음: ${itemId}`)
    }
    if (!content.trim()) throw new Error('content 필수')
    this.evidences.set(itemId, {
      itemId,
      content: content.slice(0, 1000),
      status,
      submittedAt: new Date().toISOString(),
    })
    this.appendAudit('evidence.submit', this.mask(caller), {
      itemId,
      status,
    })
  }

  runAudit(caller: string): AuditReport {
    const total = this.items.size
    if (total === 0) throw new Error('체크리스트가 비어 있습니다')

    let passCount = 0
    let failCount = 0
    let pendingCount = 0
    let riskScore = 0
    const failedItems: AuditReport['failedItems'] = []

    for (const item of this.items.values()) {
      const ev = this.evidences.get(item.itemId)
      if (!ev) {
        pendingCount++
        continue
      }
      if (ev.status === 'PASS') {
        passCount++
      } else if (ev.status === 'FAIL') {
        failCount++
        riskScore += this.severityWeight(item.severity)
        failedItems.push({
          itemId: item.itemId,
          clause: item.clause,
          severity: item.severity,
          description: item.description,
        })
      } else {
        pendingCount++
      }
    }

    const compliancePct = Math.round((passCount / total) * 100)

    const report: AuditReport = {
      totalItems: total,
      passCount,
      failCount,
      pendingCount,
      riskScore,
      compliancePct,
      failedItems,
    }

    this.appendAudit('audit.run', this.mask(caller), {
      total,
      compliancePct,
      riskScore,
    })
    return report
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private severityWeight(sev: Severity): number {
    switch (sev) {
      case 'HIGH':
        return 5
      case 'MED':
        return 3
      case 'LOW':
        return 1
    }
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(
    action: string,
    callerMasked: string,
    detail: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
