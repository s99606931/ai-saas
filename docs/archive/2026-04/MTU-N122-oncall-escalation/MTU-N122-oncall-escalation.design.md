# MTU-N122: 온콜 로테이션 및 에스컬레이션 관리 -- 설계 문서

> 작성일: 2026-04-10 | 버전: 1.0.0
> Plan Ref: docs/01-plan/mtus/MTU-N122-oncall-escalation.plan.md

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | ConfigMap 기반 온콜 스케줄 + AlertManager 라우팅 연동 |
| 의존성 | AlertManager, kube-prometheus-stack, 인시던트 관리 프로세스 |
| 산출물 | ConfigMap, 에스컬레이션 정책 문서, 핸드오프 체크리스트, 조회 스크립트, 테스트 |

## 1. 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| 온콜 스케줄 ConfigMap | `infra/monitoring/oncall-schedule.yaml` | 팀/개인별 온콜 로테이션 정의 |
| 에스컬레이션 정책 | `docs/operations/escalation-policy.md` | P1~P4 시간 기반 에스컬레이션 |
| 핸드오프 체크리스트 | `docs/operations/oncall-handoff-checklist.md` | 교대 시 인수인계 절차 |
| 현황 조회 스크립트 | `scripts/oncall-status.sh` | 현재 온콜 담당자 조회 |
| E2E 테스트 | `scripts/test-oncall-escalation.sh` | 전체 기능 검증 |
