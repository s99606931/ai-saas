# SVC-AI-ADV-R80 — 설계

## 모듈
- `ai-telemetry-replayer.ts`
  - `AITelemetryReplayer` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface AICallRecord {
  id: string;
  at: number;
  tenantId: string;
  model: string;
  prompt: string;       // 마스킹 후 저장
  response: string;     // 마스킹 후 저장
  tags: string[];
  grade: DataGrade;     // O만 허용
  latencyMs: number;
}

interface ReplayInput {
  id: string;
}

interface ReplayResult {
  recordId: string;
  originalHash: string;
  replayHash: string;
  match: boolean;
  latencyDiffMs: number;
  regression: boolean;   // match=false or latencyDiffMs > 200
}

interface ReplayerOptions {
  ttlMs: number;         // 0 = disable
  latencyRegressionMs: number; // default 200
}
```

## 마스킹 규칙 (N2SF N-05)
```
email: /[\w.+-]+@[\w-]+\.[\w.-]+/ → ***@***
phone: /\b0\d{1,2}-?\d{3,4}-?\d{4}\b/ → ***-****-****
RRN(주민번호): /\b\d{6}-\d{7}\b/ → ******-*******
```

## API
- `record(input)` — 등급 != 'O' → throw RECORD_GRADE_BLOCKED, 마스킹 적용
- `get(id)` → AICallRecord | undefined
- `query({ tag?, from?, to? })` → AICallRecord[]
- `replay(id, executor)` — executor: `(record) => Promise<{ response: string; latencyMs: number }>`
- `evict()` — TTL 기반 제거
- `getAuditLog()`

## 해시
- FNV-1a 32bit (결정적 비교용, 모듈 내부 구현)

## 감사 이벤트
RECORD / BLOCKED / REPLAY / REGRESSION / EVICT / QUERY

## 보안
- C/S 등급 기록 시 blocked
- 마스킹 누락 탐지: 입력 텍스트에 이메일/전화/RRN 패턴 잔존 시 MASK_LEAK 경고 + 재마스킹
