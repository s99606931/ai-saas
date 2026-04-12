# SVC-AI-ADV-R150 — 실시간 번역 스트리밍 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R150.plan.md

## 1. 아키텍처

```
translate(text, from, to, grade)
      ↓
RealtimeTranslationStreamer
  ├─ N2SF guard: C/S 차단
  ├─ getChunks() — 문장 단위 분리 ([.!?。] 기준)
  ├─ streamTranslation() — AsyncGenerator<TranslationChunk>
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type DataGrade = 'C' | 'S' | 'O'
export interface TranslationChunk {
  index: number; original: string; translated: string
  locale: string; progress: number }
export interface TranslationResult {
  stream: AsyncGenerator<TranslationChunk>
  totalChunks: number; requestId: string }
```

## 3. 알고리즘

### §3.1 청크 분리: `/[.!?。\n]+/` 기준 split + 공백 필터
### §3.2 모의 번역: `[${toLocale}] ${original}` 형식 (테스트용 결정적 출력)
### §3.3 progress: `(index + 1) / totalChunks`

## 4. Design Anchor
- N2SF N-05: C/S 등급 차단 / CSAP D-06: 번역 감사 로그
