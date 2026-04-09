# SBOM (Software Bill of Materials) 구현 가이드

| 항목 | 내용 |
|------|------|
| 문서 ID | SC-SBOM-001 |
| 버전 | 1.0.0 |
| 최종 수정일 | 2026-04-05 |
| 대상 독자 | DevOps 엔지니어, 보안 담당자, CSAP 심사 대응 팀 |
| FR 매핑 | FR-10.1 (SBOM 자동 생성) |
| MTU 매핑 | MTU-C8 |
| 관련 문서 | [Sigstore 서명 가이드](sigstore-signing.md), [Gitea CI/CD](../gitea-cicd-guide.md), [CSAP D05](../../02-csap/standard-grade/implementation-guide/D05-supply-chain.md) |

<!-- Design Ref: MTU-C8 Plan -- Supply Chain Security SBOM -->
<!-- Plan SC: SBOM 자동 생성, 의존성 전수 추적, CSAP-D05 매핑 -->

---

## 1. 개요

소프트웨어 구성 요소의 완전한 목록(SBOM)을 자동으로 생성하여, 공급망 취약점을 추적하고 CSAP-D05 공급망 보안 요건을 충족합니다.

### 규제 배경

| 규제 | 요건 | 시행일 |
|------|------|--------|
| EU CRA (Cyber Resilience Act) | SBOM 의무화 (중견 기업 이상) | 2027 |
| NIST SSDF | 소프트웨어 구성 요소 추적 권고 | 2022 (개정 2025) |
| SLSA 1.0 | 공급망 보안 성숙도 프레임워크 | 2025 확정 |
| CSAP-D05 | 공급업체 보안 관리 4항목 | 현행 |

### 도구 선택

| 도구 | 용도 | 선택 근거 |
|------|------|---------|
| **Syft** (Anchore) | SBOM 생성 | SPDX/CycloneDX 이중 포맷, OCI 이미지 직접 스캔, 폐쇄망 동작 |
| **Trivy** (Aqua) | 취약점 스캔 | Harbor 내장 연동, 오프라인 DB, CVSS 점수 자동 |
| **Grype** (Anchore) | 취약점 매칭 | SBOM 입력으로 취약점 매칭, Syft 출력 직접 연동 |

---

## 2. SBOM 생성

### 2.1 Syft 설치

```bash
# 온라인 설치
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# 폐쇄망: 바이너리 직접 다운로드 후 이동
# https://github.com/anchore/syft/releases 에서 Linux AMD64 바이너리
chmod +x syft && sudo mv syft /usr/local/bin/

# 버전 확인
syft version
```

### 2.2 SBOM 생성 명령어

```bash
# 컨테이너 이미지에서 SBOM 생성 (SPDX JSON 형식)
syft harbor.internal/saas-org/saas-app:v1.0.0 -o spdx-json > sbom-saas-app-v1.0.0.spdx.json

# CycloneDX 형식 (OWASP 표준)
syft harbor.internal/saas-org/saas-app:v1.0.0 -o cyclonedx-json > sbom-saas-app-v1.0.0.cdx.json

# 소스 디렉터리에서 SBOM 생성
syft dir:./src -o spdx-json > sbom-source.spdx.json

# 결과 확인 (패키지 수, 라이선스 목록)
cat sbom-saas-app-v1.0.0.spdx.json | jq '.packages | length'
cat sbom-saas-app-v1.0.0.spdx.json | jq '[.packages[].licenseConcluded] | unique'
```

### 2.3 SBOM SPDX JSON 구조

```json
{
  "spdxVersion": "SPDX-2.3",
  "dataLicense": "CC0-1.0",
  "SPDXID": "SPDXRef-DOCUMENT",
  "name": "saas-app-v1.0.0",
  "documentNamespace": "https://harbor.internal/saas-org/saas-app-v1.0.0",
  "creationInfo": {
    "created": "2026-04-05T00:00:00Z",
    "creators": ["Tool: syft-1.4.0"],
    "licenseListVersion": "3.21"
  },
  "packages": [
    {
      "SPDXID": "SPDXRef-Package-npm-express-4.18.2",
      "name": "express",
      "versionInfo": "4.18.2",
      "supplier": "Organization: OpenJS Foundation",
      "downloadLocation": "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
      "licenseConcluded": "MIT",
      "externalRefs": [
        {
          "referenceCategory": "SECURITY",
          "referenceType": "cpe23Type",
          "referenceLocator": "cpe:2.3:a:expressjs:express:4.18.2:*:*:*:*:node.js:*:*"
        },
        {
          "referenceCategory": "PACKAGE-MANAGER",
          "referenceType": "purl",
          "referenceLocator": "pkg:npm/express@4.18.2"
        }
      ]
    }
  ],
  "relationships": [
    {
      "spdxElementId": "SPDXRef-DOCUMENT",
      "relationshipType": "DESCRIBES",
      "relatedSpdxElement": "SPDXRef-Package-npm-express-4.18.2"
    }
  ]
}
```

