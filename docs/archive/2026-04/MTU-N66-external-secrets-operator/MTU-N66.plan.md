# MTU-N66: External Secrets Operator

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Sealed Secrets 보완, 런타임 시크릿 동기화 및 자동 회전으로 CSAP D-09 강화 |
| 기술 | ESO + Kubernetes Secret Store (로컬 Vault-less 모드) + SecretStore + ExternalSecret |
| 보안 | CSAP D-09 시크릿 자동 회전, 시크릿 드리프트 감지, 감사 로깅 |
| 운영 | Sealed Secrets(배포 시점) + ESO(런타임) 이중 관리 전략 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N66.1 | ESO Helm values.yaml | P0 |
| FR-N66.2 | Kubernetes Backend SecretStore | P0 |
| FR-N66.3 | ExternalSecret 리소스 6종 (서비스별) | P0 |
| FR-N66.4 | 시크릿 자동 회전 (refreshInterval) | P1 |
| FR-N66.5 | Sealed Secrets + ESO 역할 분리 문서 | P1 |
| FR-N66.6 | Prometheus 메트릭 연동 | P1 |
| FR-N66.7 | Flux GitOps 연동 | P1 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
