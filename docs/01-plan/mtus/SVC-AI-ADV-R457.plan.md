# SVC-AI-ADV-R457 Plan — 민원 자동 해결 제안 AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 접수 민원에 대해 FAQ 매칭 + 유사 판례 자동 제안 |
| WHO | 민원 담당 부서 |
| WHAT | 민원 텍스트 → 해결 제안 |
| HOW | 키워드 매칭 + 유사도 |

## Context Anchor
- WHY: 민원 처리 시간 단축
- WHO: 민원 상담사
- RISK: 잘못된 FAQ 매칭 → 최소 유사도 임계치
- SUCCESS: 매칭된 FAQ top-1 반환
- SCOPE: `citizen-complaint-resolver-ai.ts`

## 요구사항
- FR-457.1: FAQ = { id, keywords: string[], solution }
- FR-457.2: 매칭 점수 = (complaint 내 등장 keyword 수) / (전체 keywords 수)
- FR-457.3: score ≥ 0.5인 FAQ 중 최고점 1개 반환
- FR-457.4: 매칭 실패 → { matched: false, recommendation: 'HUMAN_REVIEW' }
- FR-457.5: 민원 텍스트 소문자화 + 공백 분리 키워드 비교
- FR-457.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-457.* ↔ `citizen-complaint-resolver-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
