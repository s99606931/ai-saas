# MTU-N208: 노드 디스크 I/O 포화도 모니터링 -- Plan

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 디스크 I/O 포화 조기 감지로 etcd/데이터베이스 성능 저하 방지 |
| 기술 | node_disk_io_time_weighted_seconds_total, node_disk_read/write_bytes_total |
| 보안 | CSAP D-10 서비스 가용성, D-06 로그 무결성 |
| 운영 | 디스크 I/O SLO, 포화도 기반 용량 계획 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP |
|----|---------|---------|------|
| FR-N208.1 | 디스크 I/O 포화도 (iowait/utilization) recording rule | P0 | D-10 |
| FR-N208.2 | 디스크 읽기/쓰기 처리량 recording rule | P0 | D-10 |
| FR-N208.3 | 디스크 IOPS recording rule | P0 | D-10 |
| FR-N208.4 | 디스크 I/O 포화도 급등 알림 | P0 | D-10 |
| FR-N208.5 | 디스크 I/O 대시보드 | P0 | D-10 |
| FR-N208.6 | E2E 검증 테스트 | P0 | D-12 |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording rules | infra/monitoring/disk-io/disk-io-saturation-rules.yaml |
| 2 | Alerting rules | infra/monitoring/disk-io/disk-io-saturation-alerts.yaml |
| 3 | Grafana 대시보드 | infra/monitoring/dashboards/disk-io-saturation-dashboard.json |
| 4 | E2E 테스트 | tests/monitoring/test-mtu-n208-disk-io-saturation.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
