# Plan: MTU-N28 NetworkPolicy 네임스페이스 격리 강화

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N28 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-10 네트워크 보안 인증 증적 확보 |
| 기술 | k3s 기본 네트워크 정책으로 네임스페이스 격리 |
| 보안 | Zero-trust: default-deny 후 최소 허용 |
| 운영 | 서비스 간 통신 명시적 관리 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 기준 |
|-------|---------|---------|---------|
| FR-N28.1 | saas-platform default-deny 정책 | MUST | 정책 적용 후 외부 트래픽 차단 |
| FR-N28.2 | monitoring default-deny + scraping 허용 | MUST | Prometheus 수집 정상 동작 |
| FR-N28.3 | DNS 접근 허용 정책 | MUST | CoreDNS 접근 보장 |
| FR-N28.4 | 서비스 간 필수 통신 허용 | MUST | 모든 Pod Running 유지 |
| FR-N28.5 | 가이드 문서 작성 | SHOULD | 문서 생성 확인 |

---

## 추적성 매트릭스

| FR ID | CSAP 항목 | N2SF 영역 | 산출물 |
|-------|---------|---------|--------|
| FR-N28.1 | D-10-04 | N-01 | infra/network-policies/saas-platform/ |
| FR-N28.2 | D-10-04 | N-01 | infra/network-policies/monitoring/ |
| FR-N28.3 | D-10-04 | N-01 | infra/network-policies/common/ |
| FR-N28.4 | D-10-04 | N-01 | infra/network-policies/ |
| FR-N28.5 | - | - | docs/08-infra/networkpolicy-guide.md |
