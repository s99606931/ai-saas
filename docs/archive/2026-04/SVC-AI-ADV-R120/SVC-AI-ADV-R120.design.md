# SVC-AI-ADV-R120 — Document Intelligence Pipeline (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: Chain of Responsibility + Stage 인터페이스 + 공유 컨텍스트
- **선정 이유**: Pragmatic Balance — 스테이지 pluggable, 부분 결과 허용

## 인터페이스

```typescript
interface StageResult<T> {
  value: T
  confidence: number    // 0~1
  durationMs: number
}

interface Stage<I, O> {
  name: string
  run(input: I, ctx: PipelineContext): Promise<StageResult<O>>
}

interface DocumentInput {
  id: string
  bytes?: Uint8Array
  text?: string
  grade: DataGrade
}

interface DocumentPackage {
  id: string
  rawText: string
  category: string
  entities: Record<string, string>
  structured: Record<string, unknown>
  stageConfidences: Record<string, number>
  skipped: string[]
  totalDurationMs: number
}

class DocumentIntelligencePipeline {
  constructor(options?: { skipOnFailure?: boolean; retries?: number })
  addStage<I, O>(stage: Stage<I, O>): this
  process(input: DocumentInput): Promise<DocumentPackage>
  getAuditLog(): readonly DIAuditEntry[]
}
```

## 기본 스테이지

1. **OCRStage**: bytes → rawText (주입 없으면 input.text 사용)
2. **ClassifyStage**: rawText → category (키워드 맵 기반)
3. **ExtractStage**: rawText → entities (정규식 기반 이름/날짜/금액)
4. **StructureStage**: 모든 결과 → JSON 구조화

## 실패 처리

- skipOnFailure=true: 단계 실패 시 `skipped`에 추가, 나머지 진행
- retries=N: 단계당 최대 N회 재시도

## PII 마스킹

- 최종 structured JSON 순회 → email/RRN/phone 마스킹
- 원본 rawText는 보존 (감사 목적)

## Session Guide

1. addStage로 파이프라인 구성
2. process(input) 호출 → 각 스테이지 순차 실행
3. 실패 시 옵션에 따라 스킵 또는 중단
4. 최종 DocumentPackage 반환
