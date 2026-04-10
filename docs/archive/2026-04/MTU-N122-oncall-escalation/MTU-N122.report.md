# MTU-N122: 온콜 로테이션 및 에스컬레이션 관리 -- 완료 보고서

> 작성일: 2026-04-10 | matchRate: 100% | 테스트: 41/41

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 온콜 로테이션 자동 관리 + 에스컬레이션 정책 | 100% |
| 기술 | ConfigMap 기반 스케줄 + 조회 스크립트 | 100% |
| 보안 | CSAP D-06 감사 추적 | 100% |
| 운영 | 5개 팀 온콜 관리 + E2E 테스트 41항목 | 100% |

## 산출물

| FR ID | 산출물 | 경로 | 상태 |
|-------|--------|------|------|
| FR-N122.1 | 온콜 스케줄 ConfigMap | `infra/monitoring/oncall-schedule.yaml` | 완료 |
| FR-N122.2 | 에스컬레이션 정책 문서 | `docs/operations/escalation-policy.md` | 완료 |
| FR-N122.3 | 핸드오프 체크리스트 | `docs/operations/oncall-handoff-checklist.md` | 완료 |
| FR-N122.4 | AlertManager 연동 설정 | ConfigMap에 포함 | 완료 |
| FR-N122.5 | 현황 조회 스크립트 | `scripts/oncall-status.sh` | 완료 |
| FR-N122.6 | E2E 테스트 | `scripts/test-oncall-escalation.sh` | 41/41 통과 |

## 주요 구현 내용

1. **온콜 ConfigMap**: 5개 팀(SRE, 보안, DevOps, DBA, 인프라)의 주간 로테이션 스케줄
2. **에스컬레이션 정책**: P1~P4 심각도별 시간 기반 에스컬레이션 단계 정의
3. **핸드오프 체크리스트**: 퇴임/신임 온콜 담당자 인수인계 절차 14개 항목
4. **조회 스크립트**: 현황, 다음 주, 에스컬레이션 정책, 로테이션 실행 4가지 모드
