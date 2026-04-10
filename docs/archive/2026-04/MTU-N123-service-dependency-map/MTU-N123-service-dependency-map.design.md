# MTU-N123: 서비스 의존성 자동 탐지 -- 설계 문서

> 작성일: 2026-04-10 | 버전: 1.0.0
> Plan Ref: docs/01-plan/mtus/MTU-N123-service-dependency-map.plan.md

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | YAML 선언적 의존성 정의 + CLI 조회 + Grafana 대시보드 |
| 의존성 | k8s Service, Prometheus, Linkerd |
| 산출물 | 의존성 정의 파일, CLI 스크립트, 대시보드, 영향 분석 스크립트, 테스트 |

## 1. 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| 의존성 정의 | `infra/service-dependency/topology.yaml` | 서비스 간 의존성 선언 |
| 의존성 조회 CLI | `scripts/service-topology.sh` | 의존성 조회 및 영향 분석 |
| 토폴로지 대시보드 | `infra/monitoring/dashboards/service-topology.json` | Grafana 시각화 |
| E2E 테스트 | `scripts/test-service-topology.sh` | 기능 검증 |
