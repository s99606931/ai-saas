# MTU-N161: 자동 용량 권고 엔진 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **상태**: Draft → Review

---

## 1. Executive Summary (4관점 테이블)

| 관점 | 현황 | 목표 | 성공지표 |
|------|------|------|----------|
| 비용 | VPA/HPA 권장 수동 분석 | 자동 분석 기반 최적 리소스 권장 | 리소스 비용 20% 절감 권장 |
| 성능 | 리소스 과소/과다 할당 비일관적 | VPA 기반 최적 할당 자동 권고 | 권장 적용 시 OOM 발생 0건 |
| 운영 | 수동 용량 분석 월 1회 | 자동 일간 권고 보고서 | 운영 공수 80% 감소 |
| 거버넌스 | 용량 결정 근거 부재 | 데이터 기반 권고 이력 관리 | 감사 추적 100% |

---

## 2. Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | VPA/HPA 권장을 수동으로 분석하면 운영 부담이 크고 최적화 기회를 놓침. 자동 분석 엔진으로 데이터 기반 용량 권고 |
| WHO | SRE 팀, 플랫폼 운영자, FinOps 팀 |
| RISK | VPA 권장값과 실제 요구의 괴리, HPA 트리거와 충돌 |
| SUCCESS | 자동 권고 생성, 적용 전 시뮬레이션, 변경 이력 관리 |
| SCOPE | VPA recommender 분석, HPA 통합 권고, 보고서 자동화, 시뮬레이션 |

---

## 3. 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|----------|
| FR-N161.1 | VPA 권장값 수집 및 분석 레코딩 규칙 | HIGH | Prometheus 쿼리 |
| FR-N161.2 | HPA 현재 설정 대비 최적값 비교 분석 | HIGH | 분석 로직 검증 |
| FR-N161.3 | 용량 권고 보고서 자동 생성 스크립트 | HIGH | 스크립트 실행 |
| FR-N161.4 | 권고 적용 시뮬레이션 (what-if 분석) | MED | 시뮬레이션 실행 |
| FR-N161.5 | Grafana 용량 권고 대시보드 | MED | 대시보드 로드 |
| FR-N161.6 | 권고 이력 관리 및 알림 | MED | 알림 트리거 |
| FR-N161.7 | 검증 스크립트 | LOW | 스크립트 실행 |

---

## 4. 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | VPA/HPA 분석 Prometheus 규칙 | `infra/capacity-recommendation/prometheus-rules.yaml` |
| 2 | 용량 권고 보고서 스크립트 | `scripts/capacity-recommendation-report.sh` |
| 3 | Grafana 용량 권고 대시보드 | `infra/capacity-recommendation/grafana-dashboard.json` |
| 4 | 권고 설정 ConfigMap | `infra/capacity-recommendation/config.yaml` |
| 5 | 검증 스크립트 | `scripts/verify-capacity-recommendation.sh` |

---

## 5. 추적성 매트릭스

| FR ID | 산출물 | CSAP |
|-------|--------|------|
| FR-N161.1 | prometheus-rules.yaml | D-06 |
| FR-N161.2 | prometheus-rules.yaml | D-06 |
| FR-N161.3 | capacity-recommendation-report.sh | D-06 |
| FR-N161.4 | capacity-recommendation-report.sh | - |
| FR-N161.5 | grafana-dashboard.json | D-06 |
| FR-N161.6 | prometheus-rules.yaml | D-06 |

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Lead |
