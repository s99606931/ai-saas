// Design Ref: §R525 — AI기반 서비스 카탈로그 자동 검증 v2
// Plan SC: SVC-AI-ADV-R525-SC01

export type ValidationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
export type ServiceStatus = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED'

export interface CatalogService {
  serviceId: string
  name: string
  version: string
  status: ServiceStatus
  owner: string
  description: string
  slaTarget: number        // 가용성 목표 (%)
  apiEndpoints: string[]
  dependencies: string[]   // 의존 서비스 ID
  tags: string[]
  lastReviewedDaysAgo: number
}

export interface ValidationIssue {
  issueId: string
  serviceId: string
  severity: ValidationSeverity
  field: string
  message: string
  suggestion: string
}

export interface CatalogValidationReport {
  serviceId: string
  name: string
  isValid: boolean      // ERROR/CRITICAL 없음
  issues: ValidationIssue[]
  validationScore: number   // 0..100
  recommendations: string[]
}

interface AuditEntry {
  timestamp: string
  action: string
  serviceId: string
  detail: Record<string, unknown>
}

export class ServiceCatalogValidatorV2 {
  private services = new Map<string, CatalogService>()
  private auditLog: AuditEntry[] = []

  registerService(service: CatalogService): void {
    this.services.set(service.serviceId, service)
    this.appendAudit('service.register', service.serviceId, { name: service.name, status: service.status })
  }

  validate(serviceId: string): CatalogValidationReport {
    const service = this.services.get(serviceId)
    if (!service) throw new Error(`Unknown service: ${serviceId}`)

    this.appendAudit('catalog.validate', serviceId, { name: service.name })

    const issues: ValidationIssue[] = []
    this.checkRequiredFields(serviceId, service, issues)
    this.checkDependencies(serviceId, service, issues)

    const errorCount = issues.filter((i) => i.severity === 'ERROR' || i.severity === 'CRITICAL').length
    const warningCount = issues.filter((i) => i.severity === 'WARNING').length
    const validationScore = Math.max(0, 100 - errorCount * 15 - warningCount * 5)
    const isValid = errorCount === 0

    const recommendations: string[] = []
    if (!isValid) recommendations.push(`${errorCount}개 오류 수정 후 카탈로그 재등록 필요`)
    if (service.status === 'DEPRECATED') recommendations.push('DEPRECATED 서비스 사용 중단 일정 공지 필요')

    return { serviceId, name: service.name, isValid, issues, validationScore, recommendations }
  }

  private checkRequiredFields(serviceId: string, service: CatalogService, issues: ValidationIssue[]): void {
    if (!service.description || service.description.length < 10) {
      issues.push({ issueId: `ISS-${serviceId}-DESC`, serviceId, severity: 'ERROR', field: 'description', message: '서비스 설명이 없거나 10자 미만', suggestion: '서비스 목적, 기능, 대상 사용자를 포함한 상세 설명 작성' })
    }
    if (!service.owner || service.owner.trim() === '') {
      issues.push({ issueId: `ISS-${serviceId}-OWNER`, serviceId, severity: 'CRITICAL', field: 'owner', message: '서비스 오너 미지정', suggestion: '담당 팀 또는 담당자 이메일 지정' })
    }
    if (service.apiEndpoints.length === 0) {
      issues.push({ issueId: `ISS-${serviceId}-ENDPOINTS`, serviceId, severity: 'WARNING', field: 'apiEndpoints', message: 'API 엔드포인트 미등록', suggestion: '서비스에서 제공하는 API 엔드포인트 목록 등록' })
    }
    if (service.slaTarget < 99) {
      issues.push({ issueId: `ISS-${serviceId}-SLA`, serviceId, severity: 'WARNING', field: 'slaTarget', message: `SLA 목표 ${service.slaTarget}% — 공공기관 권장 기준(99%) 미달`, suggestion: '서비스 중요도에 따라 SLA 목표 재설정 (최소 99%)' })
    }
    if (service.tags.length === 0) {
      issues.push({ issueId: `ISS-${serviceId}-TAGS`, serviceId, severity: 'INFO', field: 'tags', message: '태그 미등록 — 검색 노출 저하', suggestion: '서비스 카테고리, 기능, 대상 기관 등 태그 추가' })
    }
    if (service.lastReviewedDaysAgo > 365) {
      issues.push({ issueId: `ISS-${serviceId}-REVIEW`, serviceId, severity: 'WARNING', field: 'lastReviewedDaysAgo', message: `마지막 검토 ${service.lastReviewedDaysAgo}일 경과 — 연간 검토 미실시`, suggestion: '서비스 카탈로그 연간 검토 일정 수립' })
    }
  }

  private checkDependencies(serviceId: string, service: CatalogService, issues: ValidationIssue[]): void {
    for (const depId of service.dependencies) {
      if (!this.services.has(depId)) {
        issues.push({ issueId: `ISS-${serviceId}-DEP-${depId}`, serviceId, severity: 'ERROR', field: 'dependencies', message: `의존 서비스 '${depId}' 카탈로그 미등록`, suggestion: `'${depId}' 서비스를 카탈로그에 등록하거나 의존성 목록에서 제거` })
      }
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, serviceId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, serviceId, detail })
  }
}
