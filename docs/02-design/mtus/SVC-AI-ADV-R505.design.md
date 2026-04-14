# SVC-AI-ADV-R505 Design — security-cert-manager-ai.ts

Plan Ref: SVC-AI-ADV-R505.plan.md

## 클래스 설계

```typescript
type CertStatus = 'valid' | 'expiring' | 'expired'

class SecurityCertManagerAi {
  registerCert(certId, domain, issuer, expiresAt): Certificate
  renewCert(certId, newExpiresAt, dataGrade?): void
  getExpiringCerts(thresholdDays): Certificate[]  // daysUntilExpiry <= thresholdDays
  getCertStatus(certId): CertStatus  // valid: >30d, expiring: <=30d, expired: past
  getAuditLog(): AuditEntry[]
}
```

## 상태 기준
expired: expiresAt < now, expiring: <=30일, valid: >30일
