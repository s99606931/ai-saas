# MTU-N172: Flux GitOps 동기화 모니터링 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Phase**: Round 15 — 모니터링 고도화  
> **의존**: MTU-I3 (Flux CD 기본 설정)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | GitOps 배포 동기화 실패 조기 탐지 → 배포 안정성 확보 |
| 기술 | Flux CD 메트릭 기반 동기화 상태, 드리프트, 리컨실 추적 |
| 운영 | Kustomization/HelmRelease 동기화 대시보드, 실패 자동 알림 |
| 규제 | CSAP D-12 변경 관리 (배포 이력 추적) |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | Flux 동기화 실패 미탐지 → 의도하지 않은 구성 드리프트 → 보안 취약점 |
| WHO | SRE 팀, DevOps 엔지니어, 보안 담당자 |
| RISK | 동기화 지연, 리컨실 루프, Git 소스 접근 실패 |
| SUCCESS | 동기화 실패 5분 내 알림, 드리프트 감지율 100% |
| SCOPE | Flux 메트릭, Grafana 대시보드, 알림 규칙, 드리프트 감지 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 기준 |
|----|---------|---------|----------|
| FR-N172.1 | Flux 동기화 상태 대시보드 | HIGH | Kustomization/HelmRelease 현황 |
| FR-N172.2 | 동기화 실패 알림 규칙 | HIGH | 5분 내 알림 발생 |
| FR-N172.3 | Git 소스 동기화 추적 | MED | 소스 컨트롤러 메트릭 |
| FR-N172.4 | 배포 드리프트 감지 | MED | 실제 vs 기대 상태 비교 |
| FR-N172.5 | 리컨실 성능 메트릭 | MED | 리컨실 시간/횟수 추적 |

## 추적성 매트릭스

| FR ID | Design | 구현 파일 | CSAP |
|-------|--------|----------|------|
| FR-N172.1 | §3 | flux-dashboard.json | D-12 |
| FR-N172.2 | §4 | flux-alerts.yaml | D-12 |
| FR-N172.3 | §5 | flux-recording-rules.yaml | D-12 |
| FR-N172.4 | §6 | drift-detection.yaml | D-12 |
| FR-N172.5 | §7 | reconcile-metrics.yaml | D-12 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
