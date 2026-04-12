// Design Ref: §R275 — 테넌트 온보딩 마법사
// Plan SC: SVC-AI-ADV-R275-SC01

export type DataGrade = 'C' | 'S' | 'O'
export type OnboardingStep = 'basic_info' | 'admin_user' | 'domain' | 'sso' | 'billing'
export type TenantStatus = 'IN_PROGRESS' | 'ACTIVE' | 'CANCELLED'

export interface BasicInfoData {
  name: string
  industry: string
  employeeCount: number
}

export interface AdminUserData {
  email: string
  fullName: string
}

export interface DomainData {
  subdomain: string
}

export interface SsoData {
  provider: 'SAML' | 'OIDC' | 'NONE'
  metadataUrl?: string
}

export interface BillingData {
  method: 'CARD' | 'BANK' | 'INVOICE'
  contactEmail: string
}

export interface TenantState {
  tenantId: string
  plan: string
  status: TenantStatus
  completedSteps: OnboardingStep[]
  progressPct: number
}

interface StoredTenant {
  tenantId: string
  plan: string
  status: TenantStatus
  completedSteps: Set<OnboardingStep>
  data: Partial<{
    basic_info: BasicInfoData
    admin_user: AdminUserData
    domain: DomainData
    sso: SsoData
    billing: BillingData
  }>
  startedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  callerMasked: string
  detail: Record<string, unknown>
}

const REQUIRED_STEPS: OnboardingStep[] = [
  'basic_info',
  'admin_user',
  'domain',
  'sso',
  'billing',
]

export class TenantOnboardingWizard {
  private tenants = new Map<string, StoredTenant>()
  private auditLog: AuditEntry[] = []

  startOnboarding(tenantId: string, plan: string, grade: DataGrade, caller: string): TenantState {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 테넌트 온보딩 금지 (N2SF N-05)`)
    }
    if (!tenantId) throw new Error('tenantId 필수')
    if (!plan) throw new Error('plan 필수')
    if (this.tenants.has(tenantId)) {
      throw new Error(`중복 tenantId: ${tenantId}`)
    }
    const t: StoredTenant = {
      tenantId,
      plan,
      status: 'IN_PROGRESS',
      completedSteps: new Set(),
      data: {},
      startedAt: new Date().toISOString(),
    }
    this.tenants.set(tenantId, t)
    this.appendAudit('onboarding.start', this.mask(caller), { tenantId, plan })
    return this.toState(t)
  }

  completeBasicInfo(tenantId: string, data: BasicInfoData): TenantState {
    const t = this.requireTenant(tenantId)
    if (!data.name || !data.industry) throw new Error('name, industry 필수')
    if (data.employeeCount < 0) throw new Error('employeeCount 0 이상 필요')
    t.data.basic_info = { ...data }
    t.completedSteps.add('basic_info')
    this.appendAudit('step.basic_info', 'SYSTEM', { tenantId })
    return this.toState(t)
  }

  completeAdminUser(tenantId: string, data: AdminUserData): TenantState {
    const t = this.requireTenant(tenantId)
    if (!this.isEmail(data.email)) throw new Error('유효하지 않은 email')
    if (!data.fullName) throw new Error('fullName 필수')
    t.data.admin_user = { ...data }
    t.completedSteps.add('admin_user')
    this.appendAudit('step.admin_user', 'SYSTEM', {
      tenantId,
      emailMasked: this.mask(data.email),
    })
    return this.toState(t)
  }

  completeDomain(tenantId: string, data: DomainData): TenantState {
    const t = this.requireTenant(tenantId)
    if (!/^[a-z0-9-]{3,30}$/.test(data.subdomain)) {
      throw new Error('subdomain 형식 오류 (소문자/숫자/하이픈, 3~30자)')
    }
    t.data.domain = { ...data }
    t.completedSteps.add('domain')
    this.appendAudit('step.domain', 'SYSTEM', { tenantId, subdomain: data.subdomain })
    return this.toState(t)
  }

  completeSso(tenantId: string, data: SsoData): TenantState {
    const t = this.requireTenant(tenantId)
    if (data.provider !== 'NONE' && !data.metadataUrl) {
      throw new Error('SSO provider 선택 시 metadataUrl 필수')
    }
    t.data.sso = { ...data }
    t.completedSteps.add('sso')
    this.appendAudit('step.sso', 'SYSTEM', { tenantId, provider: data.provider })
    return this.toState(t)
  }

  completeBilling(tenantId: string, data: BillingData): TenantState {
    const t = this.requireTenant(tenantId)
    if (!this.isEmail(data.contactEmail)) throw new Error('유효하지 않은 contactEmail')
    t.data.billing = { ...data }
    t.completedSteps.add('billing')
    this.appendAudit('step.billing', 'SYSTEM', { tenantId, method: data.method })
    return this.toState(t)
  }

  finalize(tenantId: string, caller: string): TenantState {
    const t = this.requireTenant(tenantId)
    if (t.status !== 'IN_PROGRESS') {
      throw new Error(`활성화 불가 상태: ${t.status}`)
    }
    const missing = REQUIRED_STEPS.filter((s) => !t.completedSteps.has(s))
    if (missing.length > 0) {
      throw new Error(`미완료 단계: ${missing.join(', ')}`)
    }
    t.status = 'ACTIVE'
    this.appendAudit('onboarding.finalize', this.mask(caller), { tenantId })
    return this.toState(t)
  }

  cancel(tenantId: string, caller: string): TenantState {
    const t = this.requireTenant(tenantId)
    t.status = 'CANCELLED'
    this.appendAudit('onboarding.cancel', this.mask(caller), { tenantId })
    return this.toState(t)
  }

  getStatus(tenantId: string): TenantState {
    return this.toState(this.requireTenant(tenantId))
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private requireTenant(tenantId: string): StoredTenant {
    const t = this.tenants.get(tenantId)
    if (!t) throw new Error(`tenantId 없음: ${tenantId}`)
    return t
  }

  private toState(t: StoredTenant): TenantState {
    const completed = [...t.completedSteps]
    return {
      tenantId: t.tenantId,
      plan: t.plan,
      status: t.status,
      completedSteps: completed,
      progressPct: Math.round((completed.length / REQUIRED_STEPS.length) * 100),
    }
  }

  private isEmail(v: string): boolean {
    return /^[\w+.-]+@[\w-]+\.[\w.-]+$/.test(v)
  }

  private mask(id: string): string {
    if (id.length <= 4) return '***'
    return `${id.slice(0, 2)}***${id.slice(-2)}`
  }

  private appendAudit(
    action: string,
    callerMasked: string,
    detail: Record<string, unknown>
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      callerMasked,
      detail,
    })
  }
}
