# SVC-AI-ADV-R340 Design: AI기반 서비스 카탈로그 자동 갱신

## 핵심 알고리즘

### Stale 탐지
- stale 조건: Date.now() - entry.lastUpdated > staleTtlMs
- 갱신: status 업데이트 + lastUpdated = now

## 인터페이스 설계

```typescript
class ServiceCatalogAutoRefresher {
  registerEntry(id, name, category, staleTtlMs): void
  updateEntry(entryId, status, grade?): void
  getStaleEntries(): CatalogEntry[]
  getCatalog(): CatalogEntry[]
  getAuditLog(): AuditEntry[]
}

interface CatalogEntry {
  id: string
  name: string
  category: string
  status: string
  lastUpdated: number
  staleTtlMs: number
}
```
