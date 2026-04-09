# SBOM 생성 + Grype 취약점 스캔 파이프라인 운영 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09 | **작성자**: PM Lead
> **Design Ref**: MTU-N37 Design
> **Plan SC**: FR-N37.1 ~ FR-N37.8
> **CSAP 참조**: D-12-03(공급망 보안), D-06(감사 추적), D-11(이미지 무결성)

---

## 1. 개요

### 1.1 목적

본 가이드는 공공기관 SaaS 플랫폼의 소프트웨어 공급망 보안을 위한 SBOM(Software Bill of Materials) 생성 및 취약점 스캔 파이프라인 운영 절차를 설명합니다.

### 1.2 도구 선택 근거

| 도구 | 버전 | 역할 | 선택 근거 |
|------|------|------|---------|
| **Syft** | v1.19.0+ | SBOM 생성 | Anchore 오픈소스, CycloneDX/SPDX 지원, 폐쇄망 동작 |
| **Grype** | v0.87.0+ | 취약점 스캔 | EPSS 스코어링, 오프라인 DB 지원, Trivy 대체 |
| **Cosign** | v3.0+ | SBOM Attestation | 이미지에 SBOM 첨부, 무결성 검증 |

> **중요**: Trivy는 2026년 3월 공급망 공격(aquasecurity/trivy-action 태그 변조)으로 인해 사용하지 않습니다. 모든 CI/CD 환경에서 Grype를 표준 취약점 스캐너로 사용합니다.

### 1.3 아키텍처

```
빌드 완료 → Syft SBOM 생성 → Grype 취약점 스캔 → Cosign SBOM Attestation
                ↓                    ↓                       ↓
         CycloneDX JSON        스캔 결과 JSON          이미지 메타데이터
                ↓                    ↓                       ↓
         아티팩트 보존(365일)   아티팩트 보존(365일)    Harbor 레지스트리
```

---

## 2. 워크플로우

### 2.1 독립 워크플로우 (sbom-scan.yml)

**위치**: `.gitea/workflows/sbom-scan.yml`

**트리거**:
- CI/CD Pipeline 성공 완료 후 자동 실행
- 수동 실행 (workflow_dispatch)
- 주간 정기 스캔 (매주 일요일 02:00 KST)

**단계**:
1. SBOM 생성 (Syft) -- 17개 서비스 병렬 실행
2. 취약점 스캔 (Grype) -- SBOM 기반 스캔
3. SBOM Attestation (Cosign) -- 이미지에 SBOM 첨부
4. 통합 요약 -- 결과 집계 및 감사 로그

### 2.2 통합 파이프라인 (ci-cd-pipeline.yml)

**위치**: `.gitea/workflows/ci-cd-pipeline.yml`

기존 7단계 파이프라인에 Stage 4b 추가:

```
[1] CI → [2] Security → [3] Build → [4] Sign → [4b] SBOM+Grype → [5] Deploy → [6] Verify → [7] Audit
```

### 2.3 수동 실행

```bash
# Gitea UI에서 Actions 탭 → SBOM & Vulnerability Scan → Run workflow
# 또는 API 호출:
curl -X POST "${GITEA_URL}/api/v1/repos/${OWNER}/${REPO}/actions/workflows/sbom-scan.yml/dispatches" \
  -H "Authorization: token ${GITEA_TOKEN}" \
  -d '{"ref":"stg","inputs":{"image_tag":"stg-abc1234"}}'
```

---

## 3. SBOM 형식

### 3.1 CycloneDX 1.6 JSON

SBOM은 OWASP CycloneDX 1.6 JSON 형식으로 생성됩니다.

**주요 필드**:
- `bomFormat`: CycloneDX
- `specVersion`: 1.6
- `components[]`: 발견된 소프트웨어 컴포넌트 목록
  - `name`: 패키지명
  - `version`: 버전
  - `purl`: Package URL (범용 식별자)
  - `type`: library, framework, application 등

### 3.2 SPDX JSON (보조)

SPDX 2.3 JSON도 동시 생성되어 표준 호환성을 보장합니다.

---

## 4. 취약점 스캔 정책

### 4.1 차단 기준

