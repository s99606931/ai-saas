# SVC-AI-ADV-R602 (v3) Design — AI기반 지식베이스 자동 갱신 v3

## 인터페이스
```typescript
interface KbEntry {
  id: string;
  title: string;
  grade: 'C' | 'S' | 'O';
  updatedAt: string; // ISO
  ttlDays: number;
}

type KbStatus = 'ACTIVE' | 'EXPIRED';

interface KbItemResult { id: string; status: KbStatus; }

interface KbUpdateResult {
  active: number;
  expired: number;
  items: KbItemResult[];
}

class KnowledgeBaseUpdaterV3 {
  update(entries: KbEntry[], now?: Date): KbUpdateResult;
  getAuditLog(): AuditEntry[];
}
```

## 알고리즘
1. 입력 항목 중 grade가 C/S인 항목 발견 시 BLOCKED 에러.
2. 각 항목: ageMs = now - updatedAt, ttlMs = ttlDays * 86400000.
3. ageMs > ttlMs → status='EXPIRED', else 'ACTIVE'.
4. 카운트 집계 후 결과 반환, 감사 로그 1건 push.
