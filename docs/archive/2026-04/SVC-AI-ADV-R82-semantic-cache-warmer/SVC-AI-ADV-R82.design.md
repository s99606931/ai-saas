# SVC-AI-ADV-R82 — 설계

## 모듈
- `semantic-cache-warmer.ts`
  - `SemanticCacheWarmer` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface HitEvent {
  query: string;
  tenantId: string;
  at: number;
  grade: DataGrade;
}

interface WarmCandidate {
  query: string;
  tenantId: string;
  score: number;
  hits: number;
  lastSeen: number;
}

type WarmExecutor = (query: string, tenantId: string) => Promise<{
  costUnits: number;
  ok: boolean;
}>;

interface WarmerOptions {
  maxCandidates: number;          // default 100
  decayHalfLifeMs: number;        // default 6시간
  budgetPerRun: number;           // default 50 (cost units)
  minHitsToWarm: number;          // default 2
}

interface WarmRunResult {
  warmed: number;
  skipped: number;
  budgetUsed: number;
  budgetExceeded: boolean;
  candidates: WarmCandidate[];
}
```

## 점수 산정
```
score = hits * decay(now - lastSeen, halfLife)
decay(dt, h) = 0.5 ^ (dt / h)
```
- 최신성 가중: 시간이 지날수록 반감
- 빈도: 누적 히트 곱

## 마스킹 (N-05)
```
email → ***@***
phone(010-xxxx-xxxx) → ***-****-****
RRN(주민번호) → ******-*******
```

## 동작 흐름
1. `recordHit(query, tenant, grade)` — C/S 등급 → BLOCKED, O 등급 → 마스킹 후 저장
2. `rank()` — 점수 내림차순 정렬, minHits 필터
3. `warmup(executor)` — 순서대로 executor 호출, 예산 초과 시 중단

## API
- `recordHit(input)`
- `rank()` → WarmCandidate[]
- `warmup(executor)` → WarmRunResult
- `getAuditLog()`
- `reset()`

## 감사 이벤트
HIT / GRADE_BLOCKED / RANK / WARM_OK / WARM_FAIL / BUDGET_EXCEEDED
