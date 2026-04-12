# SVC-EVENTSCHEMA-R48 Analysis

| 항목 | 값 |
|------|-----|
| MTU | SVC-EVENTSCHEMA-R48 |
| 일자 | 2026-04-11 |
| matchRate | 100% |
| 테스트 | 26/26 |

## FR 매핑

| FR | 모듈 | 테스트 | 상태 |
|----|------|--------|------|
| FR-ESR.1 register | registry.ts | 3 | ✅ |
| FR-ESR.2 semver | semver.ts | 5 | ✅ |
| FR-ESR.3 validate | schema-validator.ts | 8 | ✅ |
| FR-ESR.4 호환성 | compatibility.ts | 5 | ✅ |
| FR-ESR.5 latest | registry.ts | 2 | ✅ |
| FR-ESR.6 listEvents | registry.ts | 1 | ✅ |
| FR-ESR.7 path 포함 에러 | schema-validator.ts | 검증됨 | ✅ |
| FR-ESR.8 strict/lenient | registry.ts | 2 | ✅ |

## Q-Gate

G1(8/8) G2 G3 G4(26 tests > 22 계획) G5 G6 G7 통과.
