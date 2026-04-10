# MTU-N186: 스토리지 I/O 모니터링 — Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 디스크 I/O 병목 사전 감지로 데이터베이스/스토리지 서비스 SLA 보장 |
| 기술 | 노드·PVC·컨테이너 레벨 IOPS, 레이턴시, 처리량 메트릭 수집 및 알림 |
| 보안 | CSAP D-06 감사 로깅, D-10 서비스 가용성 모니터링 |
| 운영 | I/O 포화·지연 자동 감지로 스토리지 장애 사전 대응 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | PVC 용량 모니터링(MTU-N173)은 존재하나 I/O 성능(IOPS/레이턴시/처리량) 전용 모니터링 부재 |
| WHO | SRE 팀, DBA, 인프라 운영자 |
| RISK | I/O 병목 미감지 시 DB 응답 지연, 서비스 장애 확대 |
| SUCCESS | 노드·PVC 단위 I/O 메트릭 100% 수집, 임계값 기반 알림 구축 |
| SCOPE | PrometheusRule + Recording Rules + Grafana 대시보드 + E2E 테스트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N186.1 | 노드 레벨 디스크 IOPS recording rule (read/write 분리) | P0 | D-10 |
| FR-N186.2 | 노드 레벨 디스크 레이턴시 recording rule (read/write 분리) | P0 | D-10 |
| FR-N186.3 | 노드 레벨 디스크 처리량(throughput) recording rule | P0 | D-10 |
| FR-N186.4 | 디스크 I/O 포화도(saturation) recording rule | P0 | D-06 |
| FR-N186.5 | 컨테이너/PVC 레벨 I/O recording rule | P1 | D-10 |
| FR-N186.6 | I/O 성능 저하 알림 규칙 (레이턴시 임계값 초과) | P0 | D-06 |
| FR-N186.7 | 스토리지 I/O 통합 대시보드 (Grafana JSON) | P0 | D-10 |
| FR-N186.8 | E2E 테스트 스크립트 | P0 | D-12 |

## 추적성 매트릭스

| FR ID | Design 섹션 | 산출물 | 테스트 | CSAP |
|-------|------------|--------|--------|------|
| FR-N186.1 | DS-N186.1 | storage-io-rules.yaml | TC-N186.1 | D-10-03 |
| FR-N186.2 | DS-N186.2 | storage-io-rules.yaml | TC-N186.2 | D-10-03 |
| FR-N186.3 | DS-N186.3 | storage-io-rules.yaml | TC-N186.3 | D-10-03 |
| FR-N186.4 | DS-N186.4 | storage-io-rules.yaml | TC-N186.4 | D-06-02 |
| FR-N186.5 | DS-N186.5 | storage-io-rules.yaml | TC-N186.5 | D-10-03 |
| FR-N186.6 | DS-N186.6 | storage-io-rules.yaml | TC-N186.6 | D-06-02 |
| FR-N186.7 | DS-N186.7 | storage-io.json | TC-N186.7 | D-10-03 |
| FR-N186.8 | DS-N186.8 | test-mtu-n186.sh | TC-N186.8 | D-12-05 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PrometheusRule (Recording + Alerting) | infra/monitoring/storage-io-rules.yaml |
| 2 | Grafana 대시보드 | infra/monitoring/dashboards/storage-io.json |
| 3 | E2E 테스트 | tests/monitoring/test-mtu-n186-storage-io.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
