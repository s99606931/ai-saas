# SVC-AI-ADV-R42 — 설계

## 모듈
- prompt-optimizer.ts: 메트릭 기반 반복 최적화 루프
- dspy-compiler.ts: DSPy 스타일 시그니처 컴파일러 (기본형/Chain of Thought/few-shot)

## 흐름
```
초기 프롬프트 + 트레이닝 셋
→ Compiler.compile (시그니처 → 후보 프롬프트 N개)
→ for each candidate:
    실행 → 정확도/비용/레이턴시 측정
→ 파레토 최적 선택
→ 베스트 후보 반환 (메트릭과 함께)
```

## 인터페이스
```typescript
interface PromptCandidate { text: string; fewShots: Example[] }
interface Metrics { accuracy: number; costUSD: number; latencyMs: number }
class PromptOptimizer {
  optimize(initial: string, dataset: Example[], opts: OptimizeOptions): Promise<OptimizationResult>
}
class DSPyCompiler {
  compile(signature: string, dataset: Example[]): PromptCandidate[]
}
```

## 보안
- 데이터셋 등급 검증 (O만 허용)
- 시드 PII 마스킹 필수
