/**
 * AI 기반 ISMS-P 자동 준수 관리 — SVC-AI-ADV-R145
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R145/SVC-AI-ADV-R145.plan.md
 * Plan SC: FR-R145.1 ~ FR-R145.7
 *
 * ISMS-P 101항목 실시간 준수 상태 모니터링 + 갱신 자동화.
 * CSAP D-06 감사 로그, N2SF N-05 등급 guard 적용.
 */

export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export type IsmspDomain =
  | '관리체계수립및운영'
  | '보호대책요구사항'
  | '개인정보처리단계별보호조치'

export type ComplianceStatus = 'compliant' | 'partial' | 'non-compliant' | 'not-applicable'

export interface IsmspControl {
  id: string            // e.g. "1.1.1"
  domain: IsmspDomain
  title: string
  required: boolean
}

export interface ControlEvidence {
  controlId: string
  description: string
  filePath: string
  reviewedAt: string
  grade: DataGrade
  expiresAt?: string  // for time-limited evidence (e.g. 1 year)
}

export interface ControlState {
  controlId: string
  status: ComplianceStatus
  evidence: ControlEvidence[]
  lastReviewedAt?: string
  nextReviewDue?: string
}

export interface IsmspSummary {
  generatedAt: string
  totalControls: number
  compliant: number
  partial: number
  nonCompliant: number
  notApplicable: number
  overallPercent: number
  expiringSoon: Array<{ controlId: string; expiresAt: string }>
  criticalGaps: string[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  detail?: Record<string, unknown>
}

// Plan SC: FR-R145.1 — ISMS-P 101 controls (sample set, representative)
const ISMS_P_CONTROLS: IsmspControl[] = [
  { id: '1.1.1', domain: '관리체계수립및운영', title: '경영진의 참여', required: true },
  { id: '1.1.2', domain: '관리체계수립및운영', title: '최고책임자의 지정', required: true },
  { id: '1.2.1', domain: '관리체계수립및운영', title: '정보보호 정책의 수립', required: true },
  { id: '1.2.2', domain: '관리체계수립및운영', title: '현황 및 흐름도 작성', required: true },
  { id: '1.3.1', domain: '관리체계수립및운영', title: '보호대책 구현', required: true },
  { id: '1.4.1', domain: '관리체계수립및운영', title: '법적 요구사항 준수 검토', required: true },
  { id: '2.1.1', domain: '보호대책요구사항', title: '정책의 유지관리', required: true },
  { id: '2.2.1', domain: '보호대책요구사항', title: '주요 직무자 지정 및 관리', required: true },
  { id: '2.3.1', domain: '보호대책요구사항', title: '외부자 보안', required: true },
  { id: '2.4.1', domain: '보호대책요구사항', title: '정보자산 식별', required: true },
  { id: '2.5.1', domain: '보호대책요구사항', title: '사용자 계정 관리', required: true },
  { id: '2.6.1', domain: '보호대책요구사항', title: '접근통제 정책 수립', required: true },
  { id: '2.7.1', domain: '보호대책요구사항', title: '암호화 적용', required: true },
  { id: '2.8.1', domain: '보호대책요구사항', title: '정보시스템 도입 및 개발 보안', required: true },
  { id: '2.9.1', domain: '보호대책요구사항', title: '변경관리', required: true },
  { id: '2.10.1', domain: '보호대책요구사항', title: '취약점 점검 및 조치', required: true },
  { id: '2.11.1', domain: '보호대책요구사항', title: '사고 예방 및 대응', required: true },
  { id: '2.12.1', domain: '보호대책요구사항', title: '재해복구 시험', required: true },
  { id: '3.1.1', domain: '개인정보처리단계별보호조치', title: '개인정보 수집 시 보호조치', required: true },
  { id: '3.2.1', domain: '개인정보처리단계별보호조치', title: '개인정보 보유 및 이용 시 보호조치', required: true },
  { id: '3.3.1', domain: '개인정보처리단계별보호조치', title: '개인정보 제공 시 보호조치', required: true },
  { id: '3.4.1', domain: '개인정보처리단계별보호조치', title: '개인정보 파기 시 보호조치', required: true },
  { id: '3.5.1', domain: '개인정보처리단계별보호조치', title: '정보주체의 권리 보장', required: true },
]

export class IsmsPComplianceAi {
  private readonly states = new Map<string, ControlState>()
  private readonly auditLog: AuditEntry[] = []

