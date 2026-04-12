# SVC-TRACECTX-R45 Analysis

| 항목 | 값 |
|------|-----|
| MTU | SVC-TRACECTX-R45 |
| 일자 | 2026-04-11 |
| matchRate | 100% |

## Plan↔Design↔Code

| FR | 구현 | 테스트 | 상태 |
|----|------|--------|------|
| FR-TC.1 | `trace-id.ts::parseTraceparent` | 5 케이스 (정상/부족/길이/zero×2) | ✅ |
| FR-TC.2 | `trace-id.ts::buildTraceparent` | build↔parse 재검증 + 에러 | ✅ |
| FR-TC.3 | `trace-id.ts::generateTraceId/SpanId` | 길이, 고유성(1000) | ✅ |
| FR-TC.4 | `span.ts::withSpan` | 정상/에러/rethrow | ✅ |
| FR-TC.5 | `span.ts::NoopSpanAdapter` | 폴백 동작 | ✅ |
| FR-TC.6 | `attributes.ts::sanitizeAttributes` | 민감키 제거/길이/객체직렬화 | ✅ |
| FR-TC.7 | `context.ts::getCurrentTraceId` | 컨텍스트 외부 undefined | ✅ |
| FR-TC.8 | `context.ts::runWithContext` | 중첩 비동기 전파 | ✅ |

## 테스트 결과

```
Test Files  1 passed (1)
Tests       21 passed (21)
Duration    565ms
```

## Q-Gate
G1(8/8) G2 G3 G4(21 tests) G5 G6 G7 모두 통과.
