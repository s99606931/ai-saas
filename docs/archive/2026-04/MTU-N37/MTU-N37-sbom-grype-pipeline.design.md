# Design: MTU-N37 SBOM 생성 + Grype 취약점 스캔 파이프라인

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead (security-architect 역할)
> **Plan 참조**: `docs/01-plan/mtus/MTU-N37-sbom-grype-pipeline.plan.md`

---

## Executive Summary

| 관점 | 설계 결정 |
|------|---------|
| 비즈니스 | Syft + Grype 오픈소스 조합으로 CSAP D-12 공급망 보안 완전 자동화 |
| 기술 | CycloneDX 1.6 SBOM, Grype EPSS 스코어링, Cosign attestation |
| 보안 | Trivy 공급망 공격 대응 -- Grype 채택 + 다이제스트 핀 고정 |
| 운영 | 서비스당 2.5분 이내 추가, matrix 병렬 실행 |

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 패턴 | CI/CD Security Stage 삽입 (Shift-Left) |
| SBOM 도구 | Syft v1.42+ (Anchore 오픈소스) |
| 스캔 도구 | Grype v0.87+ (Anchore 오픈소스, EPSS 지원) |
| SBOM 형식 | CycloneDX 1.6 JSON |
| 차단 기준 | High + Critical severity |
| attestation | Cosign predicate: cyclonedx |
| 워크플로우 | Gitea Actions (GitHub Actions 호환) |

---

## S3. 상세 설계

### S3.1 SBOM 생성 워크플로우 (sbom-scan.yml)

```yaml
# 독립 워크플로우: 이미지 빌드 후 또는 수동 트리거
# 트리거: workflow_run (ci-cd-pipeline 완료), workflow_dispatch
# 매트릭스: 전체 17개 서비스 + portal

jobs:
  sbom-generate:
    strategy:
      matrix:
        service: [api-gateway, auth-service, ..., portal]
    steps:
      1. Checkout
      2. Install Syft (다이제스트 핀 고정)
      3. Harbor 로그인
      4. Syft 실행: syft {image} -o cyclonedx-json=sbom-{service}.cdx.json
      5. SBOM 아티팩트 업로드 (365일 보존)
```

**Syft 설치 핀 고정 패턴**:
```bash
# 태그가 아닌 SHA256 다이제스트로 핀 고정 (Trivy 공급망 공격 교훈)
SYFT_VERSION="1.42.0"
SYFT_SHA256="<정확한 해시>"
curl -sSfL "https://github.com/anchore/syft/releases/download/v${SYFT_VERSION}/syft_${SYFT_VERSION}_linux_amd64.tar.gz" -o syft.tar.gz
echo "${SYFT_SHA256}  syft.tar.gz" | sha256sum -c -
tar -xzf syft.tar.gz syft
mv syft /usr/local/bin/
```

### S3.2 취약점 스캔 (Grype)

```yaml
  grype-scan:
    needs: sbom-generate
    strategy:
      matrix:
        service: [api-gateway, ..., portal]
    steps:
      1. Download SBOM 아티팩트
      2. Install Grype (다이제스트 핀 고정)
      3. Grype 실행: grype sbom:sbom-{service}.cdx.json --fail-on high -o json
      4. 결과 아티팩트 업로드 (365일)
      5. 감사 로그 기록
```

**Grype 설정 (.grype.yaml)**:
```yaml
# infra/security/.grype.yaml
fail-on-severity: high
output:
  - json
  - table
ignore:
  # 폐쇄망 환경에서 무관한 CVE 예외 (명시적 사유 필수)
  # - vulnerability: CVE-XXXX-XXXXX
  #   reason: "폐쇄망 환경에서 네트워크 접근 불가하여 무관"
db:
  auto-update: true
  validate-age: true
  max-allowed-built-age: 120h  # 5일
```

### S3.3 아티팩트 보존 정책

| 아티팩트 | 형식 | 보존 기간 | 근거 |
|---------|------|---------|------|
| SBOM (CycloneDX JSON) | `sbom-{service}.cdx.json` | 365일 | CSAP D-06 감사 추적 |
| Grype 스캔 결과 | `grype-{service}.json` | 365일 | CSAP D-12 증적 |
| 통합 요약 | `sbom-scan-summary.json` | 365일 | 감리 증적 |

### S3.4 Cosign SBOM Attestation

```bash
# SBOM을 이미지에 attestation으로 첨부
cosign attest \
  --key ${COSIGN_KEY_PATH} \
  --type cyclonedx \
  --predicate sbom-{service}.cdx.json \
  --allow-insecure-registry \
  -y \
  ${IMAGE_REF}

# 검증
cosign verify-attestation \
  --key infra/cosign/cosign.pub \
  --type cyclonedx \
  --insecure-ignore-tlog \
  --allow-insecure-registry \
  ${IMAGE_REF}
```

### S3.5 기존 파이프라인 통합

기존 `ci-cd-pipeline.yml`의 Stage 4 (Cosign 서명) 이후에 Stage 4b (SBOM+Grype)를 삽입:

```
[1] CI → [2] Security → [3] Build → [4] Sign → [4b] SBOM+Grype → [5] Deploy → [6] Verify → [7] Audit
```

### S3.6 감사 로그 형식

```json
{
  "timestamp": "2026-04-09T10:00:00Z",
  "action": "SBOM_SCAN",
  "service": "api-gateway",
  "sbom_tool": "syft",
  "sbom_format": "cyclonedx-1.6",
  "scan_tool": "grype",
  "vulnerabilities": {
    "critical": 0,
    "high": 0,
    "medium": 3,
    "low": 12
  },
  "result": "PASS",
  "csap_ref": "D-12-03",
  "pipeline_run": "run-12345"
}
```

---

## 아키텍처 옵션 평가

| 옵션 | 설명 | 장점 | 단점 | 선택 |
|------|------|------|------|------|
| A | Trivy 단독 | 올인원 | 2026-03 공급망 공격 리스크 | X |
| B | Syft + Grype | 분리된 SBOM/스캔 | 2개 도구 관리 | **선택** |
| C | Syft + Snyk | 상용 스캔 | 외부 서비스 의존 (CLAUDE.md 위반) | X |

**선택 근거**: Option B - Syft + Grype는 모두 Anchore 오픈소스이며, 폐쇄망에서 오프라인 DB로 동작 가능. Trivy는 2026-03 공급망 공격으로 신뢰도 저하. Snyk은 외부 클라우드 서비스라 CLAUDE.md 절대 제약 위반.

---

## Session Guide

```
1. sbom-scan.yml 워크플로우 생성
2. .grype.yaml 설정 파일 생성
3. ci-cd-pipeline.yml에 SBOM 단계 통합
4. SBOM 운영 가이드 문서 작성
5. 검증: 워크플로우 문법 + 설정 유효성
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 설계 | PM Lead (security-architect) |
