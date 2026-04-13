# SVC-AI-ADV-R411 Design: AI기반 자동 인증 토큰 최적화 v2

## 핵심 알고리즘

### 토큰 상태
- `expiresAt = issuedAt + ttlMs`
- active: now < expiresAt AND not revoked
- expired: now >= expiresAt
- revoked: 명시적 폐기

### 만료 예정 알림
- `remainingMs = expiresAt - now`
- remainingMs < warningMs AND status='active' → 만료 예정 목록

## 클래스 설계

```typescript
class AuthTokenOptimizerV2 {
  issueToken(userId, tokenType, ttlMs): TokenEntry
  getTokenStatus(tokenId): TokenStatus
  getExpiringTokens(warningMs): TokenEntry[]
  revokeToken(tokenId): void
  getAuditLog(): AuditEntry[]
}
```
