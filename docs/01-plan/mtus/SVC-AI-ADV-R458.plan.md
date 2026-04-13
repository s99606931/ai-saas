# SVC-AI-ADV-R458 Plan — 공공기관 AI 준비도 평가

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공기관 AI 도입 준비도 자동 진단 |
| WHO | 디지털플랫폼정부위원회, 공공기관 CIO |
| WHAT | 4영역 설문 → 준비도 점수 |
| HOW | 영역별 평균 + 가중합 |

## Context Anchor
- WHY: AI 도입 전 역량 진단 필수
- WHO: 기관 담당자
- RISK: 주관 평가 편향 → 세부 체크리스트
- SUCCESS: 4단계 등급 부여
- SCOPE: `public-sector-ai-readiness.ts`

## 요구사항
- FR-458.1: Assessment = { data:0-5, infra:0-5, talent:0-5, governance:0-5 }
- FR-458.2: 가중치 — data 0.3, infra 0.25, talent 0.25, governance 0.2
- FR-458.3: score = Σ(value * weight) / 5 (0~1 정규화)
- FR-458.4: 등급 — ≥0.8 ADVANCED, ≥0.6 PROGRESSING, ≥0.4 EMERGING, else INITIAL
- FR-458.5: 최저 점수 영역 = 개선 권고 대상
- FR-458.6: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-458.* ↔ `public-sector-ai-readiness.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
