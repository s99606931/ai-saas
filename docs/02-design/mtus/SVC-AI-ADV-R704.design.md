# SVC-AI-ADV-R704 Design — AI기반 민원인 서비스 개인화 v4

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R704.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, citizenId sha256 16자 마스킹, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/citizen-service-personalizer-v4.ts |

## 설계 결정
- `CitizenServicePersonalizerV4` 클래스
- 카탈로그: Map<serviceId, Set<tag>>
- 프로파일: Map<maskedCitizenId, { interests: Set<tag>, dislikes: Set<serviceId>, likes: Map<serviceId, number> }>
- 추천 점수 = |tag 교집합| + likes[service]||0, dislike 서비스는 제외
- 감사 로그는 마스킹 ID만 저장

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
