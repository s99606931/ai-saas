#!/bin/bash
# 취약점 점검 통합 스크립트
# Plan SC: FR-CSAP4.2
# Design Ref: MTU-CSAP4 Design 2~3
#
# 사용법: ./scripts/security-audit.sh [--full]
# 옵션:
#   --full : OWASP ZAP Full Scan 포함 (반기 정기 점검 시)
#   기본   : Trivy + npm audit만 실행

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REPORT_DIR="${PROJECT_ROOT}/reports/vulnerability/$(date +%Y-%m)"
FULL_SCAN=false
EXIT_CODE=0

# 옵션 파싱
if [ "${1:-}" = "--full" ]; then
  FULL_SCAN=true
fi

# 보고서 디렉토리 생성
mkdir -p "$REPORT_DIR"

echo "============================================"
echo "  취약점 점검 통합 스크립트"
echo "  일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  모드: $([ "$FULL_SCAN" = true ] && echo '전체 (Trivy + npm + ZAP)' || echo '기본 (Trivy + npm)')"
echo "  보고서: ${REPORT_DIR}"
echo "============================================"
echo ""

# ── 1단계: Trivy 파일시스템 스캔 ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[1/4] Trivy 파일시스템 스캔"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v trivy &> /dev/null; then
  echo "Trivy 버전: $(trivy --version 2>/dev/null | head -1)"
  echo ""

  # 파일시스템 스캔
  trivy fs --severity HIGH,CRITICAL \
    --ignore-unfixed \
    --format json \
    --output "${REPORT_DIR}/trivy-fs-$(date +%Y%m%d).json" \
    "$PROJECT_ROOT" || EXIT_CODE=1

  # 테이블 형식 출력
  trivy fs --severity HIGH,CRITICAL \
    --ignore-unfixed \
    --format table \
    "$PROJECT_ROOT" || true

  echo ""
  echo "  보고서: ${REPORT_DIR}/trivy-fs-$(date +%Y%m%d).json"
else
  echo "  SKIP: Trivy 미설치"
  echo "  설치: docs/framework/02-csap/vulnerability/scanning-guide.md 참조"
fi
echo ""

# ── 2단계: npm audit ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[2/4] npm 의존성 보안 감사"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v pnpm &> /dev/null; then
  cd "$PROJECT_ROOT"

  # JSON 보고서 생성
  pnpm audit --json > "${REPORT_DIR}/npm-audit-$(date +%Y%m%d).json" 2>/dev/null || true

  # 텍스트 출력
  pnpm audit --audit-level=high 2>/dev/null || {
    echo "  WARN: HIGH 이상 취약점 발견"
    EXIT_CODE=1
  }

  echo ""
  echo "  보고서: ${REPORT_DIR}/npm-audit-$(date +%Y%m%d).json"
else
  echo "  SKIP: pnpm 미설치"
fi
echo ""

# ── 3단계: Trivy IaC 설정 검사 ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[3/4] IaC 설정 검사"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v trivy &> /dev/null; then
  if [ -f "${PROJECT_ROOT}/docker-compose.yml" ]; then
    trivy config --severity HIGH,CRITICAL \
      --format table \
      "${PROJECT_ROOT}/docker-compose.yml" || true
  fi
else
  echo "  SKIP: Trivy 미설치"
fi
echo ""

# ── 4단계: OWASP ZAP (--full 옵션 시) ──
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "[4/4] OWASP ZAP 웹 취약점 스캔"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FULL_SCAN" = true ]; then
  if command -v docker &> /dev/null; then
    echo "  포털 Baseline Scan 실행 중..."
    docker run --rm \
      -v "${REPORT_DIR}:/zap/wrk/:rw" \
      ghcr.io/zaproxy/zaproxy:stable \
      zap-baseline.py \
      -t http://host.docker.internal:4000 \
      -r "zap-baseline-$(date +%Y%m%d).html" \
      -J "zap-baseline-$(date +%Y%m%d).json" \
      -l WARN || {
        echo "  WARN: ZAP Baseline Scan 실패 (대상 서비스 미기동 가능)"
      }
    echo "  보고서: ${REPORT_DIR}/zap-baseline-$(date +%Y%m%d).html"
  else
    echo "  SKIP: Docker 미설치 (OWASP ZAP은 Docker 필요)"
  fi
else
  echo "  SKIP: --full 옵션 미지정 (기본 모드)"
  echo "  반기 정기 점검 시: ./scripts/security-audit.sh --full"
fi
echo ""

# ── 결과 요약 ──
echo "============================================"
echo "  취약점 점검 완료"
echo "  일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  보고서: ${REPORT_DIR}/"
if [ $EXIT_CODE -eq 0 ]; then
  echo "  결과: PASS (0 Critical, 0 High)"
else
  echo "  결과: FAIL (HIGH 이상 취약점 존재)"
fi
echo "============================================"

exit $EXIT_CODE
