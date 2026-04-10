# MTU-N222: etcd 클러스터 상세 운영 모니터링

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | etcd 클러스터 운영 안정성 강화 (컴팩션, 스냅샷, 리더 선출, 디스크) |
| 기술 | etcd 내부 운영 메트릭 수집 + 상세 대시보드 + 사전 알림 |
| 품질 | 컴팩션 지연 < 500ms, 스냅샷 성공률 100%, DB 크기 알림 |
| 규제 | CSAP D-06 감사 로깅, D-12 시스템 운영 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | MTU-N201 기본 etcd 모니터링 대비 운영 세부 메트릭 확장 필요 |
| WHO | 인프라 운영팀, DBA |
| RISK | etcd 컴팩션/스냅샷 실패 시 데이터 손실 위험 |
| SUCCESS | 운영 대시보드 + Recording Rules + 알림 규칙 |
| SCOPE | etcd 컴팩션, 스냅샷, 리더, 디스크, 클라이언트 연결 |

## 기능 요구사항

| ID | 요구사항 | 검증 기준 |
|----|---------|----------|
| FR-N222.1 | etcd 운영 Recording Rules | 컴팩션/스냅샷/리더/디스크/클라이언트 메트릭 |
| FR-N222.2 | 운영 대시보드 | 5개 영역 패널 |
| FR-N222.3 | 운영 알림 규칙 | 컴팩션 지연, 스냅샷 실패, 리더 변경, DB 크기 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Recording Rules | `infra/monitoring/etcd/etcd-operations-rules.yaml` |
| 2 | 대시보드 | `infra/monitoring/dashboards/etcd-operations-dashboard.json` |
| 3 | 알림 규칙 | `infra/monitoring/etcd/etcd-operations-alerts.yaml` |
