# SVC-OUTBOX-R43 Plan: Transactional Outbox

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## WHY
DB 트랜잭션과 이벤트 발행의 원자성을 보장(at-least-once). 이중 쓰기 문제(dual-write problem) 해결.

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-OB.1 | 이벤트 append (pending 상태) | P0 |
| FR-OB.2 | 미발행 이벤트 조회 (fetchPending) | P0 |
| FR-OB.3 | 발행 완료 마킹 (markPublished) | P0 |
| FR-OB.4 | 발행 실패 재시도 카운트 관리 | P0 |
| FR-OB.5 | 최대 재시도 초과 시 dead-letter | P1 |
| FR-OB.6 | 저장소 추상화 (메모리/DB 어댑터) | P1 |

## CSAP/N2SF
- CSAP D-06: 감사 (이벤트 전수 보존)
- CSAP D-14: 가용성 (at-least-once 보장)
