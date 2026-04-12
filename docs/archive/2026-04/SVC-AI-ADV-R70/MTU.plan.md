# SVC-AI-ADV-R70 — Cost-Aware Batch Scheduler

> 2026-04-12 | v1.0.0 | PM Lead (4차 세션)

## Executive Summary
| 관점 | 목표 | 지표 |
|---|---|---|
| 비즈니스 | AI 배치 작업 비용 30% 절감 | 최적 타이밍 자동 |
| 기술 | 시간대별 가격/부하 기반 스케줄링 | p95 배치 지연 허용 내 |
| 보안 | 배치 데이터 등급 guard | N2SF N-05 |
| 규정 | 스케줄 이력 감사 | 100% |

## Context Anchor
- **WHY**: 외부 LLM API는 시간대/모델에 따라 비용과 쓰루풋이 크게 달라, 단순 FIFO는 비용 손실이 큼.
- **WHO**: AI 플랫폼 운영자, 재무, 감리
- **RISK**: 마감 기한 초과, 등급 위반
- **SUCCESS**: 비용 30% 이상 절감 시뮬레이션, 마감 내 완료율 99%
- **SCOPE**: IN — Job 등록/가격 표/마감 기한/최적 슬롯 선택/실행 훅 / OUT — 실제 API 호출

## FR
| FR | 제목 | 산출물 |
|---|---|---|
| FR-R70.1 | Job 등록 + 등급 검증 + 마감 기한 | cost-aware-batch-scheduler.ts |
| FR-R70.2 | 시간대별 가격표 (pricing profile) | cost-aware-batch-scheduler.ts |
| FR-R70.3 | 최적 슬롯 선택 (비용 + 마감 기한) | cost-aware-batch-scheduler.ts |
| FR-R70.4 | 실행 훅 + 실패 재시도 | cost-aware-batch-scheduler.ts |
| FR-R70.5 | getAuditLog + 비용 리포트 | cost-aware-batch-scheduler.ts |

## 추적성
| FR | 산출물 | 테스트 | CSAP |
|---|---|---|---|
| FR-R70.1 | cost-aware-batch-scheduler.ts | cost-aware-batch-scheduler.test.ts | N-05 |
| FR-R70.2 | cost-aware-batch-scheduler.ts | cost-aware-batch-scheduler.test.ts | - |
| FR-R70.3 | cost-aware-batch-scheduler.ts | cost-aware-batch-scheduler.test.ts | - |
| FR-R70.4 | cost-aware-batch-scheduler.ts | cost-aware-batch-scheduler.test.ts | - |
| FR-R70.5 | cost-aware-batch-scheduler.ts | cost-aware-batch-scheduler.test.ts | D-06 |
