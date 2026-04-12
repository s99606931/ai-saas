/**
 * Meeting Minutes Structurer — SVC-AI-ADV-R194 (트랙 B 5차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R194/SVC-AI-ADV-R194.design.md
 * Plan SC: FR-R194.1 ~ FR-R194.5
 *
 * 회의록 원문 → 참석자/의제/결정사항/액션아이템 구조화. N2SF N-05.
 */

export type DataGrade = 'C' | 'S' | 'O'

export interface MeetingMinutes {
  meetingId: string
  title: string
  rawText: string
  date: string
  grade?: DataGrade
}

export interface ActionItem {
  assignee: string
  task: string
  dueDate?: string
}

export interface StructuredMeeting {
  meetingId: string
  title: string
  date: string
  attendees: string[]
  agendaItems: string[]
  decisions: string[]
  actionItems: ActionItem[]
  summary: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  meetingId: string
  detail: Record<string, unknown>
}

export class MeetingMinutesStructurer {
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R194.2 + FR-R194.3 + FR-R194.4
  structure(minutes: MeetingMinutes): StructuredMeeting {
    if (minutes.grade === 'C' || minutes.grade === 'S') {
      throw new Error(`BLOCKED: ${minutes.grade}등급 회의록 처리 금지 (N2SF N-05)`)
    }

    const lines = minutes.rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)

    // 참석자 추출
    const attendees: string[] = []
    for (const line of lines) {
      if (/참석자?\s*[:：]/.test(line)) {
        const part = line.replace(/참석자?\s*[:：]/, '').trim()
        attendees.push(...part.split(/[,，\s]+/).map((s) => s.trim()).filter((s) => s.length > 0))
      }
    }

    // 의제 추출
    const agendaItems = lines.filter((l) => /의제|안건/.test(l) && !/참석|결정|담당|조치/.test(l))

    // 결정사항 추출
    const decisions = lines.filter((l) => /결정|의결|승인|합의/.test(l))

    // 액션아이템 추출 — Design Ref: §알고리즘
    const actionItems: ActionItem[] = []
    const actionPattern = /담당|조치|완료|처리/
    for (const line of lines) {
      if (actionPattern.test(line)) {
        // ISO 날짜 패턴 추출
        const dateMatch = line.match(/\d{4}-\d{2}-\d{2}/)
        actionItems.push({ assignee: '담당자 미상', task: line, dueDate: dateMatch?.[0] })
      }
    }

    const summary = `총 ${lines.length}개 항목. 참석자 ${attendees.length}명, 의제 ${agendaItems.length}건, 결정사항 ${decisions.length}건, 액션아이템 ${actionItems.length}건.`

    this.appendAudit('minutes.structure', minutes.meetingId, {
      attendees: attendees.length, agendaItems: agendaItems.length, decisions: decisions.length, actionItems: actionItems.length,
    })
    return { meetingId: minutes.meetingId, title: minutes.title, date: minutes.date, attendees, agendaItems, decisions, actionItems, summary }
  }

  // Plan SC: FR-R194.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, meetingId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, meetingId, detail })
  }
}
