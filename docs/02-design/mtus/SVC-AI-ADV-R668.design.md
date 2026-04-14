# SVC-AI-ADV-R668 Design — AI기반 민원인 역량 강화 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R668.1~5 구현 |
| 보안 | N2SF N-05 차단, citizenId SHA-256, CSAP D-06 감사 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/citizen-empowerment-ai-v2.ts |

## 설계 결정
- `CitizenEmpowermentAIV2` 클래스
- `assess({citizenId, deviceUsage, onlineFreq, errorRate}, dataGrade?)`
- score = 100 × (0.4·deviceUsage + 0.4·onlineFreq + 0.2·(1-errorRate)) (0~1 입력)
- ≥80 ADVANCED, ≥50 INTERMEDIATE, 그 외 BEGINNER
- 추천 콘텐츠 매핑 테이블

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
