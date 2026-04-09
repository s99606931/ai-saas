# Plan: MTU-N37 SBOM 생성 + Grype 취약점 스캔 파이프라인

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead
> **PRD 참조**: `docs/00-pm/MTU-N37-sbom-grype-pipeline.prd.md`

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-12 공급망 보안 자동화, 감리 증적 자동 생성 |
| 기술 | Syft SBOM + Grype CVE 스캔 + Cosign attestation CI/CD 통합 |
| 보안 | Trivy 대체(공급망 공격 대응), 이미지 다이제스트 핀 고정 |
| 운영 | 빌드당 2분 이내 추가, 아티팩트 365일 보존 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | CSAP D-12 공급망 보안 자동화 + Trivy 공급망 공격 대응 |
| WHO | DevOps 엔지니어, 보안 담당자, 감리관 |
| RISK | DB 업데이트 실패, 빌드 지연, false positive |
| SUCCESS | SBOM 자동 생성 + Grype High/Critical 0건 + attestation 첨부 |
| SCOPE | Syft + Grype + Gitea Actions 통합 (Trivy 제외) |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 방법 |
|-------|---------|---------|---------|
| FR-N37.1 | Syft로 CycloneDX 1.6 SBOM 생성 (모든 서비스 이미지) | P0 | SBOM JSON 파일 존재 확인 |
| FR-N37.2 | Grype로 SBOM 기반 취약점 스캔 | P0 | 스캔 결과 JSON 출력 |
| FR-N37.3 | High/Critical 취약점 발견 시 파이프라인 차단 | P0 | --fail-on high 플래그 |
| FR-N37.4 | SBOM + 스캔 결과 아티팩트 보존 (365일) | P1 | upload-artifact 확인 |
| FR-N37.5 | Cosign SBOM attestation 첨부 | P1 | cosign verify-attestation |
| FR-N37.6 | 독립 sbom-scan.yml 워크플로우 생성 | P0 | 파일 존재 + 실행 가능 |
| FR-N37.7 | 기존 ci-cd-pipeline.yml에 SBOM 단계 통합 | P1 | pipeline 워크플로우 확인 |
| FR-N37.8 | 감사 로그 기록 (SBOM 생성/스캔 결과) | P1 | audit.jsonl 항목 |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N37.1 | SBOM 생성 소요 시간 | 서비스당 60초 이내 |
| NFR-N37.2 | Grype 스캔 소요 시간 | 서비스당 90초 이내 |
| NFR-N37.3 | 이미지 참조 다이제스트 핀 고정 | SHA256 다이제스트 사용 |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | SBOM/Grype 워크플로우 | `.gitea/workflows/sbom-scan.yml` |
| 2 | 통합 파이프라인 SBOM 단계 | `.gitea/workflows/ci-cd-pipeline.yml` (수정) |
| 3 | Grype 설정 파일 | `infra/security/.grype.yaml` |
| 4 | SBOM 운영 가이드 | `docs/framework/08-infra/supply-chain/sbom-pipeline-guide.md` |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|-----------|---------|--------|------|
| FR-N37.1 | S3.1 | sbom-scan.yml | SC-N37.1 | D-12-03 |
| FR-N37.2 | S3.2 | sbom-scan.yml | SC-N37.3 | D-12-03 |
| FR-N37.3 | S3.2 | sbom-scan.yml | SC-N37.3 | D-12-03 |
| FR-N37.4 | S3.3 | sbom-scan.yml | SC-N37.4 | D-06 |
| FR-N37.5 | S3.4 | sbom-scan.yml | SC-N37.5 | D-11 |
| FR-N37.6 | S3.1 | sbom-scan.yml | SC-N37.1 | D-12 |
| FR-N37.7 | S3.5 | ci-cd-pipeline.yml | SC-N37.1 | D-12 |
| FR-N37.8 | S3.6 | sbom-scan.yml | SC-N37.4 | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
