# MTU-N124: 플랫폼 상태 페이지 자동 생성 -- 설계 문서

> 작성일: 2026-04-10 | 버전: 1.0.0

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | 셸 스크립트 + Prometheus API + Markdown 생성 |
| 의존성 | Prometheus, service-topology, 인시던트 분류 규칙 |
| 산출물 | 상태 페이지 스크립트, PrometheusRule, E2E 테스트 |

## 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| 상태 페이지 생성 | `scripts/generate-status-page.sh` | 서비스 상태 집계 + 페이지 생성 |
| PrometheusRule | `infra/monitoring/status-page-rules.yaml` | 상태 집계 Recording Rule |
| E2E 테스트 | `scripts/test-status-page.sh` | 검증 |
