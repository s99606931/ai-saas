# SVC-DATAMASK-R47 Analysis

| 항목 | 값 |
|------|-----|
| MTU | SVC-DATAMASK-R47 |
| 일자 | 2026-04-11 |
| matchRate | 100% |
| 테스트 | 33/33 |

## FR 매핑

| FR | 모듈 | 테스트 | 상태 |
|----|------|--------|------|
| FR-DM.1 SSN | string-masker, pii-patterns | 4 | ✅ |
| FR-DM.2 Phone/Landline | string-masker | 3 | ✅ |
| FR-DM.3 Email | string-masker | 2 | ✅ |
| FR-DM.4 Card+Luhn | string-masker, pii-patterns | 3 | ✅ |
| FR-DM.5 Account | string-masker | 1 | ✅ |
| FR-DM.6 Address | pii-patterns | 2 | ✅ |
| FR-DM.7 Tree | tree-masker | 6 | ✅ |
| FR-DM.8 Key Policy | key-policy | 3 | ✅ |
| FR-DM.9 enforceGrade | enforcer | 4 | ✅ |
| FR-DM.10 onMask hook | string-masker | 2 | ✅ |
| 정확도 | 통합 | 3 | ✅ |

## Q-Gate

G1(10/10) G2 G3 G4(33 tests) G5(false positive 검증) G6(D-09, N2SF N-05) G7 통과.

## Key Findings (Iteration 1)

- Luhn 실패 카드(예: 1234-5678-9012-3456)가 계좌 패턴에 부분 매칭되어 잘못 마스킹됨
- 해결: Luhn 실패 카드를 sentinel(`\u0000CARDn\u0000`)로 일시 보호 후, 모든 패턴 처리 완료 시 복원
- 결과: 카드 패턴은 Luhn 통과 시 마스킹, 실패 시 원본 보존 — 두 경우 모두 계좌 패턴 간섭 없음
