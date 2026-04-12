# SVC-AI-ADV-R78 — 설계

## 모듈
- `prompt-variant-experimenter.ts`
  - `PromptVariantExperimenter` 클래스

## 핵심 타입
```typescript
type VariantStatus = 'draft' | 'running' | 'concluded';

interface Variant {
  id: string;
  label: string;
  template: string;
  weight: number;      // 0~1, 합계 1
}

interface ExperimentDef {
  id: string;
  name: string;
  control: Variant;
  variants: Variant[];
  minSamples: number;  // 판정 최소 샘플 (default 30)
  status: VariantStatus;
}

interface TrialResult {
  sessionId: string;
  variantId: string;
  quality: number;     // 0~1
  latencyMs: number;
  success: boolean;
}

interface VariantStats {
  variantId: string;
  n: number;
  avgQuality: number;
  avgLatency: number;
  successRate: number;
}

interface Verdict {
  status: 'running' | 'concluded';
  winner?: string;
  reason: string;
  stats: VariantStats[];
}
```

## 할당 알고리즘
```
hash = FNV1a(expId + ':' + sessionId) / 0xFFFFFFFF  // 0~1
cumulative = 0
for v in [control, ...variants]:
  cumulative += v.weight
  if hash < cumulative: return v.id
```

## 판정
```
minSamples per variant 미달 → running
avgQuality(variant) - avgQuality(control) ≥ 0.05 → winner = variant
avgQuality(control) - avgQuality(best variant) ≥ 0.05 → winner = control
otherwise inconclusive
```

## API
- `create(def)`
- `assign(expId, sessionId)` → variantId
- `record(expId, result)`
- `stats(expId)` → VariantStats[]
- `conclude(expId)` → Verdict
- `getAuditLog()`

## 감사 이벤트
CREATE / ASSIGN / RECORD / CONCLUDE

## 보안
- template 안 placeholder는 O 등급만 허용 (선언적) + 실행 시 호출자가 guard
- weight 합계 != 1 (±0.001) → throw EXPERIMENT_WEIGHT_INVALID
