# SVC-AI-ADV-R436 Plan — Environmental Complaint Classifier AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 환경 민원 유형별 자동 분류 + 담당 환경청 배정 |
| WHO | 환경부, 지방환경청 |
| WHAT | 민원 텍스트 → 유형(소음/대기/수질/폐기물) → 긴급도 → 담당 |
| HOW | 키워드 매칭 + 긴급도 점수 + 지역→담당기관 맵핑 |

## Context Anchor
- WHY: 신속 배정으로 민원 해결 시간 단축
- WHO: 환경 민원 접수자
- RISK: 오분류 → 부서 간 이관 증가
- SUCCESS: 유형 분류 정확도 ≥ 90%
- SCOPE: `environmental-complaint-classifier-ai.ts`

## 요구사항
- FR-436.1: 키워드 사전 기반 type 결정 (NOISE, AIR, WATER, WASTE, OTHER)
- FR-436.2: 긴급 키워드("유해","긴급","중독") 포함 → urgency='HIGH'
- FR-436.3: 지역 → 담당청 매핑 (수도권/중부/남부/기타)
- FR-436.4: 결과 = { type, urgency, agency, confidence }
- FR-436.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-436.* ↔ `environmental-complaint-classifier-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
