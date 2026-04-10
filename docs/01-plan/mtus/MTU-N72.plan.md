# MTU-N72: VPA Right-Sizing + OpenCost FinOps 통합

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 예산 효율화, 리소스 낭비 30~40% 절감, FinOps 가시성 확보 |
| 기술 | VPA Recommender 모드, OpenCost 비용 할당, Prometheus 통합 |
| 보안 | 리소스 과다 할당 방지, LimitRange/ResourceQuota 연동 |
| 운영 | 테넌트별 비용 분석, 자동 Right-Sizing 권고, 예산 알림 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | MTU-N59 FinOps 기초 대시보드 구축됨. VPA+OpenCost로 자동 Right-Sizing 완성 필요 |
| WHO | SRE 팀, 재무 관리자, 플랫폼 관리자 |
| RISK | VPA UpdateMode Auto 시 Pod 재시작 발생 가능 |
| SUCCESS | VPA 권고 생성, OpenCost 비용 메트릭 수집, Right-Sizing 대시보드 |
| SCOPE | VPA 설치+설정, OpenCost 배포, Prometheus 연동, 대시보드 |

---

## 기능 요구사항

| FR ID | 요구사항 | 수용 기준 | CSAP 매핑 |
|-------|---------|----------|----------|
| FR-N72.1 | VPA Recommender 설치 | VPA CRD + Recommender Pod 실행 | D-12-07 |
| FR-N72.2 | VPA 리소스 권고 설정 | 서비스별 VPA 오브젝트 생성 (Off 모드) | D-12-07 |
| FR-N72.3 | OpenCost 배포 | OpenCost Pod + Prometheus 스크레이핑 | D-12-07 |
| FR-N72.4 | 비용 할당 대시보드 | Grafana 대시보드 1종 (네임스페이스/서비스별 비용) | D-06-01 |
| FR-N72.5 | Right-Sizing 알림 | 30% 이상 과다 할당 시 Slack 알림 | D-12-07 |
| FR-N72.6 | 검증 테스트 | 12건 이상 ALL PASS | D-12-07 |

---

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | VPA 매니페스트 | `infra/vpa/` |
| 2 | OpenCost 매니페스트 | `infra/finops/opencost/` |
| 3 | 비용 대시보드 | `infra/monitoring/dashboards/vpa-rightsizing.json` |
| 4 | 알림 규칙 | `infra/monitoring/vpa-alerting-rules.yaml` |
| 5 | 테스트 스크립트 | `scripts/test-vpa-finops.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
