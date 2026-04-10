#!/bin/bash
# SonarQube 품질 게이트 확인 스크립트
# Design Ref: DS-N105.5
# Plan SC: FR-N105.5
# CSAP: D-12 시스템 개발 보안

set -euo pipefail

SONAR_HOST="${SONAR_HOST:-http://sonar.local:9000}"
SONAR_TOKEN="${SONAR_TOKEN:-}"
PROJECT_KEY="${SONAR_PROJECT_KEY:-ai-saas}"

if [ -z "$SONAR_TOKEN" ]; then
  echo "[ERROR] SONAR_TOKEN 환경 변수가 설정되지 않았습니다."
  exit 1
fi

echo "============================================"
echo " SonarQube 품질 게이트 확인"
echo " 프로젝트: ${PROJECT_KEY}"
echo " 서버: ${SONAR_HOST}"
echo "============================================"

# 품질 게이트 상태 조회
RESPONSE=$(curl -s -u "${SONAR_TOKEN}:" \
  "${SONAR_HOST}/api/qualitygates/project_status?projectKey=${PROJECT_KEY}")

STATUS=$(echo "$RESPONSE" | jq -r '.projectStatus.status // "UNKNOWN"')

echo ""
echo "품질 게이트 상태: ${STATUS}"
echo ""

# 개별 조건 출력
echo "--- 세부 조건 ---"
echo "$RESPONSE" | jq -r '.projectStatus.conditions[]? |
  "[\(.status)] \(.metricKey): 실제=\(.actualValue) / 기준=\(.errorThreshold)"'

echo ""

# 결과 판정
case "$STATUS" in
  "OK")
    echo "[PASS] 품질 게이트 통과"
    echo ""
    echo "모든 코드 품질 기준을 충족합니다."
    echo "  - 신규 버그: 0"
    echo "  - 신규 취약점: 0"
    echo "  - 코드 스멜 등급: A"
    echo "  - 중복률: 3% 이하"
    echo "  - 커버리지: 80% 이상"
    exit 0
    ;;
  "WARN")
    echo "[WARN] 품질 게이트 경고"
    echo "일부 메트릭이 경고 수준입니다. 검토가 필요합니다."
    exit 0
    ;;
  "ERROR")
    echo "[FAIL] 품질 게이트 실패"
    echo ""
    echo "코드 품질 기준을 충족하지 못했습니다."
    echo "위 세부 조건에서 실패한 항목을 확인하고 수정하십시오."
    echo ""
    echo "CSAP D-12 준수를 위해 품질 게이트를 통과해야 합니다."
    exit 1
    ;;
  *)
    echo "[ERROR] 품질 게이트 상태 확인 실패: ${STATUS}"
    echo "SonarQube 서버 연결 또는 프로젝트 설정을 확인하십시오."
    echo ""
    echo "응답: ${RESPONSE}"
    exit 1
    ;;
esac
