# MTU-N35: CI/CD 완전 자동화 시스템 + 사용자 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead
> **복잡도**: HIGH | **의존**: MTU-I2, MTU-I3, MTU-N24, MTU-N27

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Gitea Push부터 k3s 배포까지 완전 자동화된 CI/CD 파이프라인으로 배포 리드타임 단축 |
| 기술 | Gitea Actions → Harbor 이미지 빌드/푸시 → Cosign 서명 → Flux GitOps 자동 배포 |
| 규제 | CSAP D-12(시스템 개발 보안), D-06(감사 로그), D-08(접근 통제) 준수 |
| 운영 | 초급자도 따라할 수 있는 단계별 사용자 가이드 제공 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 CI/CD 워크플로우가 개별 파일로 분산되어 있어 통합 파이프라인 필요 |
| WHO | DevOps 엔지니어, 플랫폼 관리자, 신규 개발자 |
| RISK | Harbor 연결 장애, Cosign 서명 키 관리 미숙, Flux 동기화 지연 |
| SUCCESS | 전 파이프라인 자동화 + 사용자 가이드 완성 (matchRate >= 90%) |
| SCOPE | CI/CD 전체 파이프라인 통합 워크플로우, Flux 설정 강화, 배포 스크립트, 사용자 가이드 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 기준 |
|-------|---------|---------|----------|
| FR-N35.1 | 통합 CI/CD 파이프라인 워크플로우 (빌드→테스트→Harbor 푸시→서명→배포) | P0 | 워크플로우 YAML 존재 및 문법 유효 |
| FR-N35.2 | Flux GitOps 자동 배포 설정 (HelmRelease + GitRepository + Kustomization) | P0 | Flux CRD 리소스 완전성 |
| FR-N35.3 | 원클릭 배포 스크립트 (deploy-to-k3s.sh) | P1 | 스크립트 실행 가능 + 단계별 출력 |
| FR-N35.4 | CI/CD 사용자 가이드 (Docusaurus 마크다운) | P0 | 10개 이상 단계, 스크린샷 설명 포함 |
| FR-N35.5 | 환경별 values 파일 (dev, stg, prod) | P1 | 각 환경 설정 분리 확인 |
| FR-N35.6 | 감사 로그 통합 (CSAP D-06) | P1 | 모든 배포 이벤트 audit.jsonl 기록 |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N35.1 | 파이프라인 전체 실행 시간 | 15분 이내 (빌드→배포) |
| NFR-N35.2 | 실패 시 자동 롤백 | Helm rollback 자동 트리거 |
| NFR-N35.3 | 시크릿 노출 방지 | 모든 민감값 Gitea Secrets 사용 |

---

## 산출물 목록

| 산출물 | 경로 | 유형 |
|--------|------|------|
| 통합 CI/CD 파이프라인 | `.gitea/workflows/ci-cd-pipeline.yml` | 워크플로우 |
| Flux HelmRelease | `infra/flux/helm-release.yaml` | K8s CRD |
| Flux Kustomization (전체) | `infra/flux/platform-kustomization.yaml` | K8s CRD |
| 원클릭 배포 스크립트 | `scripts/deploy-to-k3s.sh` | Bash |
| CI/CD 사용자 가이드 | `docs-portal/docs/deployment/cicd-user-guide.md` | Docusaurus MD |

---

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N35.1 | ci-cd-pipeline.yml | 문법 검증 | D-12 |
| FR-N35.2 | helm-release.yaml, platform-kustomization.yaml | CRD 유효성 | D-12, D-11 |
| FR-N35.3 | deploy-to-k3s.sh | 스크립트 실행 | D-12 |
| FR-N35.4 | cicd-user-guide.md | 문서 완전성 | D-06 |
| FR-N35.5 | values 파일 | 환경 분리 | D-08 |
| FR-N35.6 | audit 통합 | 로그 기록 확인 | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
