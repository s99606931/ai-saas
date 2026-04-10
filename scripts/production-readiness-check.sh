#!/usr/bin/env bash
# 프로덕션 준비 체크리스트 자동 검증
# Design Ref: MTU-N118
# Plan SC: FR-N118.3
# CSAP: D-12 시스템 개발 보안
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0; WARN=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "PASS" ]; then PASS=$((PASS + 1)); echo "[PASS] $1"
  elif [ "$2" = "WARN" ]; then WARN=$((WARN + 1)); echo "[WARN] $1"
  else FAIL=$((FAIL + 1)); echo "[FAIL] $1"; fi
}

echo "=========================================="
echo "프로덕션 준비 체크리스트"
echo "$(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 1. 코드 품질
echo ""
echo "--- 1. 코드 품질 ---"
if [ -f "/data/ai-saas/package.json" ] || [ -f "/data/ai-saas/tsconfig.json" ]; then
  check "TypeScript/JavaScript 프로젝트 구성 존재" "PASS"
else
  check "프로젝트 구성 파일 확인" "WARN"
fi

# 2. 보안
echo ""
echo "--- 2. 보안 ---"
# 하드코딩 시크릿 검사
SECRETS_FOUND="$(grep -rn 'sk-\|password\s*=\s*['"'"'"]' /data/ai-saas/src/ 2>/dev/null | grep -v 'test\|mock\|example\|\.md' | wc -l || true)"
SECRETS_FOUND="${SECRETS_FOUND:-0}"
SECRETS_FOUND="$(echo "$SECRETS_FOUND" | tr -d '[:space:]')"
if [ "$SECRETS_FOUND" = "0" ] || [ -z "$SECRETS_FOUND" ]; then
  check "하드코딩 시크릿 없음" "PASS"
else
  check "하드코딩 시크릿 ${SECRETS_FOUND}건 발견" "FAIL"
fi

# .env 파일 gitignore 확인
if [ -f "/data/ai-saas/.gitignore" ]; then
  if grep -q "\.env" /data/ai-saas/.gitignore; then
    check ".env 파일 gitignore 등록" "PASS"
  else
    check ".env 파일 gitignore 미등록" "FAIL"
  fi
fi

# Cosign 설정 확인
if [ -d "/data/ai-saas/infra/cosign" ]; then
  check "Cosign 이미지 서명 설정 존재" "PASS"
else
  check "Cosign 설정 미존재" "WARN"
fi

# 3. 인프라
echo ""
echo "--- 3. 인프라 ---"
# Helm chart 존재
if [ -d "/data/ai-saas/infra/helm" ]; then
  check "Helm 차트 존재" "PASS"
else
  check "Helm 차트 미존재" "WARN"
fi

# 모니터링 설정
if [ -d "/data/ai-saas/infra/monitoring" ]; then
  check "모니터링 인프라 구성 존재" "PASS"
else
  check "모니터링 미구성" "FAIL"
fi

# 4. 문서
echo ""
echo "--- 4. 문서 ---"
for doc in "CHANGELOG.md" "SECURITY.md"; do
  if [ -f "/data/ai-saas/$doc" ]; then
    check "$doc 존재" "PASS"
  else
    check "$doc 미존재" "WARN"
  fi
done

# 5. SLO 정의
echo ""
echo "--- 5. SLO ---"
if [ -d "/data/ai-saas/infra/slo" ]; then
  check "SLO 정의 존재" "PASS"
else
  check "SLO 미정의" "WARN"
fi

# 6. 백업/DR
echo ""
echo "--- 6. DR ---"
if [ -d "/data/ai-saas/infra/dr" ]; then
  check "DR 설정 존재" "PASS"
else
  check "DR 미설정" "WARN"
fi

# 결과 요약
echo ""
echo "=========================================="
echo "프로덕션 준비 체크리스트 결과"
echo "통과: $PASS | 경고: $WARN | 실패: $FAIL | 총: $TOTAL"
SCORE=$(( PASS * 100 / TOTAL ))
echo "준비율: ${SCORE}%"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  echo "[BLOCKED] 프로덕션 배포 차단: $FAIL건 필수 항목 미충족"
  exit 1
fi
echo "[PASS] 프로덕션 배포 가능"
