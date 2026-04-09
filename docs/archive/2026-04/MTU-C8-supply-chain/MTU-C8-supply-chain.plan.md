# MTU-C8 Plan: Supply Chain Security (SBOM + Sigstore)

> **MTU ID**: MTU-C8
> **Phase**: Phase 2 Core Security
> **의존 MTU**: MTU-I2 (Gitea CI/CD 파이프라인)
> **작성일**: 2026-04-05
> **작성자**: PM Lead Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 문제 | 컨테이너 이미지 공급망 보안 미구현 — 무결성 검증 불가 |
| 솔루션 | SBOM 자동 생성 + Cosign 이미지 서명 + 검증 자동화 |
| 기능/UX | CI/CD 파이프라인에서 자동 SBOM 생성 및 서명 |
| 핵심 가치 | CSAP D-05 공급망 보안 + EU CRA 대응 |

---

## SUCCESS
| ID | 기준 |
|----|------|
| SC-C8-01 | SBOM(CycloneDX/SPDX) 자동 생성 |
| SC-C8-02 | Cosign 이미지 서명 + 검증 |
| SC-C8-03 | Gitea Actions 파이프라인 통합 |

---

## 산출물 목록

| 산출물 | 경로 | FR ID |
|--------|------|-------|
| SBOM 가이드 | `docs/framework/08-infra/supply-chain/sbom-guide.md` | FR-C8.1 |
| Sigstore 서명 가이드 | `docs/framework/08-infra/supply-chain/sigstore-signing.md` | FR-C8.2 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 | PM Lead Agent |
| 1.0.1 | 2026-04-07 | 아카이브 동기화 시 재작성 | PM Lead Agent |
