# MTU-N166: 테넌트 자원 할당량 자동 조정 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## 1. Executive Summary

| 관점 | 현황 | 목표 | 성공지표 |
|------|------|------|----------|
| 효율성 | 테넌트 ResourceQuota 수동 설정 | 사용 패턴 기반 자동 조정 권고 | 자원 활용률 30% 향상 |
| 공정성 | 테넌트 간 자원 불균형 | 사용량 기반 공정 분배 | Noisy neighbor 0건 |
| 운영 | 할당량 변경 수동 처리 | 자동 분석 + 권고 + 승인 후 적용 | 처리 시간 90% 단축 |
| 보안 | 자원 남용 탐지 미흡 | 이상 사용 패턴 자동 탐지 | CSAP D-08 준수 |

---

## 2. 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N166.1 | 테넌트별 ResourceQuota 사용량 메트릭 | HIGH |
| FR-N166.2 | 자동 할당량 조정 권고 규칙 | HIGH |
| FR-N166.3 | Noisy neighbor 탐지 알림 | HIGH |
| FR-N166.4 | 할당량 조정 Grafana 대시보드 | MED |
| FR-N166.5 | 검증 스크립트 | LOW |

---

## 3. 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 자원 할당 정책 | `infra/tenant-quota/quota-policy.yaml` |
| 2 | Prometheus 규칙 | `infra/tenant-quota/prometheus-rules.yaml` |
| 3 | Grafana 대시보드 | `infra/tenant-quota/grafana-dashboard.json` |
| 4 | 검증 스크립트 | `scripts/verify-tenant-quota.sh` |

---

## 4. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Lead |