  getAuditLog(): readonly AuditEntry[] { return this.auditLog }

  private audit(action: string, detail?: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, ...(detail !== undefined ? { detail } : {}) })
  }

  listControls(): IsmspControl[] {
    return [...ISMS_P_CONTROLS]
  }

  // Plan SC: FR-R145.2
  updateControlStatus(controlId: string, status: ComplianceStatus, notes?: string): void {
    const control = ISMS_P_CONTROLS.find(c => c.id === controlId)
    if (!control) throw new Error(`unknown ISMS-P control: ${controlId}`)
    const existing = this.states.get(controlId) ?? { controlId, status, evidence: [] }
    existing.status = status
    existing.lastReviewedAt = new Date().toISOString()
    // Next review: required controls every 1 year, others every 2 years
    const nextYears = control.required ? 1 : 2
    const next = new Date()
    next.setFullYear(next.getFullYear() + nextYears)
    existing.nextReviewDue = next.toISOString()
    if (notes) existing.lastReviewedAt = new Date().toISOString()
    this.states.set(controlId, existing)
    this.audit('updateControlStatus', { controlId, status })
  }

  // Plan SC: FR-R145.3
  addEvidence(evidence: ControlEvidence): void {
    if (evidence.grade === DataGrade.C || evidence.grade === DataGrade.S) {
      throw new Error(`BLOCKED: ${evidence.grade}등급 증적 등록 금지 (N2SF N-05)`)
    }
    const control = ISMS_P_CONTROLS.find(c => c.id === evidence.controlId)
    if (!control) throw new Error(`unknown ISMS-P control: ${evidence.controlId}`)
    const state = this.states.get(evidence.controlId) ?? { controlId: evidence.controlId, status: 'partial', evidence: [] }
    state.evidence.push(evidence)
    this.states.set(evidence.controlId, state)
    this.audit('addEvidence', { controlId: evidence.controlId })
  }

  // Plan SC: FR-R145.4 — detect soon-expiring evidence (within 90 days)
  private expiringEvidence(now: Date): Array<{ controlId: string; expiresAt: string }> {
    const threshold = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    const result: Array<{ controlId: string; expiresAt: string }> = []
    for (const state of this.states.values()) {
      for (const ev of state.evidence) {
        if (ev.expiresAt && new Date(ev.expiresAt) <= threshold) {
          result.push({ controlId: state.controlId, expiresAt: ev.expiresAt })
        }
      }
    }
    return result
  }

  // Plan SC: FR-R145.5, FR-R145.6, FR-R145.7
  generateSummary(now: Date = new Date()): IsmspSummary {
    const total = ISMS_P_CONTROLS.length
    let compliant = 0; let partial = 0; let nonCompliant = 0; let notApplicable = 0

    const criticalGaps: string[] = []
    for (const ctrl of ISMS_P_CONTROLS) {
      const state = this.states.get(ctrl.id)
      const status = state?.status ?? 'non-compliant'
      if (status === 'compliant') compliant++
      else if (status === 'partial') partial++
      else if (status === 'non-compliant') { nonCompliant++; if (ctrl.required) criticalGaps.push(ctrl.id) }
      else if (status === 'not-applicable') notApplicable++
    }

    const applicable = total - notApplicable
    const overallPercent = applicable > 0
      ? Math.round(((compliant + partial * 0.5) / applicable) * 100)
      : 100

    const expiringSoon = this.expiringEvidence(now)
    this.audit('generateSummary', { overallPercent, criticalGaps: criticalGaps.length })
    return { generatedAt: now.toISOString(), totalControls: total, compliant, partial, nonCompliant, notApplicable, overallPercent, expiringSoon, criticalGaps }
  }
}
