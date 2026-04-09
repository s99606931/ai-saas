# MTU-N54: Linkerd 서비스 메시 + mTLS Zero Trust

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공공기관 Zero Trust 요건 충족, 서비스 간 mTLS 자동 암호화로 CSAP D-09 완전 준수 |
| 기술 | Linkerd v2.16+ 설치, mTLS 자동화, 트래픽 관리, ServiceProfile CRD |
| 보안 | 서비스 간 통신 전수 암호화, 워크로드 신원 기반 인증, CSAP D-08/D-09 연동 |
| 운영 | Linkerd Viz 대시보드, Prometheus/Grafana 통합, 리소스 경량화 (10MB/프록시) |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | NetworkPolicy만으로는 L3/L4 수준 제어만 가능. L7 수준의 서비스 간 암호화/인증/인가 필요 |
| WHO | 보안 담당자, DevOps 엔지니어, 감리 위원 |
| RISK | sidecar 주입으로 인한 리소스 오버헤드. k3s+WSL2 환경에서의 호환성 |
| SUCCESS | mTLS 100% 적용, ServiceProfile 6개 서비스 설정, Linkerd Viz 대시보드 작동 |
| SCOPE | Linkerd 설치, mTLS 자동화, ServiceProfile, 트래픽 관리, Grafana 연동 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N54.1 | Linkerd v2.16+ CLI + CRD 설치 | P0 | D-09 |
| FR-N54.2 | Trust Anchor 인증서 생성 (step CLI) | P0 | D-09 |
| FR-N54.3 | mTLS 자동 활성화 (메시 Pod 간) | P0 | D-09 |
| FR-N54.4 | 주요 서비스 네임스페이스 메시 주입 | P0 | D-09 |
| FR-N54.5 | ServiceProfile CRD 6개 서비스 설정 | P1 | D-08 |
| FR-N54.6 | 재시도(Retry) + 타임아웃 정책 | P1 | D-12 |
| FR-N54.7 | Linkerd Viz 확장 대시보드 | P1 | D-06 |
| FR-N54.8 | Prometheus 메트릭 통합 | P1 | D-06 |
| FR-N54.9 | Grafana Linkerd 대시보드 | P2 | D-06 |
| FR-N54.10 | AuthorizationPolicy CRD 서비스 인가 | P0 | D-08 |
| FR-N54.11 | k3s + WSL2 환경 호환성 가이드 | P1 | - |
| FR-N54.12 | 통합 테스트 15건 이상 | P0 | D-12 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Linkerd 설치 스크립트 | `infra/linkerd/install.sh` |
| Linkerd Helm values | `infra/linkerd/values.yaml` |
| Trust Anchor 설정 가이드 | `infra/linkerd/trust-anchor-guide.md` |
| ServiceProfile 6개 | `infra/linkerd/service-profiles/` |
| AuthorizationPolicy | `infra/linkerd/authorization/` |
| Grafana 대시보드 | `infra/monitoring/dashboards/linkerd-dashboard.json` |
| 테스트 스크립트 | `tests/e2e/test-linkerd.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
