# SVC-AI-ADV-R502 Design — citizen-request-auto-processor-v2.ts

Plan Ref: SVC-AI-ADV-R502.plan.md

## 클래스 설계

```typescript
type RequestStatus = 'pending' | 'processing' | 'completed' | 'rejected'

class CitizenRequestAutoProcessorV2 {
  registerRequest(requestId, citizenId, requestType, description): CitizenRequest
  updateStatus(requestId, status, dataGrade?): void
  getRequestTypeStats(): Record<string, number>
  getPendingRequests(): CitizenRequest[]
  getAuditLog(): AuditEntry[]
}
```

## 상태 흐름
pending → processing → completed | rejected
