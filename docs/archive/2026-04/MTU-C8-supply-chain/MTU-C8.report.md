# MTU-C8 완료 보고서: Supply Chain Security

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C8 |
| Phase | Phase 2/3 |
| 완료일 | 2026-04-05 |
| 최종 매치율 | 100% (7/7 합격 기준 통과) |
| 반복 횟수 | 0 (1회 통과) |

---

## Executive Summary

| 관점 | 결과 |
|------|------|
| Problem | 소프트웨어 공급망 취약점 추적 부재, 이미지 무결성 검증 수단 없음 |
| Solution | Syft SBOM(SPDX) + Trivy 취약점 스캔 + Cosign 이미지 서명/검증 |
| 기능적 성과 | CSAP-D05 4항목 전수 자동화, CVE CVSS 등급별 SLA, 금지 라이선스 자동 탐지 |
| 핵심 가치 | EU CRA/SLSA L2 대응 + CSAP-D05 공급망 보안 완전 구현 |

---

## 산출물

| 파일 | 크기 | 내용 |
|------|------|------|
| `07-infra/supply-chain/sbom-guide.md` | 11.5KB | SBOM 생성 + 취약점 스캔 + CVE 대응 + 라이선스 |
| `07-infra/supply-chain/sigstore-signing.md` | 10.2KB | Cosign 서명/검증 + 키 관리 + Kyverno + SLSA |

## 합격 기준 결과

| # | 기준 | 결과 | 근거 |
|---|------|------|------|
| 1 | SBOM JSON 생성 | PASS | Syft 명령 + SPDX JSON 구조 예시 포함 |
| 2 | 의존성 전수 포함 | PASS | 직접/간접 의존성 + purl 참조 |
| 3 | Cosign sign/verify | PASS | 서명 + 검증 명령 + CI/CD 워크플로우 |
| 4 | Gitea Actions 통합 | PASS | 빌드→SBOM→서명 워크플로우 YAML |
| 5 | CSAP-D05 매핑 | PASS | D05-01~04 항목별 구현 방법 매핑 |
| 6 | CVE 대응 프로세스 | PASS | CVSS 등급별 SLA + 대응 흐름도 |
| 7 | 라이선스 준수 | PASS | 금지 목록 + 자동 탐지 스크립트 |
