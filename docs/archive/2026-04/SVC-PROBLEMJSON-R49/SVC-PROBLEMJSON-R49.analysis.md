# SVC-PROBLEMJSON-R49 Analysis

| 항목 | 값 |
|------|-----|
| 일자 | 2026-04-11 |
| matchRate | 100% |
| 테스트 | 29/29 |

## FR 매핑

| FR | 모듈 | 테스트 | 상태 |
|----|------|--------|------|
| FR-PD.1 ProblemDetails 인터페이스 | types.ts | export 검증 | ✅ |
| FR-PD.2 problem 빌더 | builder.ts | 6 | ✅ |
| FR-PD.3 16종 preset | presets.ts | 17 (16 cases + count) | ✅ |
| FR-PD.4 withTraceId | builder.ts | 1 | ✅ |
| FR-PD.5 withErrors | builder.ts | 1 | ✅ |
| FR-PD.6 sanitize | sanitize.ts | 3 | ✅ |
| FR-PD.7 extension | builder.ts | 검증됨 | ✅ |
| FR-PD.8 type URI | presets.ts | 1 | ✅ |

## Q-Gate
G1(8/8) G2 G3 G4(29 tests > 18 계획) G5(production sanitize) G6 G7 통과.
