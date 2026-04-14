# SVC-AI-ADV-R616 Design — AI기반 민원인 여정 최적화 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R616.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/ |

## 설계 결정
- 세션 단위: citizenId+journeyId → 단계별 시작/종료/이탈 플래그
- dropRate = dropCount/totalCount
- avgDuration = completed 세션 단계 평균
- dropRate>0.3 또는 avgDuration>기준×1.5 → 병목
- 제안: 병목 단계에 "단계 단순화" 또는 "자동화 검토"

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
