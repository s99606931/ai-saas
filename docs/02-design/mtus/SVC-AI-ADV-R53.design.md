# SVC-AI-ADV-R53 — Self-Correction Loop Design

> 2026-04-12 | v1.0.0

## 1. 개요
LLM 응답의 품질을 자기 비평+수정 루프로 개선합니다. Reflexion 패턴을 단순화한 형태입니다.

## 2. 흐름
```
[Input Query] → [Generate Initial Response]
                       ↓
                 [Critique]  ← (issues 추출)
                       ↓
              [issues empty?] —Yes→ [Final Output]
                       ↓ No
                 [Revise]
                       ↓
              [iter < maxIter?] —Yes→ Critique 재호출
                       ↓ No
                 [Final Output]
```

## 3. 인터페이스
```typescript
export interface CritiqueResult {
  issues: string[];
  severity: 'low' | 'medium' | 'high';
}

export type GenerateFn = (query: string) => Promise<string>;
export type CritiqueFn = (query: string, response: string) => Promise<CritiqueResult>;
export type ReviseFn = (query: string, response: string, critique: CritiqueResult) => Promise<string>;
```

## 4. 수렴 조건
- issues 배열 비어있음
- severity가 'low'이고 반복 횟수 충분
- maxIter 도달

## 5. 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
