# MTU-N163: 지능형 로그 압축 정책 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## 1. Executive Summary

| 관점 | 현황 | 목표 | 성공지표 |
|------|------|------|----------|
| 비용 | 로그 스토리지 비용 증가 추세 | 지능형 압축으로 50% 스토리지 절감 | 월간 로그 볼륨 50% 감소 |
| 운영 | 로그 보존 정책 수동 관리 | 자동 등급별 보존/압축 정책 | 운영 자동화 100% |
| 보안 | CSAP D-06 감사 로그 보존 미자동화 | 등급별 자동 보존 (감사 1년, 일반 30일) | 규정 준수 100% |
| 성능 | 로그 쿼리 느림 (대용량) | 핫/웜/콜드 계층화 | 쿼리 응답 시간 50% 개선 |

---

## 2. 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N163.1 | 로그 등급 분류 정책 (감사/보안/운영/디버그) | HIGH |
| FR-N163.2 | 핫/웜/콜드 스토리지 계층화 설정 | HIGH |
| FR-N163.3 | 등급별 보존 기간 자동 관리 | HIGH |
| FR-N163.4 | 로그 압축 Prometheus 메트릭 | MED |
| FR-N163.5 | 로그 스토리지 Grafana 대시보드 | MED |
| FR-N163.6 | 검증 스크립트 | LOW |

---

## 3. 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 로그 압축 정책 | `infra/log-compaction/compaction-policy.yaml` |
| 2 | Loki 스토리지 계층화 설정 | `infra/log-compaction/loki-storage-config.yaml` |
| 3 | Prometheus 규칙 | `infra/log-compaction/prometheus-rules.yaml` |
| 4 | Grafana 대시보드 | `infra/log-compaction/grafana-dashboard.json` |
| 5 | 검증 스크립트 | `scripts/verify-log-compaction.sh` |

---

## 4. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Lead |
