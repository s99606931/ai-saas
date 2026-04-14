# SVC-AI-ADV-R697 Design — AI기반 장애 상관관계 분석 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R697.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, PII sha256 마스킹, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/incident-correlation-ai-v3.ts |

## 설계 결정
- `IncidentCorrelationAIV3` 클래스
- `registerIncident(inc)`, `addEvent(ev, grade)`: C/S 차단
- 상관점수 = sameService(1 or 0)*0.5 + within5min(1 or 0)*0.3 + min(severityDelta/5,1)*0.2
- ≥ 0.8 ROOT_CAUSE / ≥ 0.5 RELATED / UNRELATED
- responderId sha256 16자 마스킹

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