| 심각도 | 조치 | CVSS 범위 |
|--------|------|---------|
| Critical | 파이프라인 즉시 차단 | 9.0 ~ 10.0 |
| High | 파이프라인 차단 | 7.0 ~ 8.9 |
| Medium | 경고 (14일 내 대응) | 4.0 ~ 6.9 |
| Low | 정보 (분기별 검토) | 0.1 ~ 3.9 |
| Negligible | 무시 | 0.0 |

### 4.2 Grype 설정

**위치**: `infra/security/.grype.yaml`

```yaml
fail-on-severity: high
db:
  auto-update: true
  max-allowed-built-age: 120h  # 5일
```

### 4.3 예외 처리

취약점 예외(무시)는 `.grype.yaml`의 `ignore` 목록에 등록합니다.

**필수 요건**:
- 명시적 사유 기재
- 만료일 설정 (최대 90일)
- 보안 담당자 승인

```yaml
ignore:
  - vulnerability: CVE-2024-XXXXX
    reason: "폐쇄망 환경에서 네트워크 접근 불가하여 익스플로잇 불가"
    expires: "2026-07-01"
```

---

## 5. Cosign SBOM Attestation

### 5.1 SBOM 첨부

```bash
# SBOM을 이미지에 attestation으로 첨부
cosign attest \
  --key /opt/cosign/cosign.key \
  --type cyclonedx \
  --predicate sbom-service.cdx.json \
  --allow-insecure-registry \
  -y \
  localhost:8080/public-saas/service:tag
```

### 5.2 Attestation 검증

```bash
# SBOM attestation 검증
cosign verify-attestation \
  --key infra/cosign/cosign.pub \
  --type cyclonedx \
  --insecure-ignore-tlog \
  --allow-insecure-registry \
  localhost:8080/public-saas/service:tag
```

---

## 6. 폐쇄망 운영

### 6.1 Grype DB 오프라인 갱신

```bash
# 인터넷 가능 환경에서 DB 다운로드
grype db download
# DB 파일 위치: ~/.cache/grype/db/

# 폐쇄망으로 전송
scp ~/.cache/grype/db/vulnerability.db user@airgap-host:~/.cache/grype/db/

# 자동 갱신 비활성화 (폐쇄망)
# .grype.yaml:
#   db:
#     auto-update: false
```

### 6.2 Syft 오프라인 모드

Syft는 로컬 이미지/디렉토리 스캔 시 네트워크 불필요:
```bash
# 디렉토리 스캔 (네트워크 불필요)
syft dir:./platform/services/auth-service/ -o cyclonedx-json

# 로컬 Docker 이미지 스캔
syft docker:auth-service:latest -o cyclonedx-json
```

---

## 7. 감사 및 증적

### 7.1 감사 로그 형식

```json
{
  "timestamp": "2026-04-09T10:00:00Z",
  "action": "SBOM_SCAN",
  "service": "api-gateway",
  "sbom_tool": "syft",
  "sbom_format": "cyclonedx-1.6",
  "scan_tool": "grype",
  "vulnerabilities": {
    "critical": 0, "high": 0, "medium": 3, "low": 12
  },
  "result": "PASS",
  "csap_ref": "D-12-03"
}
```

### 7.2 감리 증적 매핑

| CSAP 항목 | 증적 | 보존 기간 |
|----------|------|---------|
| D-12-03 | SBOM JSON + Grype 결과 JSON | 365일 |
| D-06 | 감사 로그 (sbom-scan-audit.jsonl) | 365일 |
| D-11 | Cosign SBOM Attestation | 이미지 수명 |

---

## 8. 보안 고려사항

### 8.1 공급망 공격 방어

- **바이너리 체크섬 검증**: Syft, Grype 설치 시 SHA256 검증 필수
- **태그 대신 다이제스트 핀 고정**: CI 워크플로우 Actions 참조 시 커밋 SHA 사용
- **최소 권한**: SBOM 생성 서비스 계정은 읽기 전용 권한만 부여

### 8.2 Trivy 공급망 공격 교훈 (2026-03-19)

- aquasecurity/trivy-action의 76/77 태그가 변조되어 CI 시크릿 탈취 발생
- **대응**: Grype로 전환 + 모든 바이너리 다이제스트 핀 고정 의무화

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 -- MTU-N37 PDCA Do 단계 | PM Lead |
