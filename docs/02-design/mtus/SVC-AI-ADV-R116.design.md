# SVC-AI-ADV-R116 — Streaming Response Assembler Design

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R116.plan.md

## 아키텍처

```
feed(token) → buffer accumulator
            → tryParse(partial JSON)
            → PII scan(mask)
            → emit onPartial / onComplete
```

## 타입

```typescript
export enum DataGrade { C = 'C', S = 'S', O = 'O' }

export interface AssemblerOptions {
  grade?: DataGrade
  onPartial?: (partial: unknown) => void
  onComplete?: (final: unknown) => void
  onError?: (err: Error) => void
  maskPII?: boolean
}

export interface AssemblerState {
  tokensReceived: number
  bytesReceived: number
  partialParses: number
  complete: boolean
  failed: boolean
}
```

## 점진적 JSON 파서

- 버퍼에 중괄호/대괄호 균형 카운트
- 불완전 구간은 잘라서 복구 시도 (trailing comma 제거, 미종료 문자열 보완)
- 성공 시 onPartial 발행

## PII 마스킹

- 이메일: `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g` → `[EMAIL]`
- 주민번호: `/\b\d{6}[-]?\d{7}\b/g` → `[RRN]`
- 전화번호: `/\b01[0-9]-\d{3,4}-\d{4}\b/g` → `[PHONE]`

## 보안

- C/S 등급 차단
- 모든 feed/complete 이벤트 audit

## Session Guide

1. 타입 + 상태 머신
2. feed + PII mask
3. tryParse(부분 JSON) 로직
4. onPartial/onComplete 발행
5. guard + audit + 10 test
