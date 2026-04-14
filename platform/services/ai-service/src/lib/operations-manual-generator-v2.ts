// Design Ref: §클래스 설계 — OperationsManualGeneratorV2
// Plan SC: SVC-AI-ADV-R496

import { createHash } from 'crypto'

interface ManualSection {
  sectionId: string
  title: string
  content: string
  category: string
}

interface AuditEntry {
  timestamp: string
  action: string
  sectionId: string
  maskedSectionId?: string
  details?: Record<string, unknown>
}

export class OperationsManualGeneratorV2 {
  private sections = new Map<string, ManualSection>()
  private auditLog: AuditEntry[] = []

  addSection(sectionId: string, title: string, content: string, category: string): ManualSection {
    const section: ManualSection = { sectionId, title, content, category }
    this.sections.set(sectionId, section)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ADD_SECTION',
      sectionId,
      details: { title, category },
    })
    return section
  }

  updateSection(sectionId: string, newContent: string, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    }
    const section = this.sections.get(sectionId)
    if (!section) throw new Error(`섹션을 찾을 수 없습니다: ${sectionId}`)
    section.content = newContent
    const maskedSectionId = createHash('sha256').update(sectionId).digest('hex').substring(0, 16)
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'UPDATE_SECTION',
      sectionId,
      maskedSectionId,
      details: { contentLength: newContent.length },
    })
  }

  getTableOfContents(): { sectionId: string; title: string; category: string }[] {
    return Array.from(this.sections.values()).map(({ sectionId, title, category }) => ({
      sectionId,
      title,
      category,
    }))
  }

  getSectionsByCategory(category: string): ManualSection[] {
    return Array.from(this.sections.values()).filter((s) => s.category === category)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
