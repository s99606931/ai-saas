# MTU-N76: 자동 용량 계획 + ResourceQuota/LimitRange 강화

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 테넌트별 리소스 예산 관리, 공정 배분, 공공기관 예산 효율화 |
| 기술 | 네임스페이스별 ResourceQuota, LimitRange, 용량 예측 알림 |
| 보안 | CSAP D-08 접근통제 (리소스 접근 제한), 테넌트 격리 |
| 운영 | 자동 용량 알림, 분기별 용량 보고서, 증설 권고 |

---

## 기능 요구사항

| FR ID | 요구사항 | 수용 기준 |
|-------|---------|----------|
| FR-N76.1 | 테넌트별 ResourceQuota | 3개 등급 (S/M/L) 리소스 할당 |
| FR-N76.2 | 글로벌 LimitRange | 모든 앱 NS에 기본 LimitRange |
| FR-N76.3 | 용량 예측 알림 | 80% 사용 시 경고, 90% 시 위험 |
| FR-N76.4 | 용량 현황 Grafana 대시보드 | NS별 할당/사용/여유 시각화 |
| FR-N76.5 | 검증 테스트 | 10건 이상 ALL PASS |

---

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | ResourceQuota 템플릿 | `infra/resource-management/quotas/` |
| 2 | LimitRange 글로벌 | `infra/resource-management/limit-ranges/` |
| 3 | 용량 알림 규칙 | `infra/monitoring/capacity-alerting-rules.yaml` |
| 4 | 용량 대시보드 | `infra/monitoring/dashboards/capacity-planning.json` |
| 5 | 테스트 스크립트 | `scripts/test-capacity-planning.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
