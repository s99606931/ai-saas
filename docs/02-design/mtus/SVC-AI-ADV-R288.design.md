# SVC-AI-ADV-R288 Design: AI기반 멀티테넌트 보안 감사

## 핵심 알고리즘

### 보안 점수 계산
- 이벤트 심각도별 감점: critical=-20, high=-10, medium=-5, low=-2
- 기본 점수 100에서 이벤트 감점 누산
- 점수: max(0, 100 + sum(감점))

### 격리 위반 탐지
- 이벤트에 targetTenantId가 있고 소속 테넌트와 다르면 cross-tenant 접근으로 기록

## 인터페이스 설계

```typescript
class MultitenantSecurityAuditorAI {
  registerTenant(id, name, securityPolicy): void
  recordSecurityEvent(tenantId, type, severity, targetTenantId?): SecurityEvent
  getSecurityScore(tenantId): number
  getIsolationViolations(): IsolationViolation[]
  getAuditLog(): AuditEntry[]
}
```
