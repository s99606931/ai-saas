# SVC-AI-ADV-R447 Plan — 시민 권리 침해 감지 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 민원 내용에서 기본권 침해 패턴 자동 식별 |
| WHO | 국가인권위, 민원 접수처 |
| WHAT | 민원 텍스트 → 침해 유형 + 심각도 |
| HOW | 키워드 사전 + 문맥 가중치 |

## Context Anchor
- WHY: 권리 침해 조기 대응
- WHO: 인권 조사관
- RISK: 오분류 → 사람 검수 필수
- SUCCESS: 주요 8대 인권 침해 패턴 식별
- SCOPE: `citizen-rights-violation-detector-ai.ts`

## 요구사항
- FR-447.1: 입력 = 민원 텍스트
- FR-447.2: 유형 사전 = { PRIVACY: [개인정보, 유출, 도청], DISCRIMINATION: [차별, 배제, 혐오], LABOR: [강요, 해고, 임금], FREEDOM: [감시, 검열, 통제] }
- FR-447.3: 각 유형 hits 계산, max hits → primaryType
- FR-447.4: severity: hits≥3 HIGH, ≥1 MED, 0 NONE
- FR-447.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-447.* ↔ `citizen-rights-violation-detector-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
