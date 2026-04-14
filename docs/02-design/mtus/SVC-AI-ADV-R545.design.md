# SVC-AI-ADV-R545 Design — 멀티테넌트 서비스 격리 v3

## 인터페이스

```typescript
interface IsolationInput {
  requestTenantId: string;
  resourceTenantId: string;
  resourceType: string;
  action: string;
  requesterId: string;
}

interface IsolationResult {
  requestTenantId: string;
  resourceTenantId: string;
  riskLevel: 'SAFE' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decision: 'ALLOW' | 'DENY';
  requesterIdMasked: string;
}
```

## 핵심 알고리즘

- 격리 위반: requestTenantId !== resourceTenantId
- 위험도: 격리위반&&action==='DELETE'→CRITICAL / 격리위반&&action==='WRITE'→HIGH / 격리위반→MEDIUM / else SAFE
- 결과: SAFE→ALLOW / MEDIUM이상→DENY
- PII 마스킹: requesterId 앞2자+'***'+뒤2자 (4자 미만이면 '***')
- 감사 로그: check 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
- D-08: 접근 통제 (테넌트 격리)
