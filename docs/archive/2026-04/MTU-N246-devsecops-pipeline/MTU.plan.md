# Plan: MTU-N246 DevSecOps 파이프라인 통합

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 보안 스캔 자동화로 취약점 조기 발견, CSAP 감리 대응 |
| 기술 | Trivy(IaC/이미지) + Semgrep(SAST) + Kyverno(enforce) 통합 워크플로우 |
| 보안 | OWASP Top10, 공급망 보안(SBOM/Cosign), 이미지 무결성 |
| 운영 | 단일 보안 파이프라인으로 관리 포인트 통합 |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-N246.1 | Trivy IaC 스캔 (Helm/k8s YAML) | P0 | 스캔 결과 출력 |
| FR-N246.2 | Trivy 이미지 취약점 스캔 (HIGH/CRITICAL) | P0 | 취약점 보고서 |
| FR-N246.3 | Semgrep SAST 품질 게이트 | P1 | 0 high findings |
| FR-N246.4 | Kyverno 정책 사전 검증 (dry-run) | P1 | kyverno apply --dry-run |
| FR-N246.5 | 보안 스캔 결과 아티팩트 보관 | P0 | 365일 보관 |
| FR-N246.6 | DevSecOps 통합 워크플로우 | P0 | 단일 워크플로우 실행 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | DevSecOps 통합 워크플로우 | `.gitea/workflows/devsecops.yml` |
| 2 | Trivy 설정 파일 | `infra/security/trivy/trivy.yaml` |
| 3 | Kyverno 사전 검증 스크립트 | `scripts/kyverno-dry-run.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 작성 | PM Lead |
