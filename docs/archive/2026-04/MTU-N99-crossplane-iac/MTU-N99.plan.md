# MTU-N99: Crossplane IaC + 멀티클라우드 추상화 -- Plan

> **MTU ID**: MTU-N99
> **Phase**: CI/CD 8라운드
> **작성일**: 2026-04-10
> **복잡도**: HIGH

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Terraform 대체, Kubernetes 네이티브 IaC, 벤더 종속 제거 |
| 기술 | Crossplane XRD/Composition으로 인프라 추상화 |
| 보안 | RBAC 기반 인프라 접근 제어, N2SF 등급별 리소스 분리 |
| 운영 | GitOps 기반 인프라 변경, 드리프트 자동 감지 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 공공기관 멀티클라우드 전환 요구, IaC 표준화 필요 |
| WHO | 플랫폼 팀, 인프라 운영자 |
| RISK | Crossplane 학습 곡선, Provider 호환성 |
| SUCCESS | XRD 3개+, Composition 5개+, 인프라 프로비저닝 E2E 검증 |
| SCOPE | Crossplane Core, Provider-Kubernetes, XRD, Composition |

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|----------|
| FR-N99.1 | Crossplane 설치 Helm values | values.yaml 포함 |
| FR-N99.2 | Provider-Kubernetes 설정 | 로컬 k3s Provider |
| FR-N99.3 | XRD 정의 (DB, 캐시, 스토리지) | 3개 XRD |
| FR-N99.4 | Composition 정의 | 5개+ Composition |
| FR-N99.5 | Claim 예제 + 검증 | 동작 검증 |
| FR-N99.6 | E2E 테스트 작성 | 12건+ ALL PASS |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
