# MTU-N123: 서비스 의존성 자동 탐지 -- 완료 보고서

> 작성일: 2026-04-10 | matchRate: 100% | 테스트: 38/38

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 서비스 의존성 자동 탐지 + 장애 영향 분석 | 100% |
| 기술 | 14개 서비스, 20개 의존성, 5계층 토폴로지 | 100% |
| 보안 | CSAP D-06 장애 영향 분석 | 100% |
| 운영 | CLI 스크립트 + Grafana 대시보드 + E2E 테스트 38항목 | 100% |

## 산출물

| FR ID | 산출물 | 경로 | 상태 |
|-------|--------|------|------|
| FR-N123.1 | 의존성 정의 ConfigMap | `infra/service-dependency/topology.yaml` | 완료 |
| FR-N123.2 | 의존성 조회 CLI | `scripts/service-topology.sh` | 완료 |
| FR-N123.3 | Grafana 토폴로지 대시보드 | `infra/monitoring/dashboards/service-topology.json` | 완료 |
| FR-N123.4 | 장애 영향 분석 (blast radius) | 스크립트에 포함 (--blast) | 완료 |
| FR-N123.5 | E2E 테스트 | `scripts/test-service-topology.sh` | 38/38 통과 |

## 주요 구현 내용

1. **서비스 토폴로지**: 14개 서비스, 5계층(Gateway/Core/Data/Infra/Monitoring), 20개 의존성 관계 선언적 관리
2. **CLI 스크립트 6개 모드**: list(목록), deps(의존성), blast(영향분석), tier(계층), critical(SPOF), summary(통계)
3. **SPOF 분석**: postgresql이 8개 서비스가 의존하는 핵심 SPOF로 식별
4. **Grafana 대시보드**: 서비스 상태, 에러율, P99 지연, Linkerd 트래픽 시각화
