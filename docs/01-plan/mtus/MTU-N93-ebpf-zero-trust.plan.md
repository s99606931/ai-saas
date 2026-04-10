# MTU-N93: eBPF/Cilium 네트워크 관측성 + Zero Trust 완성 — Plan

> **MTU ID**: MTU-N93
> **Phase**: 7라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Zero Trust 아키텍처 완성, 모든 트래픽 mTLS 보호 |
| 기술 | Cilium eBPF 네트워크 관측 + Hubble UI + L7 정책 |
| 보안 | CSAP D-10 네트워크 보안 완전 달성, N2SF 격리 강화 |
| 운영 | 네트워크 플로우 실시간 가시화, 이상 트래픽 자동 탐지 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N93.1 | Cilium eBPF CNI 설정 및 k3s 통합 | HIGH |
| FR-N93.2 | Hubble 네트워크 관측 + 서비스 맵 | HIGH |
| FR-N93.3 | Cilium L7 네트워크 정책 (HTTP 필터링) | HIGH |
| FR-N93.4 | mTLS 전체 트래픽 암호화 (Zero Trust) | HIGH |
| FR-N93.5 | N2SF 등급별 eBPF 네트워크 격리 | HIGH |
| FR-N93.6 | E2E 테스트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Cilium 설치 가이드 | infra/cilium/install.yaml |
| 2 | Hubble 설정 | infra/cilium/hubble.yaml |
| 3 | L7 네트워크 정책 | infra/cilium/network-policies/ |
| 4 | Zero Trust mTLS 설정 | infra/cilium/mtls-config.yaml |
| 5 | E2E 테스트 | tests/e2e/test-cilium-zero-trust.sh |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
