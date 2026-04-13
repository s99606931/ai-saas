# SVC-AI-ADV-R378 Design: AI기반 서비스 장애 자동 복구 v2

## 핵심 알고리즘

### 복구 성공률
- `successRate = successCount / totalCount * 100`
- 복구 이력이 없을 때 성공률 = 0
- 성공/실패 각각 카운팅

### 장애 기록
- incident: { serviceId, incidentType, severity, timestamp }
- recovery: { incidentId, actionName, success }

## 클래스 설계

```typescript
class ServiceAutoRecoveryV2 {
  registerService(id, name, recoveryActions: string[]): void
  recordIncident(serviceId, incidentType, severity, grade): IncidentEntry
  recordRecovery(incidentId, actionName, success): void
  getRecoverySuccessRate(serviceId): number
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: recordIncident 차단
- 감사 로그: service.register, incident.record, recovery.record
