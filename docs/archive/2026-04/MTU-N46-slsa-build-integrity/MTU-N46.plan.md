# MTU-N46: SLSA Level 3 빌드 무결성 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (Opus)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 공급망 보안 국제 표준 달성으로 공공기관 신뢰도 극대화 |
| 기술 | 빌드 출처 증명(Provenance) + 격리 빌드 + 서명 검증 파이프라인 |
| 보안 | SLSA L3 요건: 격리 빌드, 에페머럴 환경, 빌드 플랫폼 서명 |
| 운영 | Cosign + in-toto 기반 자동화된 빌드 증명 생성/검증 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | MTU-C8 SBOM + MTU-N37 Grype 기반 위에 SLSA L3 달성으로 공급망 보안 완성 |
| WHO | DevSecOps, 보안감사팀, 빌드 엔지니어 |
| RISK | Gitea Actions 격리 환경 제약, 키 관리 복잡도 |
| SUCCESS | SLSA L3 체크리스트 100%, 빌드 증명 자동 생성/검증 |
| SCOPE | 빌드 증명 생성 + 검증 정책 + Kyverno 연동 + 검증 스크립트 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | CSAP 매핑 |
|----|---------|---------|----------|
| FR-N46.1 | SLSA L3 체크리스트 문서 | 필수 | D-12 |
| FR-N46.2 | 빌드 증명(Provenance) 생성 워크플로우 | 필수 | D-12 |
| FR-N46.3 | 격리 빌드 환경 설정 (에페머럴 러너) | 필수 | D-12 |
| FR-N46.4 | in-toto attestation 형식 증명 | 필수 | D-12 |
| FR-N46.5 | Cosign 기반 증명 서명 + 검증 | 필수 | D-09 |
| FR-N46.6 | Kyverno 빌드 증명 검증 정책 | 필수 | D-08 |
| FR-N46.7 | SLSA 검증 스크립트 | 필수 | D-12 |
| FR-N46.8 | 테스트 (증명 생성→서명→검증 전 주기) | 필수 | D-12 |

---

## 산출물

| 산출물 | 경로 |
|--------|------|
| SLSA L3 체크리스트 | `docs/security/slsa-l3-checklist.md` |
| 빌드 증명 워크플로우 | `.gitea/workflows/slsa-provenance.yml` |
| 빌드 증명 검증 정책 | `infra/kyverno/verify-provenance.yaml` |
| 증명 생성 스크립트 | `scripts/generate-provenance.sh` |
| 검증 스크립트 | `scripts/verify-slsa.sh` |
| 테스트 스크립트 | `scripts/test-slsa-provenance.sh` |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
