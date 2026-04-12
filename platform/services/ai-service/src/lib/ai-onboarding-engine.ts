/**
 * AI Onboarding Engine — SVC-AI-ADV-R98
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R98.design.md
 * Plan SC: FR-R98.1 ~ FR-R98.5
 *
 * 공공 포털 신규 사용자를 위한 역할별 맞춤 튜토리얼 엔진.
 * CSAP D-06 감사 로그 소급 적용 (2026-04-12 세션 #139).
 */

export interface OnboardingAuditEntry {
  timestamp: string
  action:
    | 'registerTemplate'
    | 'startOnboarding'
    | 'completeStep'
    | 'getNextStep'
    | 'progressReport'
  detail?: Record<string, unknown>
}

export interface OnboardingStep {
  id: string
  title: string
  description: string
  order: number
  required: boolean
}

export interface OnboardingProgress {
  userId: string
  userRole: string
  completedSteps: string[]
  startedAt: string
  lastActiveAt: string
}

export interface ProgressReport {
  userId: string
  totalSteps: number
  completedCount: number
  requiredRemaining: number
  completionRatio: number
  durationMs: number
}

export interface EngineOptions {
  now?: () => number
}

export class AiOnboardingEngine {
  private readonly templates = new Map<string, OnboardingStep[]>()
  private readonly progress = new Map<string, OnboardingProgress>()
  private readonly now: () => number
  private readonly auditLog: OnboardingAuditEntry[] = []

  constructor(opts: EngineOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
  }

  /**
   * CSAP D-06: 감사 로그 조회 (append-only).
   */
  getAuditLog(): readonly OnboardingAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: OnboardingAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date(this.now()).toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R98.1: 역할별 템플릿 등록.
   */
  registerTemplate(userRole: string, steps: OnboardingStep[]): void {
    const sorted = [...steps].sort((a, b) => a.order - b.order)
    this.templates.set(userRole, sorted)
    this.audit('registerTemplate', { userRole, stepCount: sorted.length })
  }

  /**
   * FR-R98.2: 온보딩 시작.
   */
  startOnboarding(userId: string, userRole: string): OnboardingProgress {
    if (!this.templates.has(userRole)) {
      throw new Error(`no template registered for role: ${userRole}`)
    }
    const ts = new Date(this.now()).toISOString()
    const prog: OnboardingProgress = {
      userId,
      userRole,
      completedSteps: [],
      startedAt: ts,
      lastActiveAt: ts,
    }
    this.progress.set(userId, prog)
    this.audit('startOnboarding', { userId, userRole })
    return prog
  }

  /**
   * FR-R98.3: 스텝 완료.
   */
  completeStep(userId: string, stepId: string): OnboardingProgress {
    const prog = this.progress.get(userId)
    if (!prog) throw new Error(`no progress for user: ${userId}`)
    const template = this.templates.get(prog.userRole) ?? []
    const step = template.find((s) => s.id === stepId)
    if (!step) throw new Error(`step not in template: ${stepId}`)
    if (!prog.completedSteps.includes(stepId)) {
      prog.completedSteps.push(stepId)
    }
    prog.lastActiveAt = new Date(this.now()).toISOString()
    this.audit('completeStep', { userId, stepId })
    return prog
  }

  /**
   * FR-R98.4: 다음 스텝 (required 우선 → order 오름차순).
   */
  getNextStep(userId: string): OnboardingStep | null {
    const prog = this.progress.get(userId)
    if (!prog) return null
    const template = this.templates.get(prog.userRole) ?? []
    const remaining = template.filter(
      (s) => !prog.completedSteps.includes(s.id),
    )
    if (remaining.length === 0) return null
    remaining.sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1
      return a.order - b.order
    })
    return remaining[0]!
  }

  /**
   * FR-R98.5: 진행 보고서.
   */
  progressReport(userId: string, now: Date = new Date(this.now())): ProgressReport {
    const prog = this.progress.get(userId)
    if (!prog) throw new Error(`no progress for user: ${userId}`)
    const template = this.templates.get(prog.userRole) ?? []
    const completedCount = prog.completedSteps.length
    const requiredRemaining = template.filter(
      (s) => s.required && !prog.completedSteps.includes(s.id),
    ).length
    const completionRatio =
      template.length > 0 ? completedCount / template.length : 0
    const durationMs = now.getTime() - new Date(prog.startedAt).getTime()
    return {
      userId,
      totalSteps: template.length,
      completedCount,
      requiredRemaining,
      completionRatio,
      durationMs,
    }
  }
}
