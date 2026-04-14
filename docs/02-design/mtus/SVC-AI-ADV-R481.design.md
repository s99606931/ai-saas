# SVC-AI-ADV-R481 Design — multitenant-security-auditor-v2.ts

Plan Ref: SVC-AI-ADV-R481.plan.md

```ts
export type ViolationType = 'CROSS_TENANT_ACCESS' | 'UNAUTHORIZED_ACTION' | 'NONE';
export type Severity = 'CRITICAL' | 'HIGH' | 'LOW';
export interface AccessLog {
  readonly logId: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly resource: string;
  readonly action: string;
  readonly targetTenantId?: string;
}
export interface AuditFinding {
  readonly logId: string;
  readonly violation: ViolationType;
  readonly severity: Severity;
  readonly maskedUserId: string;
}
export interface SecurityAuditReport {
  readonly total: number;
  readonly violations: number;
  readonly findings: readonly AuditFinding[];
}
```

violation: targetTenantId존재 && targetTenantId!=tenantId → CROSS_TENANT_ACCESS(CRITICAL)
action이 'DELETE'|'ADMIN'|'EXPORT' → UNAUTHORIZED_ACTION(HIGH)
else NONE(LOW) — NONE은 findings에 포함하지 않음
userId 마스킹: 앞2자 + '*'.repeat(len-4) + 뒤2자