---

## 3. 취약점 스캔 (CSAP-D05-02)

### 3.1 Trivy 이미지 스캔

```bash
# Harbor 내장 Trivy 자동 스캔 (Harbor UI에서 확인 가능)
# 수동 스캔도 가능:

# 이미지 취약점 스캔
trivy image harbor.internal/saas-org/saas-app:v1.0.0

# SBOM 기반 취약점 스캔
trivy sbom sbom-saas-app-v1.0.0.spdx.json

# JSON 형식 출력 (CI/CD 파이프라인용)
trivy image --format json --output trivy-results.json \
  harbor.internal/saas-org/saas-app:v1.0.0

# Critical/High만 필터
trivy image --severity CRITICAL,HIGH \
  harbor.internal/saas-org/saas-app:v1.0.0
```

### 3.2 Grype SBOM 기반 취약점 매칭

```bash
# Grype 설치
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# SBOM 입력으로 취약점 검색
grype sbom:sbom-saas-app-v1.0.0.spdx.json

# JSON 출력 (감사 기록용)
grype sbom:sbom-saas-app-v1.0.0.spdx.json -o json > vulnerabilities.json
```

### 3.3 Trivy 오프라인 DB 관리

```bash
# 외부망에서 Trivy DB 다운로드
oras pull ghcr.io/aquasecurity/trivy-db:2 --output trivy-db/
oras pull ghcr.io/aquasecurity/trivy-java-db:1 --output trivy-java-db/

# 내부망으로 이동 후 DB 업데이트
trivy image --skip-db-update --db-repository file:///opt/trivy-db \
  harbor.internal/saas-org/saas-app:v1.0.0

# 주간 업데이트 스크립트 (crontab)
# 0 9 * * 1 /opt/scripts/update-trivy-db.sh
```

---

## 4. CVE 대응 프로세스 (CSAP-D05-04)

### 4.1 CVSS 등급별 대응 SLA

| CVSS 등급 | 점수 범위 | 조치 기한 | 알림 채널 | 감사 기록 |
|---------|---------|---------|---------|---------|
| Critical | 9.0~10.0 | 24시간 | 즉시 보안담당자 + CISO | audit.jsonl 즉시 기록 |
| High | 7.0~8.9 | 72시간 | 보안담당자 | audit.jsonl 기록 |
| Medium | 4.0~6.9 | 7일 | 개발팀 주간 보고 | 주간 리포트 |
| Low | 0.1~3.9 | 다음 정기 배포 | 월간 패치 노트 | 월간 리포트 |

### 4.2 CVE 대응 흐름

```
CVE 공개/발견
      │
      ▼
[Trivy 자동 스캔]           ◀── Gitea Actions 일간 스케줄
      │
      ├── CVSS 9.0+  → [즉시 알림] → [24시간 패치] → [SBOM 재생성] → [이미지 재서명]
      ├── CVSS 7.0+  → [72시간 패치] → [SBOM 재생성] → [이미지 재서명]
      ├── CVSS 4.0+  → [7일 패치] → [다음 빌드 시 반영]
      └── CVSS <4.0  → [다음 정기 배포 반영]
      │
      ▼
[패치 후 검증]
      ├── SBOM 재생성 (Syft)
      ├── 이미지 재서명 (Cosign)           ◀── sigstore-signing.md
      └── audit.jsonl 기록
          {
            "action": "CVE_REMEDIATION",
            "cveId": "CVE-2026-XXXXX",
            "cvss": 9.1,
            "package": "openssl@3.0.12",
            "patchedVersion": "3.0.13",
            "remediatedAt": "2026-04-05T12:00:00Z"
          }
```

### 4.3 Gitea Actions 일간 스캔 워크플로우

```yaml
# .gitea/workflows/daily-security-scan.yaml
name: Daily Security Scan
on:
  schedule:
    - cron: '0 2 * * *'    # 매일 오전 2시
  workflow_dispatch: {}

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Trivy 이미지 스캔
        run: |
          trivy image --severity CRITICAL,HIGH \
            --format json --output trivy-results.json \
            harbor.internal/saas-org/saas-app:latest

      - name: Critical CVE 확인
        run: |
          CRITICAL_COUNT=$(jq '[.Results[].Vulnerabilities[]? | select(.Severity=="CRITICAL")] | length' trivy-results.json)
          if [ "$CRITICAL_COUNT" -gt 0 ]; then
            echo "CRITICAL 취약점 ${CRITICAL_COUNT}건 발견!"
            # 보안담당자 알림 (Gitea 이슈 자동 생성)
            # curl -X POST "https://gitea.internal/api/v1/repos/saas-org/saas-app/issues" ...
            exit 1
          fi

      - name: SBOM 갱신
        run: |
          syft harbor.internal/saas-org/saas-app:latest \
            -o spdx-json > sbom-latest.spdx.json

      - name: 감사 기록
        run: |
          echo '{"action":"DAILY_SECURITY_SCAN","timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","criticalCount":'$CRITICAL_COUNT'}' \
            >> /var/log/audit/audit.jsonl
```

