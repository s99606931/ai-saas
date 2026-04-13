# SVC-AI-ADV-R470 Design — security-vuln-priority-classifier-v2.ts

Plan Ref: SVC-AI-ADV-R470.plan.md

## 클래스 설계

```typescript
type Exploitability = 'public' | 'private' | 'none'
type VulnGrade = 'critical' | 'high' | 'medium' | 'low'

const EXPLOIT_BONUS: Record<Exploitability, number> = { public: 30, private: 15, none: 0 }

class SecurityVulnPriorityClassifierV2 {
  registerVuln(vulnId, title, cvssScore, exploitability, dataGrade?): Vulnerability
  getPriorityScore(vulnId): number   // cvssScore*10 + exploitBonus
  getVulnGrade(vulnId): VulnGrade
  getVulnsByGrade(grade): Vulnerability[]
  getAuditLog(): AuditEntry[]
}
```

## 등급 기준
>=90: critical, >=70: high, >=50: medium, else low
