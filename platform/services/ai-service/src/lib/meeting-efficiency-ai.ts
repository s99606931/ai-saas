/**
 * Meeting Efficiency AI — SVC-AI-ADV-R134 (트랙 B 2차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R130-R137-trackB/SVC-AI-ADV-R134.design.md
 * Plan SC: FR-R134.1 ~ FR-R134.5
 *
 * 회의록 분석 → 액션 아이템 추출 + 담당자 배정 + 후속 추적.
 * 패턴 기반 추출 — 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export type ActionStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'

export interface ActionItem {
  actionId: string
  meetingId: string
  description: string
  owner: string | null
  dueDate: string | null
  status: ActionStatus
  extractedAt: string
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail: Record<string, unknown>
}

// Design Ref: §3.1 액션 아이템 탐지 패턴
const KO_ACTION_PATTERN =
  /(?:담당|조치|처리|완료|확인|검토|준비|제출|보고|수행)\s*[:：]?\s*(.+?)(?=\n|$)/gi
const EN_ACTION_PATTERN =
  /(?:action|todo|follow[\s-]?up|assign|complete|review|prepare|submit)\s*[:：]?\s*(.+?)(?=\n|$)/gi

// Design Ref: §3.2 마감일 파싱 패턴
const DATE_PATTERN = /(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|\d{1,2}월\s*\d{1,2}일)/

let actionCounter = 0

export class MeetingEfficiencyAi {
  private readonly actions = new Map<string, ActionItem>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R134.1 — Design Ref: §3.1 패턴 기반 추출
  parseMeetingMinutes(text: string, meetingId: string): ActionItem[] {
    const extracted: ActionItem[] = []
    const seen = new Set<string>()

    const addItem = (description: string): void => {
      const trimmed = description.trim()
      if (!trimmed || seen.has(trimmed)) return
      seen.add(trimmed)

      const dueDateMatch = trimmed.match(DATE_PATTERN)
      const actionId = `action-${++actionCounter}`
      const item: ActionItem = {
        actionId,
        meetingId,
        description: trimmed,
        owner: null,
        dueDate: dueDateMatch ? this.normalizeDate(dueDateMatch[0]) : null,
        status: 'PENDING',
        extractedAt: new Date().toISOString(),
      }
      this.actions.set(actionId, item)
      extracted.push(item)
    }

    let match: RegExpExecArray | null
    KO_ACTION_PATTERN.lastIndex = 0
    while ((match = KO_ACTION_PATTERN.exec(text)) !== null) {
      if (match[1]) addItem(match[1])
    }
    EN_ACTION_PATTERN.lastIndex = 0
    while ((match = EN_ACTION_PATTERN.exec(text)) !== null) {
      if (match[1]) addItem(match[1])
    }

    this.appendAudit('minutes.parse', { meetingId, extracted: extracted.length })
    return extracted
  }

  // Plan SC: FR-R134.2
  assignOwner(actionId: string, owner: string): ActionItem {
    const item = this.actions.get(actionId)
    if (!item) throw new Error(`Unknown action: ${actionId}`)
    item.owner = owner
    this.appendAudit('action.assign', { actionId, owner })
    return { ...item }
  }

  // Plan SC: FR-R134.3
  updateStatus(actionId: string, status: ActionStatus): ActionItem {
    const item = this.actions.get(actionId)
    if (!item) throw new Error(`Unknown action: ${actionId}`)
    item.status = status
    this.appendAudit('action.status', { actionId, status })
    return { ...item }
  }

  // Plan SC: FR-R134.4
  getPendingActions(dueBy?: string): ActionItem[] {
    const pending = [...this.actions.values()].filter(
      (a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS',
    )
    if (!dueBy) return pending
    return pending.filter(
      (a) => a.dueDate !== null && a.dueDate <= dueBy,
    )
  }

  // Plan SC: FR-R134.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private normalizeDate(raw: string): string {
    // ISO format 그대로
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    // M/D → 현재 연도 기준
    const slash = raw.match(/^(\d{1,2})\/(\d{1,2})$/)
    if (slash) {
      const year = new Date().getFullYear()
      const m = slash[1]!.padStart(2, '0')
      const d = slash[2]!.padStart(2, '0')
      return `${year}-${m}-${d}`
    }
    // N월 M일
    const korean = raw.match(/^(\d{1,2})월\s*(\d{1,2})일$/)
    if (korean) {
      const year = new Date().getFullYear()
      const m = korean[1]!.padStart(2, '0')
      const d = korean[2]!.padStart(2, '0')
      return `${year}-${m}-${d}`
    }
    return raw
  }

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail })
  }
}
