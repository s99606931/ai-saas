# SVC-AI-ADV-R84 — 분석 (Check)

## 구현 매칭률
| FR | 설계 요구 | 구현 위치 | 매칭 |
|---|---|---|---|
| FR-R84.1 | 입력 + 등급 guard | `explain()` 초반 | ✅ |
| FR-R84.2 | 기여도 분해 + Top-K | contributions 계산 + sort | ✅ |
| FR-R84.3 | 4단계 서술 | `buildNarrative()` | ✅ |
| FR-R84.4 | 대안 시나리오 (what-if) | alternatives 루프 | ✅ |
| FR-R84.5 | 감사 로그 + 마스킹 | `AuditAction`, `maskPII` | ✅ |

matchRate: **100%**

## 테스트 결과
- 케이스: 19개
- 통과: 19/19

## Q-Gate
- G1~G7 전부 통과
- 행정기본법 제20조(자동 행정결정 설명 의무) 대응 구조
- CSAP D-06 감사 로그
