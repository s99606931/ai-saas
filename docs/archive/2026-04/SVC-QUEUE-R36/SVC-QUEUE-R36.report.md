# SVC-QUEUE-R36 REPORT: Task Queue

> 완료일: 2026-04-12 | matchRate: 100% | 테스트: 11/11 passed

## Executive Summary

| 관점 | 결과 |
|------|------|
| 기능 | 동시성 제한 + 우선순위 큐 + idle 대기 |
| 품질 | 11개 테스트 통과 |
| 보안 | CSAP D-14 가용성 (리소스 폭주 방지) |

## Success Criteria
| FR ID | 요구사항 | 상태 |
|-------|---------|------|
| FR-TQ.1 | 동시성 제한 | 완료 |
| FR-TQ.2 | 작업 결과 Promise | 완료 |
| FR-TQ.3 | 우선순위 스케줄링 | 완료 |
| FR-TQ.4 | 작업 취소 | 완료 |
| FR-TQ.5 | 상태 조회 (size, pending) | 완료 |
| FR-TQ.6 | idle() 대기 | 완료 |

## Key Decisions
- 정렬 삽입(insertion sort) — 소규모 큐에 O(n) 적합
- 실행 중 작업은 clear() 영향 없음 (graceful)
- setConcurrency로 런타임 한도 조정 가능
