// Design Ref: §핵심 알고리즘 — 긴급도 점수, PII 마스킹
// Plan SC: SVC-AI-ADV-R410
import { createHash } from 'node:crypto'
export type DataGrade = 'O' | 'C' | 'S'

const URGENT_KEYWORDS = ['긴급', '위험', '사망', '화재', '사고']

export interface ComplaintEntry {
  id: string
  content: string
  maskedSubmitterId: string
  urgencyScore: number
  completed: boolean
  timestamp: string
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

function maskId(id: string): string {
  return createHash('sha256').update(id).digest('hex').substring(0, 16)
}

function calcUrgencyScore(content: string): number {
  const matchCount = URGENT_KEYWORDS.filter((kw) => content.includes(kw)).length
  return Math.min(100, 10 + matchCount * 30)
}

export class ComplaintPriorityClassifierV3 {
  private complaints = new Map<string, ComplaintEntry>()
  private auditLog: AuditEntry[] = []

  submitComplaint(id: string, content: string, submitterId: string, grade: DataGrade = 'O'): ComplaintEntry {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 민원 데이터 전송 금지 (N2SF N-05)`)
    }
    if (!id || !content || !submitterId) throw new Error('id, content, submitterId는 필수')
    const entry: ComplaintEntry = {
      id,
      content,
      maskedSubmitterId: maskId(submitterId),
      urgencyScore: calcUrgencyScore(content),
      completed: false,
      timestamp: new Date().toISOString(),
    }
    this.complaints.set(id, entry)
    this.auditLog.push({ action: 'complaint.submit', timestamp: new Date().toISOString(), detail: `${maskId(submitterId)}:score=${entry.urgencyScore}` })
    return entry
  }

  getPriorityQueue(): ComplaintEntry[] {
    return [...this.complaints.values()]
      .filter((c) => !c.completed)
      .sort((a, b) => b.urgencyScore - a.urgencyScore)
  }

  markCompleted(complaintId: string): void {
    const complaint = this.complaints.get(complaintId)
    if (!complaint) throw new Error(`complaintId 없음: ${complaintId}`)
    complaint.completed = true
    this.auditLog.push({ action: 'complaint.complete', timestamp: new Date().toISOString(), detail: complaintId })
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
