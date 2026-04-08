# Trivy 컨테이너 이미지 스캔 가이드

> Plan SC: FR-N20.1
> Design Ref: D-N20.1
> CSAP: D-12-01 개발 보안 점검

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 도구 | Trivy (Aqua Security) |
| 대상 | 18개 서비스 Dockerfile |

---

## 1. Trivy 설치

### WSL2 (Ubuntu/Debian)

```bash
# APT 저장소 추가
sudo apt-get install -y wget apt-transport-https gnupg lsb-release
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | \
  gpg --dearmor | sudo tee /usr/share/keyrings/trivy.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb \
  $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt-get update
sudo apt-get install -y trivy

# 버전 확인
trivy --version
```

### Docker로 실행 (설치 없이)

```bash
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd)/reports:/reports \
  aquasec/trivy:latest image saas-auth:latest
```

---

## 2. 스캔 유형

### 2.1 파일시스템 스캔 (소스 코드 + 의존성)

```bash
# 프로젝트 전체 파일시스템 스캔
trivy fs --severity HIGH,CRITICAL \
  --ignore-unfixed \
  --format json \
  --output reports/vulnerability/trivy-fs-$(date +%Y%m%d).json \
  /data/ai-saas

# 테이블 형식 출력 (터미널 확인용)
trivy fs --severity HIGH,CRITICAL \
  --ignore-unfixed \
  --format table \
  /data/ai-saas
```

### 2.2 컨테이너 이미지 스캔

```bash
# 단일 서비스 이미지 스캔
docker build -t saas-auth:latest platform/services/auth-service/
trivy image --severity HIGH,CRITICAL \
  --ignore-unfixed \
  --format json \
  --output reports/vulnerability/trivy-image-auth-$(date +%Y%m%d).json \
  saas-auth:latest
```

### 2.3 전체 서비스 일괄 스캔

```bash
#!/bin/bash
# scripts/trivy-scan-all.sh
set -euo pipefail

REPORT_DIR="reports/vulnerability/$(date +%Y-%m)"
mkdir -p "$REPORT_DIR"

SERVICES=(
  auth user tenant api-gateway ai audit menu catalog
  subscription billing crm notification file compliance
  security security-monitor
)

echo "=== Trivy 전체 이미지 스캔 ==="
echo "일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "대상: ${#SERVICES[@]}개 서비스"
echo ""

FAIL_COUNT=0

for svc in "${SERVICES[@]}"; do
  SVC_DIR="platform/services/${svc}-service"
  if [ ! -f "${SVC_DIR}/Dockerfile" ]; then
    echo "[SKIP] ${svc}: Dockerfile 없음"
    continue
  fi

  echo "[BUILD] saas-${svc}:latest"
  docker build -t "saas-${svc}:latest" "${SVC_DIR}" -q 2>/dev/null

  echo "[SCAN]  saas-${svc}:latest"
  trivy image --severity HIGH,CRITICAL \
    --ignore-unfixed \
    --format json \
    --output "${REPORT_DIR}/trivy-image-${svc}-$(date +%Y%m%d).json" \
    "saas-${svc}:latest" || {
      echo "  FAIL: HIGH/CRITICAL 취약점 발견"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    }
  echo ""
done

# 포털 스캔
echo "[BUILD] saas-portal:latest"
docker build -t "saas-portal:latest" "platform/apps/portal/" -q 2>/dev/null
echo "[SCAN]  saas-portal:latest"
trivy image --severity HIGH,CRITICAL "saas-portal:latest" || FAIL_COUNT=$((FAIL_COUNT + 1))

echo ""
echo "=== 스캔 완료: FAIL ${FAIL_COUNT}건 ==="
exit $FAIL_COUNT
```

### 2.4 IaC 설정 스캔 (Docker, k8s)

```bash
# Docker Compose 설정 검사
trivy config --severity HIGH,CRITICAL docker-compose.yml

# k8s 매니페스트 검사
trivy config --severity HIGH,CRITICAL k8s/

# Helm Chart 검사
trivy config --severity HIGH,CRITICAL helm/
```

---

## 3. 결과 해석

### 심각도별 조치 기준

| 심각도 | CVSS 점수 | 조치 | 기한 | 릴리스 영향 |
|--------|----------|------|------|-----------|
| CRITICAL | 9.0~10.0 | 즉시 패치 | 24시간 | 차단 |
| HIGH | 7.0~8.9 | 릴리스 전 패치 | 1주일 | 차단 |
| MEDIUM | 4.0~6.9 | 다음 스프린트 | 1개월 | 미차단 |
| LOW | 0.1~3.9 | 백로그 등록 | 분기 | 미차단 |

### JSON 리포트 주요 필드

```json
{
  "Results": [
    {
      "Target": "package-lock.json",
      "Vulnerabilities": [
        {
          "VulnerabilityID": "CVE-2024-XXXXX",
          "PkgName": "패키지명",
          "InstalledVersion": "1.0.0",
          "FixedVersion": "1.0.1",
          "Severity": "HIGH",
          "Title": "취약점 설명"
        }
      ]
    }
  ]
}
```

---

## 4. SBOM 생성 (MTU-C8 연동)

```bash
# CycloneDX SBOM 생성
trivy image --format cyclonedx \
  --output reports/sbom/saas-auth-sbom.json \
  saas-auth:latest

# SPDX SBOM 생성
trivy image --format spdx-json \
  --output reports/sbom/saas-auth-spdx.json \
  saas-auth:latest
```

---

## 5. 취약점 예외 처리

### .trivyignore 파일

```
# .trivyignore
# 개발 전용 의존성 (프로덕션 미포함)
CVE-2024-XXXXX

# false positive (분석 완료)
CVE-2024-YYYYY
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
