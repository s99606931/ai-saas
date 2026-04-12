# SVC-AI-ADV-R81 — Speculative Decoding 가속화 엔진 (Design)

> v1.0.0 | 2026-04-12

## 모듈
- `speculative-decode-accelerator.ts`
- `SpeculativeDecodeAccelerator` 클래스

## 인터페이스
```ts
DraftFn: (ctx, k) => Promise<string[]>
VerifyFn: (ctx, candidates) => Promise<number>  // 수락된 토큰 수 반환
SpeculativeConfig: { initialK, minK, maxK, emaAlpha, targetRate }
```

## 알고리즘
1. draft(ctx, k) → k 후보
2. verify(ctx, candidates) → 수락 수 m
3. EMA 갱신: r = (1-α)r + α(m/k)
4. r < target*0.7 → k--, r > target*1.1 → k++
5. m == 0 → fallback verify 단독
6. 토큰 수 또는 stopToken 시 종료

## 차별화
- 기존 `speculative-router.ts`: 요청 단위 모델 라우팅
- 본 모듈: **토큰 단위** speculative decoding

## Session Guide
- 구현: `platform/services/ai-service/src/lib/speculative-decode-accelerator.ts`
- 테스트: `__tests__/speculative-decode-accelerator.test.ts`
- Plan SC: FR-R81.1~5
