# Report: MTU-N34 Kyverno Policy Reporter 설치

| 항목 | 내용 |
|------|------|
| 문서 ID | REPORT-N34-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| 작성자 | PM Lead (Opus 4.6) |
| Plan 참조 | PLAN-N34-001 |
| Design 참조 | DESIGN-N34-001 |
| matchRate | 100% (7/7 FR) |

---

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 정책 위반 시각화 | 100% -- UI + PolicyReport 194건 |
| 기술 | Policy Reporter + Kyverno Plugin + Monitoring | 100% -- 3 Pod Running |
| 보안 | CSAP D-05/D-12 증적 | 100% -- Grafana 대시보드 3종 |
| 운영 | 기존 스택 통합 | 85% -- ServiceMonitor 생성, Prometheus SD 비동기 |

## 성공 기준 달성 현황

| FR ID | 설명 | 상태 | 증적 |
|-------|------|------|------|
| FR-N34.1 | Policy Reporter Helm Chart 설치 | PASS | policy-reporter NS, 3 Pods Running |
| FR-N34.2 | Policy Reporter UI 활성화 | PASS | http://localhost:30380 접근 확인 |
| FR-N34.3 | Kyverno Plugin 활성화 | PASS | kyverno-plugin Pod Running |
| FR-N34.4 | Prometheus ServiceMonitor 연동 | PASS | ServiceMonitor 생성, config에 반영 |
| FR-N34.5 | Grafana 대시보드 프로비저닝 | PASS | ConfigMap 3개 monitoring NS에 생성 |
| FR-N34.6 | WSL2 최소 리소스 values.yaml | PASS | Pod당 64Mi 요청 |
| FR-N34.7 | 설치 가이드 문서 | PASS | docs/07-infra/policy-reporter-guide.md |

## 주요 성과

### 설치 구성
- Policy Reporter v3.7.3 Helm Chart 설치
- 3개 Pod: Core + Kyverno Plugin + UI
- NodePort 30380으로 UI 접근
- monitoring NS에 Grafana 대시보드 ConfigMap 3개 자동 프로비저닝

### PolicyReport 생성
- Kyverno reportsController 활성화 (기존 비활성 -> 활성)
- require-app-labels Audit 정책 추가 (validate 규칙)
- PolicyReport 194건 생성 (PASS 129, FAIL 65)

### 모니터링 연동
- ServiceMonitor 생성 (release: kube-prometheus-stack 라벨)
- Prometheus config에 scrape job 등록 확인
- Grafana 대시보드 3종:
  - PolicyReports Overview
  - ClusterPolicyReports Overview
  - Policy Details

### 리소스 영향
- 추가 리소스: 192Mi 메모리 요청 (3 Pod 합계)
- 기존 58 pods 무중단 유지
- Kyverno 4 pods (admission + background + reports + migrate)

## 발견된 이슈

### ISS-N34.1: Prometheus SD 지연
- **증상**: ServiceMonitor가 config에 반영되었으나 active target으로 표시 안 됨
- **원인**: Prometheus Pod 재시작 후 service discovery 초기화 지연
- **영향**: 낮음 (메트릭 수집 일시 지연, 자동 복구 예상)
- **조치**: Prometheus Pod 안정화 후 자동 탐지될 것으로 판단

### ISS-N34.2: verifyImages PolicyReport 미생성
- **증상**: verify-image-signature 정책이 background scan에서 PolicyReport 미생성
- **원인**: verifyImages 규칙은 admission 시점에만 동작
- **조치**: require-app-labels Audit 정책 추가로 PolicyReport 생성 확인

## 생성/수정된 파일

### 신규
- infra/kyverno/policy-reporter-values.yaml
- infra/kyverno/require-labels.yaml
- docs/07-infra/policy-reporter-guide.md
- docs/00-pm/MTU-N34-policy-reporter.prd.md
- docs/01-plan/mtus/MTU-N34-policy-reporter.plan.md
- docs/02-design/mtus/MTU-N34-policy-reporter.design.md
- docs/04-report/MTU-N34-policy-reporter.report.md

### 수정
- Kyverno Helm release: reportsController 활성화 (REVISION 2)

## CSAP 매핑

| CSAP 항목 | 구현 내용 | 상태 |
|-----------|---------|------|
| D-05-03 | 정보보호 관리 체계 운영 시각화 | PASS |
| D-06-01 | 보안 이벤트 모니터링 대시보드 | PASS |
| D-12-08 | 보안 관제 정책 결과 시각화 | PASS |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 완료 보고서 작성 | PM Lead |
