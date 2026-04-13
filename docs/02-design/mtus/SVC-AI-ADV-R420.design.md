# SVC-AI-ADV-R420 Design — AI기반 멀티테넌트 로그 분리 검증

## §R420 설계 결정
- 로그 엔트리: tenantId + userId + 메시지 + 타임스탬프
- 혼재 탐지: 로그에 다른 tenantId 문자열 포함 여부 확인
- 위반: ISOLATION_VIOLATION (심각도 CRITICAL)
- 격리 상태: ISOLATED / VIOLATED
- PII: userId 마스킹 (앞2+*+뒤2), 감사 로그 미노출
- 감사 로그: log.submit, isolation.verify 액션

## 인터페이스
```typescript
interface LogEntry { logId, tenantId, userId, message, timestamp, serviceName }
interface IsolationViolation { logId, tenantId, suspectedLeakTenantId, severity: 'CRITICAL', description }
interface IsolationVerificationReport { tenantId, totalLogs, violationCount, isolationStatus: 'ISOLATED'|'VIOLATED', violations: IsolationViolation[] }
```
