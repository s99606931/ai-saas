/**
 * Org Onboarding AI — SVC-AI-ADV-R153 (트랙 B 3차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R146-R153-trackB/SVC-AI-ADV-R153.design.md
 * Plan SC: FR-R153.1 ~ FR-R153.5
 *
 * 조직 유형별 온보딩 스텝 템플릿 → 완료 추적 → 진행률 계산.
 * 순수 계산 — 외부 API 없음.
 */

// Design Ref: §2 — 타입 정의

export type OrgType = 'central' | 'local' | 'public-institution'

export interface Org {
  orgId: string
  name: string
  type: OrgType
  size: number
}

export interface OnboardingStep {
  stepId: string
  orgId: string
  order: number
  title: string
  description: string
  category: string
  done: boolean
}

export interface OnboardingProgress {
  orgId: string
  totalSteps: number
  doneSteps: number
  completionRate: number
  nextStep: OnboardingStep | null
}

export interface AuditEntry {
  timestamp: string
  action: string
  orgId: string
  detail: Record<string, unknown>
}

// Design Ref: §3.1 공통 10개 스텝
const COMMON_STEPS: Array<{ order: number; title: string; description: string; category: string }> = [
  { order: 1, title: '관리자 계정 생성', description: '시스템 관리자 계정을 생성합니다', category: 'account' },
  { order: 2, title: '조직 정보 등록', description: '기관 기본 정보를 시스템에 등록합니다', category: 'profile' },
  { order: 3, title: 'CSAP 보안 정책 설정', description: 'CSAP 요건에 맞는 보안 정책을 적용합니다', category: 'security' },
  { order: 4, title: '사용자 권한 구조 설계', description: 'RBAC 기반 권한 체계를 설계합니다', category: 'iam' },
  { order: 5, title: '네트워크 분리 설정', description: 'N2SF 등급별 네트워크 분리를 구성합니다', category: 'network' },
  { order: 6, title: '감사 로그 설정', description: '모든 민감 작업 감사 로그 수집을 활성화합니다', category: 'audit' },
  { order: 7, title: '백업 정책 수립', description: '데이터 백업 주기 및 보존 정책을 설정합니다', category: 'backup' },
  { order: 8, title: '장애 대응 절차 수립', description: '시스템 장애 발생 시 대응 절차를 작성합니다', category: 'operation' },
  { order: 9, title: '사용자 교육', description: '시스템 사용법 및 보안 교육을 실시합니다', category: 'training' },
  { order: 10, title: '서비스 오픈 확인', description: '전체 항목 점검 후 서비스를 개시합니다', category: 'launch' },
]

// Design Ref: §3.1 central 전용 +5
const CENTRAL_STEPS: Array<{ order: number; title: string; description: string; category: string }> = [
  { order: 11, title: '전자정부 프레임워크 연동', description: '전자정부 표준 프레임워크와 연동을 구성합니다', category: 'integration' },
  { order: 12, title: '범정부 SSO 연동', description: '범정부 통합인증 시스템 연동을 설정합니다', category: 'sso' },
  { order: 13, title: '행안부 지침 준수 점검', description: '행안부 정보화사업 지침 준수 여부를 점검합니다', category: 'compliance' },
  { order: 14, title: '국가정보원 보안성 검토', description: '국가정보원 보안성 검토 서류를 준비합니다', category: 'security' },
  { order: 15, title: '개인정보보호법 준수 확인', description: '개인정보보호법 준수 체계를 최종 점검합니다', category: 'privacy' },
]

// Design Ref: §3.1 local 전용 +3
const LOCAL_STEPS: Array<{ order: number; title: string; description: string; category: string }> = [
  { order: 11, title: '지방재정 시스템 연동', description: '지방재정관리시스템 연동을 구성합니다', category: 'integration' },
  { order: 12, title: '주민 민원 채널 설정', description: '온라인 민원 접수 채널을 개설합니다', category: 'service' },
  { order: 13, title: '지역 특화 서비스 구성', description: '지역 특성에 맞는 서비스를 추가 구성합니다', category: 'service' },
]

export class OrgOnboardingAi {
  private readonly orgs = new Map<string, Org>()
  private readonly steps = new Map<string, OnboardingStep[]>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R153.1 — Design Ref: §3.1 스텝 템플릿 생성
  registerOrg(org: Org): void {
    this.orgs.set(org.orgId, { ...org })

    const baseSteps = COMMON_STEPS
    const extraSteps = org.type === 'central' ? CENTRAL_STEPS : org.type === 'local' ? LOCAL_STEPS : []
    const allStepDefs = [...baseSteps, ...extraSteps]

    const steps: OnboardingStep[] = allStepDefs.map((def) => ({
      stepId: `${org.orgId}-S${String(def.order).padStart(2, '0')}`,
      orgId: org.orgId,
      order: def.order,
      title: def.title,
      description: def.description,
      category: def.category,
      done: false,
    }))

    this.steps.set(org.orgId, steps)
    this.appendAudit('org.register', org.orgId, { type: org.type, totalSteps: steps.length })
  }

  // Plan SC: FR-R153.2 — 스텝 완료 처리
  completeStep(orgId: string, stepId: string): OnboardingStep {
    const steps = this.getSteps(orgId)
    const step = steps.find((s) => s.stepId === stepId)
    if (!step) throw new Error(`Unknown step: ${stepId}`)
    step.done = true
    this.appendAudit('step.complete', orgId, { stepId, order: step.order })
    return { ...step }
  }

  // Plan SC: FR-R153.3 — Design Ref: §3.2 다음 스텝 (done=false 중 order 최소)
  getProgress(orgId: string): OnboardingProgress {
    const steps = this.getSteps(orgId)
    const doneSteps = steps.filter((s) => s.done).length
    const totalSteps = steps.length
    const completionRate = totalSteps === 0 ? 0 : doneSteps / totalSteps

    const pending = steps.filter((s) => !s.done).sort((a, b) => a.order - b.order)
    const nextStep = pending.length > 0 ? { ...pending[0]! } : null

    this.appendAudit('progress.get', orgId, { doneSteps, totalSteps, completionRate })
    return { orgId, totalSteps, doneSteps, completionRate, nextStep }
  }

  // Plan SC: FR-R153.4 — 스텝 목록 조회
  listSteps(orgId: string): OnboardingStep[] {
    return this.getSteps(orgId).map((s) => ({ ...s }))
  }

  // Plan SC: FR-R153.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private getSteps(orgId: string): OnboardingStep[] {
    const steps = this.steps.get(orgId)
    if (!steps) throw new Error(`Unknown org: ${orgId}`)
    return steps
  }

  private appendAudit(action: string, orgId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, orgId, detail })
  }
}
