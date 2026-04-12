# Plan: MTU-N245 GitOps 환경 승격 자동화 및 Canary 롤백

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 배포 안정성 향상, 자동 롤백으로 장애 시간 최소화 |
| 기술 | Flux ImagePolicy 자동 승격, Flagger Canary 전체 서비스 확장 |
| 보안 | 서명된 이미지만 배포 (Kyverno 연동), N2SF 등급별 정책 |
| 운영 | dev→stg→prod 자동 승격 파이프라인, 운영 가이드 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 현재 환경 승격이 수동, 롤백 기준이 명확하지 않음 |
| WHO | SRE, DevOps, 운영팀 |
| RISK | 자동 승격 실패 시 서비스 중단 → Canary 롤백으로 완화 |
| SUCCESS | 자동 승격 정상 동작, Canary 롤백 30초 이내 |
| SCOPE | Flux ImagePolicy, Flagger Canary 확장, 승격 스크립트 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-N245.1 | deploy/base에 공통 Deployment/Service 매니페스트 추가 | P0 | kustomize build 성공 |
| FR-N245.2 | Flux ImagePolicy로 dev→stg 자동 승격 | P1 | 이미지 태그 자동 업데이트 |
| FR-N245.3 | Flagger Canary를 핵심 서비스로 확장 | P1 | Canary 리소스 생성 확인 |
| FR-N245.4 | 환경 승격 스크립트 (수동 폴백용) | P0 | 스크립트 실행 확인 |
| FR-N245.5 | 프로덕션 배포 승인 게이트 (Flux suspend) | P1 | suspend/resume 워크플로우 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | Base Deployment | `deploy/base/deployment.yaml` |
| 2 | Base Service | `deploy/base/service.yaml` |
| 3 | Flux ImagePolicy | `infra/flux/image-policies/` |
| 4 | Flagger Canary 확장 | `infra/flagger/canary-services.yaml` |
| 5 | 환경 승격 스크립트 | `scripts/promote-env.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