---

## 5. 오픈소스 라이선스 준수

### 5.1 라이선스 분류

| 라이선스 유형 | 공공 SaaS 사용 | 조건 | 예시 |
|------------|-------------|------|------|
| MIT, Apache-2.0, BSD | 허용 | 귀속 표시 필수 | React, Express, Lodash |
| ISC, Zlib, Unlicense | 허용 | 귀속 표시 권장 | semver, glob |
| LGPL-2.1, LGPL-3.0 | 조건부 허용 | 동적 링크만, 수정 시 공개 | GCC runtime |
| MPL-2.0 | 조건부 허용 | 수정 파일만 공개 | Firefox 컴포넌트 |
| GPL-2.0, GPL-3.0 | 금지 (원칙) | 법무 검토 필요 | Linux kernel (시스템 수준 예외) |
| AGPL-3.0 | 금지 | 네트워크 서비스 소스 공개 의무 | MongoDB 이전 버전 |
| SSPL-1.0 | 금지 | 서비스 전체 소스 공개 | MongoDB 현재 |

### 5.2 자동 라이선스 검사

```bash
# SBOM에서 라이선스 목록 추출
syft harbor.internal/saas-org/saas-app:v1.0.0 -o spdx-json \
  | jq -r '.packages[].licenseConcluded' | sort | uniq -c | sort -rn

# 금지 라이선스 탐지 스크립트
cat > check-licenses.sh << 'SCRIPT'
#!/bin/bash
FORBIDDEN=("GPL-3.0-only" "GPL-3.0-or-later" "AGPL-3.0-only" "AGPL-3.0-or-later" "SSPL-1.0")
SBOM_FILE=$1

for license in "${FORBIDDEN[@]}"; do
  COUNT=$(jq -r --arg lic "$license" '[.packages[] | select(.licenseConcluded == $lic)] | length' "$SBOM_FILE")
  if [ "$COUNT" -gt 0 ]; then
    echo "WARNING: 금지 라이선스 $license 발견 ($COUNT 패키지)"
    jq -r --arg lic "$license" '.packages[] | select(.licenseConcluded == $lic) | "\(.name)@\(.versionInfo)"' "$SBOM_FILE"
  fi
done
SCRIPT
chmod +x check-licenses.sh

# 실행
./check-licenses.sh sbom-saas-app-v1.0.0.spdx.json
```

### 5.3 Gitea Actions 라이선스 검사 통합

```yaml
# .gitea/workflows/ci.yaml 내 라이선스 검사 단계 추가
      - name: 라이선스 검사
        run: |
          syft dir:. -o spdx-json > sbom-source.spdx.json
          ./scripts/check-licenses.sh sbom-source.spdx.json
```

---

## 6. SBOM 저장 및 관리

### 6.1 SBOM 저장소 구조

```
harbor.internal/saas-org/
├── saas-app:v1.0.0                    # 컨테이너 이미지
├── saas-app:v1.0.0.sbom               # SBOM 아티팩트 (OCI 첨부)
└── saas-app:v1.0.0.sig                # Cosign 서명 (OCI 첨부)
```

### 6.2 SBOM OCI 첨부 (Cosign)

```bash
# SBOM을 이미지에 OCI 아티팩트로 첨부
cosign attach sbom --sbom sbom-saas-app-v1.0.0.spdx.json \
  harbor.internal/saas-org/saas-app:v1.0.0

# SBOM 조회
cosign download sbom harbor.internal/saas-org/saas-app:v1.0.0
```

---

## 7. CSAP-D05 항목별 구현 매핑

| CSAP 항목 | 요건 | 구현 방법 | 검증 방법 |
|---------|------|---------|---------|
| CSAP-D05-01 | 공급업체 보안 계약 | 계약서 보안 부속서 템플릿 | 계약서 보안 조항 확인 |
| CSAP-D05-02 | 공급망 위험 평가 | Syft SBOM + Trivy 스캔 | SBOM 생성 + CVE 0 Critical 확인 |
| CSAP-D05-03 | 소프트웨어 무결성 검증 | Cosign 서명 + Rekor 로그 | `cosign verify` 성공 |
| CSAP-D05-04 | 보안 변경 알림 | Trivy 일간 스캔 + CVSS SLA | 알림 채널 동작 확인 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — SBOM 생성 + 취약점 스캔 + CVE 대응 + 라이선스 준수 | Claude Code |
