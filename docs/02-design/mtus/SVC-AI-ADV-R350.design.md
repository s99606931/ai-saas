# SVC-AI-ADV-R350 Design: Emergency Resource Allocator

## 알고리즘
- priorityWeight: critical=1000, high=100, medium=10, low=1
- 유형/가용 필터 → 유클리드 근사 거리(km)
- score = priorityWeight - distance (최대값 선택)
- 배분 후 자원 상태 dispatched

## 타입
```typescript
class EmergencyResourceAllocator {
  registerResource(id, type, lat, lng, status?): Resource
  reportIncident(id, type, priority, lat, lng, grade): Incident
  allocate(incidentId): Allocation
  getAuditLog(): readonly AuditEntry[]
}
```
