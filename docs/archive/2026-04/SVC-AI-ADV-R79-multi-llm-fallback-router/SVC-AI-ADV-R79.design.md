# SVC-AI-ADV-R79 — 설계

## 모듈
- `multi-llm-fallback-router.ts`
  - `MultiLLMFallbackRouter` 클래스

## 핵심 타입
```typescript
type RoutingPolicy = 'priority' | 'cost' | 'latency';
type CircuitState = 'closed' | 'open' | 'half_open';

interface ProviderSpec {
  id: string;
  envKey: string;         // ex: LLM_OPENAI_API_KEY (값은 env에서 조회만)
  priority: number;       // 1=highest
  costPer1kTokens: number;
  avgLatencyMs: number;
  enabled: boolean;
}

interface Circuit {
  state: CircuitState;
  failures: number;
  openedAt?: number;
}

interface CallResult {
  providerId: string;
  ok: boolean;
  latencyMs: number;
  tokens: number;
  error?: string;
}

interface RouteDecision {
  chain: string[];            // 폴백 시도 순서
  policy: RoutingPolicy;
}

interface Aggregate {
  providerId: string;
  calls: number;
  successes: number;
  failures: number;
  costTotal: number;
  avgLatencyMs: number;
}
```

## 알고리즘
```
정렬 기준:
  priority: priority asc
  cost: costPer1kTokens asc
  latency: avgLatencyMs asc
  (동점 시 priority asc tie-breaker)

폴백 실행:
  for each provider in chain:
    if circuit open and (now - openedAt) < cooldownMs: skip
    if circuit open and cooldown 지남: state = half_open
    try call(provider)
    on success: closed, failures=0, return
    on failure: failures++, if ≥ threshold → state=open, openedAt=now
```

## 파라미터
- failureThreshold: 3 (연속)
- cooldownMs: 30_000 (30초)

## API
- `registerProvider(spec)` — envKey만 저장, 값은 저장 금지
- `decide(policy)` → RouteDecision
- `execute(policy, caller)` where caller: `(providerId) => Promise<CallResult>`
- `aggregate()` → Aggregate[]
- `getAuditLog()`

## 감사 이벤트
REGISTER / ROUTE / CALL_OK / CALL_FAIL / FALLBACK / CIRCUIT_OPEN / CIRCUIT_HALF / BLOCKED

## 보안
- ProviderSpec에 실제 시크릿 값이 들어오면 throw SECRET_HARDCODED
  - 탐지 패턴: envKey 외 필드에 'sk-' 또는 길이 ≥ 32 hex
- envKey 자체는 저장 (이름만), 값 조회는 `resolveKey(id)` 호출 시 process.env에서만
