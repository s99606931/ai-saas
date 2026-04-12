/**
 * API Endpoint Security Classifier — SVC-AI-ADV-R169 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R169/SVC-AI-ADV-R169.design.md
 * Plan SC: FR-R169.1 ~ FR-R169.5
 *
 * API 엔드포인트 자동 보안 등급 분류 + CSAP D-08 준수 검사.
 * 순수 계산 — 외부 API 없음.
 */

// Design Ref: §타입 정의

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type SecurityLevel = 'PUBLIC' | 'AUTHENTICATED' | 'PRIVILEGED' | 'INTERNAL'

export interface ApiEndpoint {
  endpointId: string
  path: string
  method: HttpMethod
  description: string
  hasAuth: boolean
  roles: string[]
}

export interface SecurityClassification {
  endpointId: string
  path: string
  method: HttpMethod
  level: SecurityLevel
  csapCompliant: boolean
  issues: string[]
}

export interface ComplianceReport {
  totalEndpoints: number
  compliant: number
  nonCompliant: number
  byLevel: Record<SecurityLevel, number>
  issues: SecurityClassification[]
}

export interface AuditEntry {
  timestamp: string
  action: string
  endpointId: string
  detail: Record<string, unknown>
}

const INTERNAL_PATH_PATTERN = /\/admin|\/internal|\/system/i
const PRIVILEGED_ROLES = /admin|superuser/i

export class ApiEndpointSecurityClassifier {
  private readonly endpoints = new Map<string, ApiEndpoint>()
  private readonly auditLog: AuditEntry[] = []

  // Plan SC: FR-R169.1
  registerEndpoint(endpoint: ApiEndpoint): void {
    this.endpoints.set(endpoint.endpointId, { ...endpoint, roles: [...endpoint.roles] })
    this.appendAudit('endpoint.register', endpoint.endpointId, { path: endpoint.path, method: endpoint.method })
  }

  // Plan SC: FR-R169.2 + FR-R169.3 — Design Ref: §알고리즘
  classify(endpointId: string): SecurityClassification {
    const ep = this.endpoints.get(endpointId)
    if (!ep) throw new Error(`Unknown endpoint: ${endpointId}`)

    // 자동 분류
    let level: SecurityLevel
    if (INTERNAL_PATH_PATTERN.test(ep.path)) {
      level = 'INTERNAL'
    } else if (ep.roles.some((r) => PRIVILEGED_ROLES.test(r))) {
      level = 'PRIVILEGED'
    } else if (ep.hasAuth) {
      level = 'AUTHENTICATED'
    } else {
      level = 'PUBLIC'
    }

    // CSAP D-08 준수 검사
    const issues: string[] = []
    if (level === 'INTERNAL' || level === 'PRIVILEGED') {
      if (!ep.hasAuth) issues.push(`${level} 엔드포인트에 인증 없음 (CSAP D-08)`)
      if (ep.roles.length === 0) issues.push(`${level} 엔드포인트에 역할 미정의 (CSAP D-08)`)
    } else if (level === 'AUTHENTICATED') {
      if (!ep.hasAuth) issues.push('AUTHENTICATED 엔드포인트에 인증 없음 (CSAP D-08)')
    }

    const classification: SecurityClassification = {
      endpointId,
      path: ep.path,
      method: ep.method,
      level,
      csapCompliant: issues.length === 0,
      issues,
    }
    this.appendAudit('endpoint.classify', endpointId, { level, csapCompliant: classification.csapCompliant })
    return classification
  }

  // Plan SC: FR-R169.4 — 전체 준수 리포트
  generateComplianceReport(): ComplianceReport {
    const byLevel: Record<SecurityLevel, number> = { PUBLIC: 0, AUTHENTICATED: 0, PRIVILEGED: 0, INTERNAL: 0 }
    const issueList: SecurityClassification[] = []
    let compliant = 0
    let nonCompliant = 0

    for (const ep of this.endpoints.values()) {
      const cls = this.classify(ep.endpointId)
      byLevel[cls.level]++
      if (cls.csapCompliant) compliant++
      else {
        nonCompliant++
        issueList.push(cls)
      }
    }

    this.appendAudit('compliance.report', '', { totalEndpoints: this.endpoints.size, nonCompliant })
    return {
      totalEndpoints: this.endpoints.size,
      compliant,
      nonCompliant,
      byLevel,
      issues: issueList,
    }
  }

  // Plan SC: FR-R169.5 — CSAP D-06
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, endpointId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, endpointId, detail })
  }
}
