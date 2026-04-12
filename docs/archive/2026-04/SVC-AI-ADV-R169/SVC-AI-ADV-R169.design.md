# SVC-AI-ADV-R169 — API 엔드포인트 보안 분류기 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type SecurityLevel = 'PUBLIC' | 'AUTHENTICATED' | 'PRIVILEGED' | 'INTERNAL'

export interface ApiEndpoint {
  endpointId: string; path: string; method: HttpMethod
  description: string; hasAuth: boolean; roles: string[] }

export interface SecurityClassification {
  endpointId: string; path: string; method: HttpMethod
  level: SecurityLevel; csapCompliant: boolean; issues: string[] }

export interface ComplianceReport {
  totalEndpoints: number; compliant: number; nonCompliant: number
  byLevel: Record<SecurityLevel, number>; issues: SecurityClassification[] }

class ApiEndpointSecurityClassifier {
  registerEndpoint(endpoint: ApiEndpoint): void
  classify(endpointId: string): SecurityClassification
  generateComplianceReport(): ComplianceReport
  getAuditLog(): AuditEntry[]
}
```

## 알고리즘

- 자동 분류:
  - 경로에 /admin|/internal|/system 포함 → INTERNAL
  - roles에 admin|superuser 포함 → PRIVILEGED
  - hasAuth=true → AUTHENTICATED
  - else → PUBLIC
- CSAP D-08 준수 검사:
  - PRIVILEGED/INTERNAL: hasAuth=true 필수, roles 비어있으면 위반
  - AUTHENTICATED: hasAuth=true 필수
  - PUBLIC: 항상 준수
