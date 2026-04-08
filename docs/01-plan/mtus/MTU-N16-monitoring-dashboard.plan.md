# MTU-N16: Grafana 모니터링 대시보드 완성 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N16 |
| Phase | Phase 3 Infrastructure |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Code) |
| 복잡도 | MED |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 기존 Grafana 대시보드(10개 패널)와 Prometheus 알림(14개 규칙)이 운영 기본 수준이나, SLO 기반 모니터링·테넌트별 리소스 분리·CSAP D-06 침해사고 전용 뷰·Prometheus/Grafana 배포 매니페스트가 누락되어 프로덕션 운영 준비 미흡 |
| **WHO** | SRE/DevOps 엔지니어, 보안 관제 담당자, 서비스 운영팀 |
| **RISK** | k3s 리소스 제약으로 Prometheus 스택 과부하, WSL2 영속 스토리지 PV 제약, 대시보드 JSON 크기 증가에 따른 Grafana 로딩 지연 |
| **SUCCESS** | (1) SLO 대시보드: API P95 < 200ms + 가용성 99.9% 시각화, (2) 보안 대시보드: 침해사고 모니터링 5개 패널, (3) kube-prometheus-stack 배포 매니페스트 완성, (4) burn rate 알림 4개 추가 |
| **SCOPE** | `k8s/monitoring/grafana-dashboard.json`, `k8s/monitoring/grafana-slo-dashboard.json`, `k8s/monitoring/grafana-security-dashboard.json`, `k8s/monitoring/prometheus-alerts.yaml`, `k8s/monitoring/prometheus-stack.yaml` |

---

## Executive Summary (4관점)

| 관점 | 목표 | 측정 지표 |
|------|------|---------|
| 기능 | SLO·보안·테넌트 3종 대시보드 + Prometheus 스택 배포 | 대시보드 3종, 알림 18개+ |
| 보안 | CSAP D-06 침해사고 관리 + D-07 가용성 시각화 | 보안 패널 5개, 알림 CSAP 태그 100% |
| 인프라 | kube-prometheus-stack k3s 최적화 배포 | 리소스 request/limit 설정, PV 1Gi |
| 운영 | SLO burn rate 기반 자동 알림 | P95 < 200ms SLO 준수율 표시 |

---

## 기능 요구사항

| FR ID | 요구사항 | 산출물 | 검증 기준 |
|-------|---------|--------|---------|
| FR-N16.1 | SLO 대시보드: API P95 응답시간 < 200ms 시각화 | grafana-slo-dashboard.json | SLO 목표 대비 현재 수치 표시 |
| FR-N16.2 | SLO 대시보드: 서비스 가용성 99.9% 시각화 | grafana-slo-dashboard.json | 에러 버짓 소진율 표시 |
| FR-N16.3 | SLO burn rate 알림 규칙 4개 | prometheus-alerts.yaml | fast/slow burn 1h/6h 창 |
| FR-N16.4 | CSAP D-06 보안 대시보드: 침해사고 모니터링 5패널 | grafana-security-dashboard.json | 로그인실패·429·이상탐지·감사로그·데이터등급 |
| FR-N16.5 | 기존 운영 대시보드 패널 보강: 테넌트별 리소스 | grafana-dashboard.json | 테넌트 변수 선택기 추가 |
| FR-N16.6 | kube-prometheus-stack 배포 매니페스트 | prometheus-stack.yaml | Prometheus+Grafana+AlertManager 통합 |
| FR-N16.7 | 디스크·PVC 사용률 패널 추가 | grafana-dashboard.json | PV 사용률 게이지 |
| FR-N16.8 | Alertmanager 알림 라우팅 구성 | prometheus-stack.yaml | severity별 라우팅, 한국어 알림 템플릿 |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|------------|---------|-------|------|
| FR-N16.1 | DESIGN-SLO-1 | grafana-slo-dashboard.json | JSON 유효성 | D-07 |
| FR-N16.2 | DESIGN-SLO-2 | grafana-slo-dashboard.json | JSON 유효성 | D-07 |
| FR-N16.3 | DESIGN-SLO-3 | prometheus-alerts.yaml | YAML 유효성 | D-07 |
| FR-N16.4 | DESIGN-SEC-1 | grafana-security-dashboard.json | JSON 유효성 | D-06 |
| FR-N16.5 | DESIGN-OPS-1 | grafana-dashboard.json | JSON 유효성 | D-07 |
| FR-N16.6 | DESIGN-STACK-1 | prometheus-stack.yaml | kubectl dry-run | D-07 |
| FR-N16.7 | DESIGN-OPS-2 | grafana-dashboard.json | JSON 유효성 | D-07 |
| FR-N16.8 | DESIGN-STACK-2 | prometheus-stack.yaml | YAML 유효성 | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
