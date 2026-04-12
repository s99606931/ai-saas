# SVC-AI-ADV-R155 — 공공 데이터 연계 브릿지 (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface FieldMapping { from: string; to: string; transform?: 'string'|'number'|'boolean' }

export interface EndpointConfig {
  id: string
  url: string
  mappings: FieldMapping[]
  retries?: number
  timeoutMs?: number
}

export type FetchFn = (url: string) => Promise<unknown>

export interface BridgeResult {
  endpointId: string
  raw: unknown
  normalized: Record<string, unknown>[]
  fetchedAt: number
}

class PublicDataBridge {
  constructor(grade: DataGrade, fetchFn?: FetchFn)
  registerEndpoint(cfg: EndpointConfig): void
  fetch(endpointId: string): Promise<BridgeResult>
  getAuditLog(): readonly AuditEntry[]
}
```

## 알고리즘

- normalize: raw 배열 순회 → mapping 적용 → transform 변환
- retries: 실패 시 최대 retries(기본 2)회 재시도
- PII 마스킹: normalize 결과 문자열 필드 처리
- audit: register/fetch/error 액션
