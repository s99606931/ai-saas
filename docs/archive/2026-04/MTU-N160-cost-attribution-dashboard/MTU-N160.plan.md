# MTU-N160: 비용 귀속 대시보드 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **상태**: Draft → Review

---

## 1. Executive Summary (4관점 테이블)

| 관점 | 현황 | 목표 | 성공지표 |
|------|------|------|----------|
| 비용 | 테넌트별 인프라 비용 비가시적, 정산 수동 | 자동 비용 귀속 및 테넌트별 정산 대시보드 | 비용 귀속 정확도 95% 이상 |
| 운영 | 비용 분석에 수작업 필요 | Prometheus 메트릭 기반 자동화 | 월간 정산 보고서 자동 생성 |
| 거버넌스 | 리소스 남용 탐지 불가 | 테넌트별 사용량 대비 비용 임계값 알림 | 임계값 초과 시 5분 내 알림 |
| 보안 | 비용 데이터 접근 통제 미흡 | RBAC 기반 테넌트별 비용 데이터 격리 | CSAP D-08 준수 |

---

## 2. Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 멀티테넌트 SaaS에서 테넌트별 리소스 사용량과 비용을 정확히 귀속하여 공정한 과금과 FinOps 최적화 지원 |
| WHO | FinOps 팀, 플랫폼 운영자, 테넌트 관리자 |
| RISK | 리소스 메트릭 수집 지연, 공유 리소스 비용 분배 부정확 |
| SUCCESS | 테넌트별 비용 대시보드, 자동 정산, 임계값 알림, 월간 보고서 |
| SCOPE | CPU/메모리/스토리지/네트워크 비용 귀속, Grafana 대시보드, 정산 보고서 생성 |

---

## 3. 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|----------|
| FR-N160.1 | 테넌트별 CPU/메모리 사용량 메트릭 수집 (namespace 기반) | HIGH | Prometheus 쿼리 |
| FR-N160.2 | 리소스 사용량 기반 비용 계산 레코딩 규칙 | HIGH | 규칙 검증 |
| FR-N160.3 | 테넌트별 비용 귀속 Grafana 대시보드 | HIGH | 대시보드 로드 |
| FR-N160.4 | 비용 임계값 초과 알림 규칙 | MED | 알림 트리거 |
| FR-N160.5 | 월간 비용 정산 보고서 생성 스크립트 | MED | 스크립트 실행 |
| FR-N160.6 | 비용 단가 설정 ConfigMap | MED | 설정 검증 |
| FR-N160.7 | 검증 스크립트 | LOW | 스크립트 실행 |

---

## 4. 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 비용 단가 ConfigMap | `infra/cost-attribution/cost-config.yaml` |
| 2 | Prometheus 비용 레코딩 규칙 | `infra/cost-attribution/prometheus-rules.yaml` |
| 3 | Grafana 비용 대시보드 | `infra/cost-attribution/grafana-dashboard.json` |
| 4 | 비용 정산 보고서 스크립트 | `scripts/cost-attribution-report.sh` |
| 5 | 검증 스크립트 | `scripts/verify-cost-attribution.sh` |

---

## 5. 추적성 매트릭스

| FR ID | 산출물 | CSAP |
|-------|--------|------|
| FR-N160.1 | prometheus-rules.yaml | D-06 |
| FR-N160.2 | prometheus-rules.yaml | D-06 |
| FR-N160.3 | grafana-dashboard.json | D-06, D-08 |
| FR-N160.4 | prometheus-rules.yaml | D-06 |
| FR-N160.5 | cost-attribution-report.sh | D-06 |
| FR-N160.6 | cost-config.yaml | - |

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Lead |
