// Design Ref: §R305 — AI기반 공공기관 민원 패턴 분석
// Plan SC: SC-R305

import { createHash } from 'node:crypto'

export type DataGrade = 'O' | 'C' | 'S'

export interface ComplaintType {
  typeId: string
  name: string
  targetDays: number
}

export interface ComplaintRecord {
  maskedId: string
  processingDays: number
  recordedAt: number
}

export interface ComplaintTypeStats {
  typeId: string
  name: string
  count: number
  avgProcessingDays: number
  targetDays: number
  isDelayed: boolean
}

export interface DelayReport {
  typeId: string
  name: string
  avgProcessingDays: number
  targetDays: number
  exceedRatio: number
  suggestions: string[]
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function hashComplaintId(id: string): string {
  return createHash('sha256').update(id).digest('hex').substring(0, 16)
}

export class CitizenComplaintPatternAnalyzer {
  private types = new Map<string, ComplaintType>()
  private records = new Map<string, ComplaintRecord[]>()
  private auditLog: AuditEntry[] = []

  registerComplaintType(typeId: string, name: string, targetDays: number): void {
    if (!typeId || !name) throw new Error('typeId와 name은 필수')
    if (targetDays <= 0) throw new Error('targetDays는 양수여야 합니다')
    this.types.set(typeId, { typeId, name, targetDays })
    this.records.set(typeId, [])
    this.auditLog.push({ action: 'type.register', timestamp: new Date().toISOString(), detail: typeId })
  }

  recordComplaint(typeId: string, complaintId: string, processingDays: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 민원 데이터 기록 금지 (N2SF N-05)`)
    }
    if (!this.types.has(typeId)) throw new Error(`typeId 없음: ${typeId}`)
    if (processingDays < 0) throw new Error('processingDays는 0 이상')
    const masked = hashComplaintId(complaintId)
    this.records.get(typeId)!.push({ maskedId: masked, processingDays, recordedAt: Date.now() })
    this.auditLog.push({ action: 'complaint.record', timestamp: new Date().toISOString(), detail: `${typeId}:${masked}` })
  }

  getTypeStats(typeId: string): ComplaintTypeStats {
    const type = this.types.get(typeId)
    if (!type) throw new Error(`typeId 없음: ${typeId}`)
    const list = this.records.get(typeId) ?? []
    const count = list.length
    const avg = count === 0 ? 0 : list.reduce((a, r) => a + r.processingDays, 0) / count
    const isDelayed = avg > type.targetDays * 1.2
    return {
      typeId,
      name: type.name,
      count,
      avgProcessingDays: Math.round(avg * 100) / 100,
      targetDays: type.targetDays,
      isDelayed,
    }
  }

  getDelayedTypes(): DelayReport[] {
    const reports: DelayReport[] = []
    for (const type of this.types.values()) {
      const stats = this.getTypeStats(type.typeId)
      if (stats.isDelayed) {
        const suggestions: string[] = ['담당자 증원 검토', '처리 프로세스 자동화 검토']
        if (stats.avgProcessingDays > type.targetDays * 2) {
          suggestions.push('민원 분류 체계 재검토 필요')
        }
        reports.push({
          typeId: type.typeId,
          name: type.name,
          avgProcessingDays: stats.avgProcessingDays,
          targetDays: type.targetDays,
          exceedRatio: Math.round((stats.avgProcessingDays / type.targetDays) * 100) / 100,
          suggestions,
        })
      }
    }
    return reports
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
