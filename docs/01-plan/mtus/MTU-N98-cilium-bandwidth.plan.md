# MTU-N98: Cilium 대역폭 관리 + EDT/BBR 최적화 -- Plan

> **MTU ID**: MTU-N98
> **Phase**: CI/CD 8라운드
> **작성일**: 2026-04-10
> **복잡도**: MED

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 네트워크 성능 2~3배 향상, 서비스 간 지연 최소화 |
| 기술 | Cilium EDT 기반 대역폭 관리 + BBR 혼잡 제어 + netkit 디바이스 |
| 보안 | N2SF 등급별 대역폭 할당, 네트워크 격리 유지 |
| 운영 | Hubble 기반 대역폭 모니터링 + 자동 알림 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 마이크로서비스 간 네트워크 병목 해소, QoS 보장 |
| WHO | SRE 팀, 네트워크 운영자 |
| RISK | BBR 설정 오류 시 성능 저하 가능 |
| SUCCESS | 대역폭 관리 정책 5개+, BBR 활성화, Hubble 메트릭 연동 |
| SCOPE | Cilium BandwidthManager, EDT, BBR, CiliumNetworkPolicy rate limit |

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|----------|
| FR-N98.1 | Cilium BandwidthManager 활성화 | values.yaml 업데이트 |
| FR-N98.2 | EDT + BBR 혼잡 제어 설정 | sysctl 파라미터 + Cilium 설정 |
| FR-N98.3 | 네임스페이스별 대역폭 제한 정책 | CiliumNetworkPolicy 5개+ |
| FR-N98.4 | Hubble 대역폭 메트릭 수집 | Grafana 패널 연동 |
| FR-N98.5 | E2E 테스트 작성 | 10건+ ALL PASS |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
