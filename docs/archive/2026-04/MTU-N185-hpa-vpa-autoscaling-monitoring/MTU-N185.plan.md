# MTU-N185: HPA/VPA 오토스케일링 모니터링 — Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 오토스케일링 이벤트 가시성 확보로 SLA 위반 사전 방지 |
| 기술 | HPA/VPA 스케일링 이벤트·효율성·안정성 메트릭 수집 및 알림 |
| 보안 | CSAP D-06 감사 로깅, D-10 서비스 가용성 모니터링 |
| 운영 | 스케일링 빈도·실패·지연 자동 감지로 운영 부담 경감 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 VPA 알림(MTU-N72)과 KEDA 대시보드(MTU-N113)는 개별 존재하나, HPA/VPA 통합 스케일링 이벤트 추적·효율성 분석·안정성 알림이 부재 |
| WHO | SRE 팀, 인프라 운영자, 테넌트 관리자 |
| RISK | 스케일링 실패 미감지 시 서비스 장애, 과도한 스케일링으로 비용 폭증 |
| SUCCESS | HPA/VPA 통합 모니터링으로 스케일링 이벤트 100% 추적, 효율성 대시보드 구축 |
| SCOPE | PrometheusRule + Recording Rules + Grafana 대시보드 + E2E 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N185.1 | HPA 스케일링 이벤트(스케일업/다운) recording rule 생성 | P0 | D-10 |
| FR-N185.2 | HPA 스케일링 실패·지연 알림 규칙 (currentReplicas != desiredReplicas 지속) | P0 | D-06 |
| FR-N185.3 | VPA 권고 적용률 recording rule (권고 vs 실제 request 비율) | P0 | D-12 |
| FR-N185.4 | HPA/VPA 통합 효율성 대시보드 (Grafana JSON) | P0 | D-10 |
| FR-N185.5 | 스케일링 Flapping 감지 알림 (짧은 시간 반복 스케일링) | P1 | D-06 |
| FR-N185.6 | HPA 타겟 메트릭 달성률 recording rule | P1 | D-10 |
| FR-N185.7 | E2E 테스트 스크립트 (YAML 유효성 + PromQL 문법) | P0 | D-12 |

## 추적성 매트릭스

| FR ID | Design 섹션 | 산출물 | 테스트 | CSAP |
|-------|------------|--------|--------|------|
| FR-N185.1 | DS-N185.1 | hpa-vpa-autoscaling-rules.yaml | TC-N185.1 | D-10-03 |
| FR-N185.2 | DS-N185.2 | hpa-vpa-autoscaling-rules.yaml | TC-N185.2 | D-06-02 |
| FR-N185.3 | DS-N185.3 | hpa-vpa-autoscaling-rules.yaml | TC-N185.3 | D-12-07 |
| FR-N185.4 | DS-N185.4 | hpa-vpa-autoscaling.json | TC-N185.4 | D-10-03 |
| FR-N185.5 | DS-N185.5 | hpa-vpa-autoscaling-rules.yaml | TC-N185.5 | D-06-02 |
| FR-N185.6 | DS-N185.6 | hpa-vpa-autoscaling-rules.yaml | TC-N185.6 | D-10-03 |
| FR-N185.7 | DS-N185.7 | test-mtu-n185.sh | TC-N185.7 | D-12-05 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PrometheusRule (Recording + Alerting) | infra/monitoring/hpa-vpa-autoscaling-rules.yaml |
| 2 | Grafana 대시보드 | infra/monitoring/dashboards/hpa-vpa-autoscaling.json |
| 3 | E2E 테스트 | tests/monitoring/test-mtu-n185-hpa-vpa-autoscaling.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
