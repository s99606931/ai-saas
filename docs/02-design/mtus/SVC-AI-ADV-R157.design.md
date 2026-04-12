# MTU Design — SVC-AI-ADV-R157 Model Card Generator

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R157.plan.md

## 아키텍처: Metadata → Template Renderer

```
build(meta):
  validate required fields (name, version, purpose, owner, trainingData, evaluation, limitations, ethicalConsiderations)
  validate version matches /^\d+\.\d+\.\d+$/
  normalize
  produce markdown (8 sections) and json
```

## 타입

```ts
export interface ModelCardMeta {
  name: string
  version: string
  purpose: string
  owner: string
  trainingData: string
  evaluation: string
  limitations: string
  ethicalConsiderations: string
  changelog?: Array<{ version: string; date: string; note: string }>
}

export interface ModelCardOutput {
  markdown: string
  json: Record<string, unknown>
}
```

## Markdown 섹션 (한국어)

```
# 모델 카드 — {name} v{version}

## 1. 개요
## 2. 목적
## 3. 학습 데이터
## 4. 평가 지표
## 5. 한계
## 6. 윤리적 고려사항
## 7. 소유자
## 8. 변경 이력
```

## API

```ts
class ModelCardGenerator {
  build(meta: ModelCardMeta, grade?: DataGrade): ModelCardOutput
  validateChecklist(output: ModelCardOutput): boolean
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 필수 필드 누락 → `missing_field`
- version 형식 위반 → `invalid_version`
- C/S 등급 → `grade_blocked`
