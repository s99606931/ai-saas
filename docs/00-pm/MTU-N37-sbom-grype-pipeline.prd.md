# PRD: MTU-N37 SBOM 생성 + Grype 취약점 스캔 파이프라인

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead

---

## WHY (왜 필요한가)

공공기관 SaaS 프레임워크는 CSAP D-12(시스템 개발 보안)에 따라 소프트웨어 공급망 보안을 보장해야 한다.
현재 MTU-C8에서 SBOM/Cosign 개념 문서를 완성했으나, CI/CD 파이프라인에 Syft SBOM 생성과 Grype 취약점 스캔이 통합되지 않았다.
2026년 3월 Trivy 공급망 공격(CVE-2026-22728) 사례로 인해 Grype를 주력 스캐너로 채택한다.

## WHO (누가 사용하는가)

- **DevOps 엔지니어**: 빌드 파이프라인에서 자동 SBOM 생성 확인
- **보안 담당자**: 취약점 스캔 결과 리뷰 및 대응
- **감리관**: CSAP D-12 증적으로 SBOM 산출물 확인

## RISK (리스크)

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Grype DB 업데이트 실패 | 오래된 CVE 데이터로 스캔 | 오프라인 DB 캐시 + 주간 갱신 |
| SBOM 생성 빌드 시간 증가 | 파이프라인 지연 | 병렬 실행 + 캐싱 |
| false positive 과다 | 운영팀 피로 | severity 임계값 조정 (high 이상만 차단) |

## SUCCESS (성공 기준)

| ID | 기준 | 측정 방법 |
|----|------|---------|
| SC-N37.1 | 모든 서비스 이미지 빌드 시 SBOM 자동 생성 | Gitea workflow 실행 확인 |
| SC-N37.2 | SBOM 형식: CycloneDX 또는 SPDX JSON | 산출물 포맷 검증 |
| SC-N37.3 | Grype 취약점 스캔 High/Critical 0건 | 스캔 결과 로그 |
| SC-N37.4 | 스캔 결과 아티팩트로 보존 (365일) | artifact 보존 정책 |
| SC-N37.5 | SBOM을 Cosign 서명에 첨부 (attestation) | cosign attest 검증 |

## SCOPE (범위)

### In Scope
- Syft로 CycloneDX SBOM 생성 (모든 서비스 이미지)
- Grype로 취약점 스캔 (SBOM 기반)
- Gitea Actions 워크플로우 sbom-scan.yml 신규 생성
- 기존 ci-cd-pipeline.yml에 SBOM 단계 통합
- SBOM attestation (cosign attest)

### Out of Scope
- Trivy 사용 (공급망 공격 리스크로 제외)
- SBOM 중앙 저장소 구축 (향후 MTU)
- 라이선스 컴플라이언스 분석 (향후 MTU)

---

## 시장조사 결과 반영

- **Syft v1.42.0** (2026-02): CycloneDX 1.6, SPDX 2.3 지원, Go/Node/Python 전수 탐지
- **Grype v0.87+** (2026): EPSS + KEV 리스크 스코어링 지원, composite 0-10 점수
- **Trivy 공급망 공격** (2026-03-19): aquasecurity/trivy-action 76/77 태그 변조, CI 시크릿 탈취
  - 대응: Grype 채택 + 이미지 다이제스트 핀 고정 필수
- **CSAP D-12-03**: 소프트웨어 구성 분석(SCA) 자동화 요구 (2026 개정 반영)
