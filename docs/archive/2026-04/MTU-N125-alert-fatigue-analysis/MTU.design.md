# MTU-N125: 알림 피로도 분석 -- 설계 문서

> 작성일: 2026-04-10

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | 셸 스크립트 + Prometheus API + Recording Rule |
| 의존성 | ALERTS 메트릭, alertmanager-noise-reduction.yaml |
| 산출물 | 분석 스크립트, Recording Rule, E2E 테스트 |

## 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| 피로도 분석 스크립트 | `scripts/analyze-alert-fatigue.sh` | 피로도 지표 계산 + 보고서 생성 |
| Recording Rule | `infra/monitoring/alert-fatigue-rules.yaml` | 피로도 메트릭 사전 계산 |
| E2E 테스트 | `scripts/test-alert-fatigue.sh` | 검증 |
