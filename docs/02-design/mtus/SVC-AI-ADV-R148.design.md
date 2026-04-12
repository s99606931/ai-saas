# MTU Design — SVC-AI-ADV-R148 Prompt Injection Defender v2

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R148.plan.md

## 아키텍처: 3-Layer Defense + Nonce Boundary

기존 단일 패턴 매칭이 아닌 **컨텍스트 분리 + 다층 검증** 방식.

```
input → Layer1(delimiter) → Layer2(keyword) → Layer3(control char)
      → riskScore 누적
      → buildProtectedPrompt(nonce 경계)
```

## 타입

```ts
export interface PromptSections {
  system: string
  user: string
  context?: string
}

export interface LayerViolation {
  layer: 1 | 2 | 3
  rule: string
  section: 'system' | 'user' | 'context'
  score: number
}

export interface DefendResult {
  allowed: boolean
  layers: LayerViolation[]
  sanitized: PromptSections
  riskScore: number
  nonceBoundary?: string
}
```

## 규칙

- **Layer 1 (delimiter)**: `<<SYS>>`, `[[USER]]`, `###SYSTEM`, `<|im_start|>`, `</s>` 발견 시 제거 + score +0.4
- **Layer 2 (keyword)**: `ignore previous`, `disregard instructions`, `reveal (system )?prompt`, `이전 지시 무시`, `시스템 프롬프트` → +0.5
- **Layer 3 (control)**: `\u200b`(zero-width), `\u200c`, `\u200d`, `\ufeff`, ASCII 0~8/11/12/14~31 → +0.3

## 판정

- `riskScore >= 0.5` 시 `allowed=false`
- sanitized: 제거된 토큰 replace('')
- nonceBoundary: `hex 16자` 랜덤 (충돌 검증용)

## API

```ts
class PromptInjectionDefenderV2 {
  defend(sections: PromptSections, grade?: DataGrade): DefendResult
  buildProtectedPrompt(sections: PromptSections, grade?: DataGrade): string
  getAuditLog(): AuditEntry[]
}
```

## 예외

- 빈 system/user: `invalid_input`
- C/S등급: `grade_blocked`
