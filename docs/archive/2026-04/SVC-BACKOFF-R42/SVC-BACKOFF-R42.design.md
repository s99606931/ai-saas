# SVC-BACKOFF-R42 DESIGN: Exponential Backoff

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 공식

```
base delay = baseMs * (factor ^ attempt)
capped = min(delay, maxDelayMs)
jittered = applyJitter(capped, strategy, prev)
```

## Jitter 전략
- `none`: delay 그대로
- `full`: random(0, delay)
- `equal`: delay/2 + random(0, delay/2)
- `decorrelated`: random(baseMs, prev*3)

## Session Guide
- `src/backoff.ts` → `src/index.ts` → `tests/backoff.test.ts`
