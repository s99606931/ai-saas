# SVC-AI-ADV-R414 Design — AI기반 자동 보안 정책 갱신

## §R414 설계 결정
- CVE 심각도: CRITICAL=40점, HIGH=30점, MEDIUM=15점, LOW=5점
- 정책 우선순위: 연관 CVE 점수 합산 → URGENT(≥40)/HIGH(≥20)/MEDIUM(≥10)/LOW
- 자동 갱신 가능 여부: autoRemediable 플래그
- CRITICAL CVE 존재 시 즉시 갱신 권고 포함
- 감사 로그: cve.register, policy.update 액션

## 인터페이스
```typescript
interface CveEntry { cveId, severity, affectedComponents: string[], description }
interface SecurityPolicy { policyId, name, affectedComponents: string[], lastUpdatedAt }
interface PolicyUpdateReport { totalPolicies, urgentCount, policyUpdates: { policyId, priority, relatedCves, recommendation }[] }
```
