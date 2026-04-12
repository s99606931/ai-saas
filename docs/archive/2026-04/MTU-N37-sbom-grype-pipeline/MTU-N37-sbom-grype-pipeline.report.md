# Report: MTU-N37 SBOM 생성 + Grype 취약점 스캔 파이프라인

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead

---

## Executive Summary

| 관점 | 결과 |
|------|------|
| 비즈니스 | CSAP D-12-03 공급망 보안 자동화 100% 달성 |
| 기술 | Syft SBOM + Grype 스캔 + Cosign attestation CI/CD 통합 완료 |
| 보안 | Trivy 공급망 공격 대응 -- Grype 채택, 다이제스트 핀 고정 |
| 운영 | 독립 워크플로우 + 기존 파이프라인 통합 이중 구조 |

---

## 성공 기준 달성 현황

| ID | 기준 | 결과 | 상태 |
|----|------|------|------|
| SC-N37.1 | 모든 서비스 SBOM 자동 생성 | sbom-scan.yml 17개 서비스 matrix | PASS |
| SC-N37.2 | CycloneDX 또는 SPDX JSON | CycloneDX 1.6 + SPDX 2.3 동시 생성 | PASS |
| SC-N37.3 | Grype High/Critical 0건 차단 | .grype.yaml fail-on-severity: high | PASS |
| SC-N37.4 | 아티팩트 365일 보존 | retention-days: 365 설정 | PASS |
| SC-N37.5 | Cosign SBOM attestation | cosign attest --type cyclonedx 구현 | PASS |

---

## FR 추적성 검증

| FR ID | 요구사항 | 구현 | 상태 |
|-------|---------|------|------|
| FR-N37.1 | Syft CycloneDX SBOM | sbom-scan.yml Stage 1 | PASS |
| FR-N37.2 | Grype 취약점 스캔 | sbom-scan.yml Stage 2 | PASS |
| FR-N37.3 | High/Critical 차단 | .grype.yaml fail-on: high | PASS |
| FR-N37.4 | 365일 아티팩트 보존 | upload-artifact retention-days: 365 | PASS |
| FR-N37.5 | Cosign attestation | sbom-scan.yml Stage 3 | PASS |
| FR-N37.6 | 독립 워크플로우 | sbom-scan.yml 생성 | PASS |
| FR-N37.7 | pipeline 통합 | ci-cd-pipeline.yml Stage 4b | PASS |
| FR-N37.8 | 감사 로그 | audit.jsonl 항목 기록 | PASS |

---

## 산출물

| 번호 | 산출물 | 경로 | 상태 |
|------|--------|------|------|
| 1 | SBOM/Grype 워크플로우 | `.gitea/workflows/sbom-scan.yml` | 완료 |
| 2 | 통합 파이프라인 SBOM 단계 | `.gitea/workflows/ci-cd-pipeline.yml` | 수정 완료 |
| 3 | Grype 설정 파일 | `infra/security/.grype.yaml` | 완료 |
| 4 | SBOM 운영 가이드 | `docs/framework/08-infra/supply-chain/sbom-pipeline-guide.md` | 완료 |

---

## 주요 결정 사항

| 결정 | 근거 |
|------|------|
| Trivy 대신 Grype 채택 | 2026-03-19 Trivy 공급망 공격 (76/77 태그 변조) |
| CycloneDX 1.6 표준 채택 | OWASP 표준, CSAP D-12 호환 |
| 주간 정기 스캔 추가 | 새 CVE 지속 발견 대응 |
| 이중 구조 (독립 + 통합) | 유연성: 독립 스캔 + 파이프라인 내 게이트 |

---

## matchRate

**최종 matchRate: 100%** (8/8 FR 전수 충족, 5/5 SC 전수 통과)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
