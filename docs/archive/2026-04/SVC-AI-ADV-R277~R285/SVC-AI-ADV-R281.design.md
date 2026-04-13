# SVC-AI-ADV-R281 Design: AI기반 자동 서비스 레지스트리

## 핵심 알고리즘

### 서비스 등록 및 발견
- TTL(ms) 기반 만료: `registeredAt + ttl < now` 이면 만료
- 태그/유형 기반 필터링: 등록된 서비스 중 조건 일치 항목 반환
- 만료 서비스는 발견 결과에서 제외

### 헬스 갱신
- `updateHealth(id, healthy)` 호출로 상태 갱신
- unhealthy 서비스는 발견 결과에서 제외 옵션

## 인터페이스 설계

```typescript
class ServiceRegistryAI {
  register(id, name, endpoint, tags, type, ttlMs): void
  discover(filter?: {tag?, type?, healthyOnly?}): ServiceEntry[]
  updateHealth(id, healthy): void
  deregister(id): void
  pruneExpired(): number  // 제거된 서비스 수 반환
  getAuditLog(): AuditEntry[]
}
```
