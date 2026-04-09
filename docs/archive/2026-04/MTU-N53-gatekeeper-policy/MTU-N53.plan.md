# MTU-N53: OPA Gatekeeper 정책 엔진 통합

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-08 접근통제 정책을 코드로 관리, Kyverno와 OPA Gatekeeper 이중 정책 체계 구축 |
| 기술 | OPA Gatekeeper v3.18+ 설치, ConstraintTemplate 8개, Rego 정책 작성 |
| 보안 | 정책 위반 자동 차단(Enforce), 감사 로그 연동, CSAP 79항목 정책 커버리지 확대 |
| 운영 | 정책 위반 리포트 Grafana 연동, 정책 변경 GitOps 자동 배포 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Kyverno만으로는 복잡한 Rego 기반 정책(데이터 변환, 외부 데이터 참조)을 처리할 수 없음. 공공기관 CSAP 감리 시 다중 정책 엔진 운영이 가산점 |
| WHO | DevOps 엔지니어, 보안 담당자, 감리 위원 |
| RISK | Gatekeeper + Kyverno 동시 운영 시 정책 충돌 가능. Rego 학습 곡선 |
| SUCCESS | 8개 ConstraintTemplate 배포, Enforce 모드 전환, 위반 리포트 Grafana 연동 |
| SCOPE | OPA Gatekeeper 설치, ConstraintTemplate 작성, Flux GitOps 연동, 테스트 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N53.1 | OPA Gatekeeper v3.18+ Helm 설치 | P0 | D-12 |
| FR-N53.2 | ConstraintTemplate 8개 작성 (컨테이너 보안) | P0 | D-08 |
| FR-N53.3 | Kyverno-Gatekeeper 역할 분리 정책 | P0 | D-08 |
| FR-N53.4 | Rego 정책: 특권 컨테이너 차단 | P0 | D-08 |
| FR-N53.5 | Rego 정책: 리소스 제한 강제 | P1 | D-12 |
| FR-N53.6 | Rego 정책: 허용 레지스트리 제한 | P0 | D-09 |
| FR-N53.7 | Rego 정책: hostPath 마운트 차단 | P0 | D-08 |
| FR-N53.8 | Rego 정책: 최신 태그 차단 | P1 | D-12 |
| FR-N53.9 | Gatekeeper Audit 결과 Prometheus 메트릭 노출 | P1 | D-06 |
| FR-N53.10 | Flux GitOps 자동 배포 연동 | P1 | D-12 |
| FR-N53.11 | 정책 위반 Grafana 대시보드 | P2 | D-06 |
| FR-N53.12 | 통합 테스트 12건 이상 | P0 | D-12 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| Gatekeeper Helm values | `infra/gatekeeper/values.yaml` |
| ConstraintTemplate 8개 | `infra/gatekeeper/templates/` |
| Constraint 인스턴스 | `infra/gatekeeper/constraints/` |
| 역할 분리 문서 | `infra/gatekeeper/ROLE-SEPARATION.md` |
| Flux Kustomization | `infra/flux/gatekeeper-kustomization.yaml` |
| Grafana 대시보드 | `infra/monitoring/dashboards/gatekeeper-dashboard.json` |
| 테스트 스크립트 | `tests/e2e/test-gatekeeper.sh` |

---

## 추적성 매트릭스

| FR ID | 설계 섹션 | 산출물 | 테스트 | CSAP |
|-------|----------|--------|--------|------|
| FR-N53.1 | 3.1 | values.yaml | TC-01 | D-12 |
| FR-N53.2 | 3.2 | templates/ | TC-02~09 | D-08 |
| FR-N53.3 | 3.3 | ROLE-SEPARATION.md | TC-10 | D-08 |
| FR-N53.4 | 3.2.1 | privileged-container.yaml | TC-02 | D-08 |
| FR-N53.5 | 3.2.2 | resource-limits.yaml | TC-03 | D-12 |
| FR-N53.6 | 3.2.3 | allowed-registries.yaml | TC-04 | D-09 |
| FR-N53.7 | 3.2.4 | hostpath-block.yaml | TC-05 | D-08 |
| FR-N53.8 | 3.2.5 | latest-tag-block.yaml | TC-06 | D-12 |
| FR-N53.9 | 3.4 | metrics-config | TC-11 | D-06 |
| FR-N53.10 | 3.5 | gatekeeper-kustomization.yaml | TC-12 | D-12 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
