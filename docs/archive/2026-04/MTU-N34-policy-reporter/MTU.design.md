# Design: MTU-N34 Kyverno Policy Reporter 설치

| 항목 | 내용 |
|------|------|
| 문서 ID | DESIGN-N34-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| 작성자 | PM Lead (Opus 4.6) |
| Plan 참조 | PLAN-N34-001 |

---

## Design Anchor

- **목표**: Kyverno 정책 결과를 Policy Reporter UI + Prometheus + Grafana로 시각화
- **제약**: WSL2 메모리 제한, 기존 kube-prometheus-stack 활용
- **선택**: Option B (Pragmatic Balance) -- UI + Kyverno Plugin + Monitoring subchart

---

## 아키텍처 옵션

### Option A: Minimal -- Core만 설치
- Policy Reporter Core만 설치 (UI 없음)
- Prometheus 메트릭만 노출
- 장점: 최소 리소스
- 단점: 시각적 대시보드 없음

### Option B: Pragmatic Balance (선택)
- Policy Reporter Core + UI + Kyverno Plugin
- Prometheus ServiceMonitor 연동
- Grafana 대시보드 ConfigMap 자동 프로비저닝
- 장점: 운영 가시성 + 기존 스택 통합
- 단점: 추가 2~3 Pod

### Option C: Full Stack
- Option B + Loki/Elasticsearch 연동 + Slack 알림
- 장점: 완전한 운영 자동화
- 단점: 과도한 리소스, WSL2 부적합

---

## 상세 설계

### 1. Helm Chart 설치 구성

```yaml
# infra/kyverno/policy-reporter-values.yaml
# Helm repo: policy-reporter (https://kyverno.github.io/policy-reporter)
# Chart: policy-reporter/policy-reporter
# Namespace: policy-reporter

# Core
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 128Mi

# Kyverno Plugin
kyvernoPlugin:
  enabled: true
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 128Mi

# UI
ui:
  enabled: true
  plugins:
    kyverno: true
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 128Mi
  service:
    type: NodePort
    nodePort: 30380

# Monitoring (Prometheus 연동)
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    labels:
      release: kube-prometheus-stack
  grafana:
    dashboards:
      enabled: true
      namespace: monitoring
      label: grafana_dashboard
      value: "1"
```

### 2. 네임스페이스 설계

- 전용 네임스페이스: `policy-reporter`
- NetworkPolicy: default-deny + DNS + intra-ns (기존 패턴 재사용)

### 3. Prometheus 연동

- ServiceMonitor 라벨: `release: kube-prometheus-stack` (기존 Prometheus Operator가 스크래핑)
- 메트릭 엔드포인트: `/metrics` (port 8080)
- 주요 메트릭:
  - `policy_report_result` (pass/fail/warn/error/skip)
  - `policy_report_summary` (네임스페이스별 요약)

### 4. Grafana 대시보드

- Policy Reporter Chart가 제공하는 3개 기본 대시보드 자동 프로비저닝
  - PolicyReports Overview
  - ClusterPolicyReports Overview
  - Policy Details

### 5. UI 접근

- NodePort: 30380 (http://localhost:30380)
- 인증: 미적용 (내부 개발 환경)

---

## Session Guide

### S1: Helm 저장소 추가 및 설치 (15분)
1. `helm repo add policy-reporter https://kyverno.github.io/policy-reporter`
2. `helm repo update`
3. values.yaml 작성
4. `helm upgrade --install policy-reporter policy-reporter/policy-reporter -n policy-reporter --create-namespace -f values.yaml`

### S2: 검증 (10분)
1. Pod Running 확인
2. UI 접근 확인 (localhost:30380)
3. Prometheus 타겟 확인
4. Grafana 대시보드 확인

### S3: 문서 작성 (10분)
1. 설치 가이드 문서
2. Report 문서

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
