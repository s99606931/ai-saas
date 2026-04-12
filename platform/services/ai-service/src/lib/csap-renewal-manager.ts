/**
 * CSAP Renewal Manager — SVC-AI-ADV-R137 (트랙 B 2차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R130-R137-trackB/SVC-AI-ADV-R137.design.md
 * Plan SC: FR-R137.1 ~ FR-R137.6
 *
 * CSAP 인증 갱신 일정 관리 + 준비 체크리스트 자동화.
 * 순수 계산 — 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export type CsapGrade = 'BASIC' | 'STANDARD' | 'HIGH'

export interface Renewal {
  renewalId: string
  systemName: string
  expiryDate: string
  grade: CsapGrade
}

export interface CheckItem {
  itemId: string
  renewalId: string
  description: string
  category: string
  done: boolean
}

export interface RenewalProgress {
  renewalId: string
  systemName: string
  totalItems: number
  doneItems: number
  completionRate: number
  daysUntilExpiry: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  renewalId: string
  detail: Record<string, unknown>
}

// Design Ref: §3.1 체크리스트 — grade별 표준 항목
const CHECKLIST_TEMPLATES: Record<CsapGrade, Array<{ description: string; category: string }>> = {
  BASIC: [
    { description: '정보보호 정책 최신화', category: '문서' },
    { description: '관리자 계정 접근 권한 검토', category: '접근통제' },
    { description: '취약점 스캔 결과 확인', category: '보안' },
    { description: '백업 및 복구 테스트', category: '운영' },
    { description: '인증서 유효기간 확인', category: '암호화' },
    { description: '소프트웨어 패치 적용 현황', category: '보안' },
    { description: '네트워크 접근 통제 정책 검토', category: '접근통제' },
    { description: '사용자 계정 생명주기 검토', category: '접근통제' },
    { description: '감사 로그 보존 현황 확인', category: '감사' },
    { description: '이전 심사 지적사항 조치 완료', category: '이행' },
  ],
  STANDARD: [
    { description: '정보보호 정책 최신화', category: '문서' },
    { description: '관리자 계정 접근 권한 검토', category: '접근통제' },
    { description: '취약점 스캔 결과 확인', category: '보안' },
    { description: '백업 및 복구 테스트', category: '운영' },
    { description: '인증서 유효기간 확인', category: '암호화' },
    { description: 'RBAC 정책 검토', category: '접근통제' },
    { description: '침입 탐지 시스템 점검', category: '보안' },
    { description: '암호화 알고리즘 검토', category: '암호화' },
    { description: '개인정보 처리방침 최신화', category: '문서' },
    { description: '위험 평가 보고서 작성', category: '위험관리' },
    { description: '모의 침투 테스트 수행', category: '보안' },
    { description: '소프트웨어 패치 적용 현황', category: '보안' },
    { description: '내부 감사 수행', category: '감사' },
    { description: '직원 보안 교육 이수 현황', category: '교육' },
    { description: '제3자 공급망 보안 검토', category: '공급망' },
    { description: '사고 대응 절차 최신화', category: '사고대응' },
    { description: '감사 로그 보존 현황 확인', category: '감사' },
    { description: '비밀번호 정책 검토', category: '접근통제' },
    { description: '데이터 분류 체계 검토', category: '데이터관리' },
    { description: '이전 심사 지적사항 조치 완료', category: '이행' },
  ],
  HIGH: [],
}

// HIGH는 STANDARD + 10개 추가
const HIGH_EXTRA = [
  { description: 'AI 모델 편향성 점검', category: 'AI윤리' },
  { description: 'N2SF 데이터 등급 분류 검토', category: 'N2SF' },
  { description: '제로트러스트 아키텍처 검토', category: '아키텍처' },
  { description: 'SIEM 이상 탐지 규칙 최신화', category: '보안' },
  { description: '클라우드 보안 설정 점검', category: '클라우드' },
  { description: '공급망 소프트웨어 구성 분석', category: '공급망' },
  { description: '사용자 행위 분석 시스템 점검', category: '보안' },
  { description: '재해 복구 훈련 수행', category: '운영' },
  { description: '국제 표준(ISO 27001) 갭 분석', category: '표준' },
  { description: '최고 보안 책임자 보고 완료', category: '거버넌스' },
]
CHECKLIST_TEMPLATES.HIGH = [...CHECKLIST_TEMPLATES.STANDARD, ...HIGH_EXTRA]

let itemCounter = 0

export class CsapRenewalManager {
  private readonly renewals = new Map<string, Renewal>()
  private readonly checklists = new Map<string, CheckItem[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R137.1
  registerRenewal(renewal: Renewal): void {
    this.renewals.set(renewal.renewalId, { ...renewal })
    this.appendAudit('renewal.register', renewal.renewalId, { grade: renewal.grade })
  }

  // Plan SC: FR-R137.2 — Design Ref: §3.1 grade별 체크리스트 생성
  generateChecklist(renewalId: string): CheckItem[] {
    const renewal = this.renewals.get(renewalId)
    if (!renewal) throw new Error(`Unknown renewal: ${renewalId}`)

    const templates = CHECKLIST_TEMPLATES[renewal.grade]
    const items: CheckItem[] = templates.map((t) => ({
      itemId: `chk-${renewalId}-${++itemCounter}`,
      renewalId,
      description: t.description,
      category: t.category,
      done: false,
    }))
    this.checklists.set(renewalId, items)
    this.appendAudit('checklist.generate', renewalId, { count: items.length })
    return items
  }

  // Plan SC: FR-R137.3
  updateCheckItem(renewalId: string, itemId: string, done: boolean): CheckItem {
    const items = this.checklists.get(renewalId)
    if (!items) throw new Error(`No checklist for renewal: ${renewalId}`)
    const item = items.find((i) => i.itemId === itemId)
    if (!item) throw new Error(`Unknown check item: ${itemId}`)
    item.done = done
    this.appendAudit('checkitem.update', renewalId, { itemId, done })
    return { ...item }
  }

  // Plan SC: FR-R137.4 — Design Ref: §3.2 D-day 계산
  getProgress(renewalId: string, now: Date = new Date()): RenewalProgress {
    const renewal = this.renewals.get(renewalId)
    if (!renewal) throw new Error(`Unknown renewal: ${renewalId}`)

    const items = this.checklists.get(renewalId) ?? []
    const totalItems = items.length
    const doneItems = items.filter((i) => i.done).length
    const completionRate = totalItems > 0 ? doneItems / totalItems : 0
    const expiryTs = Date.parse(renewal.expiryDate)
    const daysUntilExpiry = Math.floor((expiryTs - now.getTime()) / 86400000)

    return {
      renewalId,
      systemName: renewal.systemName,
      totalItems,
      doneItems,
      completionRate,
      daysUntilExpiry,
    }
  }

  // Plan SC: FR-R137.5 — Design Ref: §3.3 임박 알림
  getDueAlerts(withinDays: number, now: Date = new Date()): Renewal[] {
    const alerts: Renewal[] = []
    for (const renewal of this.renewals.values()) {
      const expiryTs = Date.parse(renewal.expiryDate)
      const daysLeft = Math.floor((expiryTs - now.getTime()) / 86400000)
      if (daysLeft >= 0 && daysLeft <= withinDays) {
        alerts.push(renewal)
      }
    }
    return alerts.sort((a, b) => Date.parse(a.expiryDate) - Date.parse(b.expiryDate))
  }

  // Plan SC: FR-R137.6 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(
    action: string,
    renewalId: string,
    detail: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      renewalId,
      detail,
    })
  }
}
