// Design Ref: §R195 — AI기반 민원 우선순위 자동 분류 v2
// Plan SC: SVC-AI-ADV-R195-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type Priority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'
export type Channel = 'ONLINE' | 'PHONE' | 'VISIT' | 'FAX'

export interface ComplaintV2 {
  complaintId: string
  title: string
  body: string
  channel: Channel
  submittedAt: string
  grade?: DataGrade
  isRepeat?: boolean
  daysWaiting?: number
}

export interface ClassificationResultV2 {
  complaintId: string
  priority: Priority
  priorityScore: number
  urgencySignals: string[]
  estimatedResponseHours: number
  assignedQueue: string
}

interface AuditEntry {
  timestamp: string
  action: string
  complaintId: string
  detail: Record<string, unknown>
}

const CRITICAL_TERMS = ['사망', '생명', '위험', '화재', '폭발', '긴급', '응급']
const HIGH_TERMS = ['부패', '비리', '불법', '위법', '즉시', '당장']
const REPEAT_BONUS = 15
const CHANNEL_SCORE: Record<Channel, number> = {
  VISIT: 10,
  PHONE: 8,
  ONLINE: 5,
  FAX: 3,
}

export class ComplaintPriorityClassifierV2 {
  private auditLog: AuditEntry[] = []

  classify(complaint: ComplaintV2): ClassificationResultV2 {
    // N2SF: C/S 등급 데이터 처리 차단
    if (complaint.grade === 'C' || complaint.grade === 'S') {
      throw new Error(`BLOCKED: ${complaint.grade}등급 민원은 AI 분류 금지 (N2SF N-05)`)
    }

    const text = `${complaint.title} ${complaint.body}`.toLowerCase()
    const urgencySignals: string[] = []
    let score = 0

    // 채널 점수
    score += CHANNEL_SCORE[complaint.channel]

    // 긴급 키워드
    for (const term of CRITICAL_TERMS) {
      if (text.includes(term)) {
        urgencySignals.push(`긴급키워드:${term}`)
        score += 30
      }
    }

    // 고위험 키워드
    for (const term of HIGH_TERMS) {
      if (text.includes(term)) {
        urgencySignals.push(`위험키워드:${term}`)
        score += 15
      }
    }

    // 반복 민원
    if (complaint.isRepeat) {
      urgencySignals.push('반복민원')
      score += REPEAT_BONUS
    }

    // 대기일수 보정
    const daysWaiting = complaint.daysWaiting ?? 0
    if (daysWaiting >= 30) {
      urgencySignals.push(`장기대기:${daysWaiting}일`)
      score += 20
    } else if (daysWaiting >= 14) {
      urgencySignals.push(`대기:${daysWaiting}일`)
      score += 10
    }

    const priority: Priority = score >= 60 ? 'CRITICAL' : score >= 35 ? 'HIGH' : score >= 15 ? 'NORMAL' : 'LOW'

    const estimatedResponseHours = priority === 'CRITICAL' ? 2 : priority === 'HIGH' ? 24 : priority === 'NORMAL' ? 72 : 168
    const assignedQueue = `QUEUE-${priority}`

    this.appendAudit('classify', complaint.complaintId, { priority, score })

    return {
      complaintId: complaint.complaintId,
      priority,
      priorityScore: score,
      urgencySignals,
      estimatedResponseHours,
      assignedQueue,
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, complaintId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, complaintId, detail })
  }
}
