# SVC-AI-ADV-R85 — 설계

## 모듈
- `temporal-reasoning-engine.ts`
  - `TemporalReasoningEngine` 클래스

## 핵심 타입
```typescript
interface TimePoint {
  epochMs: number;
}

interface Interval {
  startMs: number;
  endMs: number;
}

type AllenRelation =
  | 'before'
  | 'after'
  | 'meets'
  | 'met-by'
  | 'overlaps'
  | 'overlapped-by'
  | 'starts'
  | 'started-by'
  | 'finishes'
  | 'finished-by'
  | 'during'
  | 'contains'
  | 'equals';

interface ParseResult {
  ok: boolean;
  epochMs?: number;
  reason?: string;
}

interface EngineOptions {
  now: number;         // 고정 시각 (테스트용)
  timezoneOffsetMin: number;  // default +540 (KST)
  holidays: string[];  // 'YYYY-MM-DD' 목록
}

interface DeadlineResult {
  startMs: number;
  deadlineMs: number;
  businessDaysUsed: number;
  holidaysSkipped: number;
}
```

## 한국어 파서 (상대)
```
- 오늘 → now
- 어제 → now - 1일
- 내일 → now + 1일
- 모레 → now + 2일
- N일 전/후 → now ± N*86400000
- N주 전/후 → now ± N*7*86400000
- N개월 전/후 → now ± N*30*86400000 (근사)
- 'YYYY-MM-DD' → 해당 KST 00:00
```

## Allen 관계 판정
```
A = [a1, a2], B = [b1, b2] (a1 < a2, b1 < b2)
- before: a2 < b1
- meets: a2 == b1
- overlaps: a1 < b1 < a2 < b2
- during: b1 < a1 && a2 < b2
- starts: a1 == b1 && a2 < b2
- finishes: a2 == b2 && b1 < a1
- equals: a1 == b1 && a2 == b2
- 반대 관계: after / met-by / overlapped-by / contains / started-by / finished-by
```

## 영업일 계산
- 토(6)/일(0) 제외
- holidays 배열 (KST 'YYYY-MM-DD') 제외
- `addBusinessDays(start, n)` — 시작일 포함하지 않고 n일 건너뛰기

## API
- `parseKoreanDate(text)` → ParseResult
- `allenRelation(a, b)` → AllenRelation
- `diffDays(a, b)` → number (절대값)
- `addBusinessDays(start, days)` → DeadlineResult
- `computeDeadline(start, businessDays)` → DeadlineResult
- `getAuditLog()`

## 감사 이벤트
PARSE_OK / PARSE_FAIL / RELATE / DEADLINE / BLOCKED
