# SVC-AI-ADV-R645 Design — AI기반 장애 대응 플레이북 자동 생성 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R645.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/incident-playbook-generator-v2.ts |

## 설계 결정
- 클래스 기반 단일 모듈 (IncidentPlaybookGeneratorV2)
- 장애유형 Map<incidentType, { severity }>, 단계 Map<incidentType, Step[]>
- 총 단계 수 = steps.length
- 단계 부족 기준: steps.length < threshold
- C/S 등급 즉시 throw (N2SF N-05)
- getAuditLog(): shallow copy

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
