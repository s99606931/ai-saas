# SVC-AI-ADV-R601 (v3) Design — AI기반 정책 집행 자동화 v3

## 인터페이스
```typescript
interface PolicyRequest {
  id: string;
  grade: 'C' | 'S' | 'O';
  actorEmail: string;
  action: 'READ' | 'WRITE' | 'DELETE';
  resource: string;
  attemptCount: number;
}

interface PolicyResult {
  id: string;
  allowed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
  maskedActor: string;
}

class AiPolicyEnforcementV3 {
  enforce(req: PolicyRequest): PolicyResult;
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
1. grade가 C/S → BLOCKED 에러 (N2SF N-05).
2. actorEmail은 SHA-256 16자 마스킹.
3. action=DELETE & resource=production → severity=CRITICAL, allowed=false.
4. attemptCount>5 → severity=HIGH, allowed=false.
5. 그 외 → severity=LOW, allowed=true.
6. 감사 로그 추가 (timestamp, action='ENFORCE', details: {id, severity, allowed}).
