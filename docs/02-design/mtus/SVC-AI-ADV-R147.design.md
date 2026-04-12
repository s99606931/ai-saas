# MTU Design — SVC-AI-ADV-R147 KB Change Syncer

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R147.plan.md

## 아키텍처: State Machine + FIFO Queue

인메모리 Map<docId, KbDocState> + 상태 전이 + 순서 보존 pending 큐.

## 상태 전이

```
(없음) --upsert--> PENDING
PENDING --markEmbedded--> EMBEDDED
EMBEDDED --upsert(hash 다름)--> PENDING
EMBEDDED --upsert(hash 동일)--> EMBEDDED (무변경)
PENDING --upsert(hash 동일)--> PENDING (무변경)
* --delete--> TOMBSTONE
```

## 타입

```ts
export type KbStatus = 'PENDING' | 'EMBEDDED' | 'TOMBSTONE'

export interface KbDocState {
  docId: string
  contentHash: string
  status: KbStatus
  updatedAt: number
  enqueuedAt?: number
  embeddedAt?: number
}
```

## API

```ts
class KbChangeSyncer {
  upsert(docId: string, contentHash: string, updatedAt: number, grade?: DataGrade): KbStatus
  markEmbedded(docId: string): void
  delete(docId: string): void
  pending(limit?: number): KbDocState[]
  get(docId: string): KbDocState | undefined
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 빈 ID/해시: `invalid_input`
- 존재하지 않는 docId markEmbedded: `not_found`
- TOMBSTONE 상태 upsert: `tombstoned`
- C/S등급: `grade_blocked`
