# MTU-C7 Plan: Policy as Code

> **MTU ID**: MTU-C7
> **Phase**: Phase 2 Core Security
> **의존 MTU**: MTU-I1 (k3s WSL2 클러스터)
> **작성일**: 2026-04-05
> **작성자**: PM Lead Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 문제 | k3s 클러스터 CSAP 보안 정책이 수동 설정 — 정책 누락/불일치 위험 |
| 솔루션 | Kyverno 8개 + OPA/Gatekeeper 3개 = 11개 정책 코드화 |
| 기능/UX | kubectl apply 한 번으로 전체 CSAP 보안 정책 자동 적용 |
| 핵심 가치 | EU CRA 대비 Policy as Code 필수화 대응 |

---

## Context Anchor

### WHY
- k3s 보안 정책 수동 설정으로 누락 위험 상존
- CSAP D-08/D-11/D-12 자동 적용 필요

### SUCCESS
| ID | 기준 |
|----|------|
| SC-C7-01 | kubectl apply로 정책 적용 가능 |
| SC-C7-02 | 비규정 준수 Pod 자동 거부 |
| SC-C7-03 | CSAP D-08/D-11/D-12 최소 5개 정책 |
| SC-C7-04 | 각 정책에 CSAP ID 주석 포함 |

---

## 산출물 목록

| 산출물 | 경로 | FR ID |
|--------|------|-------|
| Policy as Code README | `docs/framework/08-infra/policy-as-code/README.md` | FR-C7.1 |
| Kyverno 정책 가이드 | `docs/framework/08-infra/policy-as-code/kyverno-policies.md` | FR-C7.2 |
| OPA Gatekeeper 가이드 | `docs/framework/08-infra/policy-as-code/opa-gatekeeper.md` | FR-C7.3 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 | PM Lead Agent |
| 1.0.1 | 2026-04-07 | 아카이브 동기화 시 재작성 | PM Lead Agent |
