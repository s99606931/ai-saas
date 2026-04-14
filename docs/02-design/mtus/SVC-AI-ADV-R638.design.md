# SVC-AI-ADV-R638 Design — AI기반 공공 클라우드 비용 배분 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R638.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/public-cloud-cost-allocator-v2.ts |

## 설계 결정
- 클래스 기반 단일 모듈 (PublicCloudCostAllocatorV2)
- 부서 Map<deptId, { budget }>, 사용량 Map<deptId, amount[]>
- 배분 금액 = 합산 사용량
- 초과 사용 = 합산 > budget 인 부서 반환
- C/S 등급 즉시 throw (N2SF N-05)
- getAuditLog(): shallow copy

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
