# SVC-AI-ADV-R508 Design — service-token-security-manager-v2.ts

Plan Ref: SVC-AI-ADV-R508.plan.md

## 클래스 설계

```typescript
class ServiceTokenSecurityManagerV2 {
  registerToken(tokenId, serviceId, tokenType, expiresAt): ServiceToken
  recordUsage(tokenId, clientId, dataGrade?): void
  isExpired(tokenId): boolean
  getExpiredTokens(): ServiceToken[]
  getAuditLog(): AuditEntry[]
}
```

## 만료 판단
`isExpired = new Date(token.expiresAt) < new Date()`
