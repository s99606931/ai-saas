# Plan: MTU-N39 Sealed Secrets GitOps 시크릿 관리

> **버전**: 1.0.0 | **작성일**: 2026-04-09

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | GitOps 원칙 준수, 시크릿 관리 자동화 |
| 기술 | Bitnami Sealed Secrets + Flux 연동 |
| 보안 | CSAP D-09 암호화, CVE-2026-22728 대응 |
| 운영 | 시크릿 변경 = Git PR, 감사 추적 자동 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N39.1 | Sealed Secrets 컨트롤러 Helm 차트 설정 | P0 |
| FR-N39.2 | kubeseal CLI 설치 스크립트 | P0 |
| FR-N39.3 | 플랫폼 서비스 SealedSecret 템플릿 | P0 |
| FR-N39.4 | Flux Kustomization과 SealedSecret 연동 | P1 |
| FR-N39.5 | 키 로테이션 절차 문서 | P1 |
| FR-N39.6 | CVE-2026-22728 대응 (strict namespace scope) | P0 |
| FR-N39.7 | CSAP D-09 매핑 (암호화 요건 충족) | P1 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | Sealed Secrets Helm values | `infra/sealed-secrets/values.yaml` |
| 2 | SealedSecret 템플릿 | `infra/sealed-secrets/templates/` |
| 3 | Flux Kustomization | `infra/sealed-secrets/kustomization.yaml` |
| 4 | 운영 가이드 | `docs/framework/08-infra/sealed-secrets-guide.md` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
