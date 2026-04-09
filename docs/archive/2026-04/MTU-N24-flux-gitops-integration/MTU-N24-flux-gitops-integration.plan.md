# Plan: MTU-N24 Flux GitOps 연동 심화

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 폐쇄망 GitOps 자동 배포 파이프라인 완성 |
| 기술 | Gitea + Flux v2 GitRepository/Kustomization 연동 |
| 보안 | 배포 변경 추적, CSAP D-12 준수 |
| 운영 | Git Push 시 3분 이내 자동 배포, 감사 추적 |

## Context Anchor

- **WHY**: Flux 컨트롤러 설치됨, GitOps 리소스 미생성 → 실제 자동 배포 미동작
- **WHO**: DevOps 엔지니어, 보안 담당자
- **RISK**: Gitea 인증 실패, reconcile 무한 루프
- **SUCCESS**: 5개 FR 전수 충족
- **SCOPE**: Gitea + Flux 연동 + 알림 + 가이드 문서

---

## 기능 요구사항

| FR ID | 요구사항 | 수용 기준 | CSAP 매핑 |
|-------|---------|---------|----------|
| FR-N24.1 | Gitea 저장소에 Flux GitRepository 연동 | GitRepository 리소스 Ready 상태 | D-12 |
| FR-N24.2 | Kustomization 리소스 자동 배포 | 샘플 앱 자동 배포 확인 | D-12 |
| FR-N24.3 | Git Push 후 3분 이내 반영 | Push → Pod 업데이트 3분 이내 | D-12 |
| FR-N24.4 | Flux 알림 → Gitea 커밋 상태 | Provider + Alert 리소스 동작 | D-06 |
| FR-N24.5 | Flux GitOps 연동 가이드 문서 | 설정 절차 + 트러블슈팅 포함 | - |

---

## 산출물 목록

| 산출물 | 경로 | FR 매핑 |
|--------|------|---------|
| GitRepository 매니페스트 | infra/flux/gitea-source.yaml | FR-N24.1 |
| Kustomization 매니페스트 | infra/flux/app-kustomization.yaml | FR-N24.2 |
| 샘플 앱 매니페스트 | infra/flux/sample-app/ | FR-N24.3 |
| 알림 리소스 매니페스트 | infra/flux/notification.yaml | FR-N24.4 |
| GitOps 연동 가이드 | docs/08-infra/flux-gitops-integration-guide.md | FR-N24.5 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
