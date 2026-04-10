#!/usr/bin/env bash
# 자동 포스트모템 E2E 테스트
# Plan SC: FR-N117.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
log_result() {
  TOTAL=$((TOTAL + 1))
  if [ "$3" = "PASS" ]; then PASS=$((PASS + 1)); echo "[PASS] $1: $2"
  else FAIL=$((FAIL + 1)); echo "[FAIL] $1: $2"; fi
}

echo "=========================================="
echo "자동 포스트모템 E2E 테스트"
echo "MTU-N117 | $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# T-N117.1: 포스트모템 템플릿 존재 및 필수 섹션
echo ""
echo "--- T-N117.1: 포스트모템 템플릿 ---"
TPL="/data/ai-saas/infra/incident-management/templates/postmortem-template.md"
if [ -f "$TPL" ]; then
  log_result "T-N117.1" "포스트모템 템플릿 존재" "PASS"
  # 필수 섹션 확인
  for section in "인시던트 개요" "타임라인" "근본 원인 분석" "영향도 분석" "개선 조치" "CSAP 준수"; do
    if grep -q "$section" "$TPL"; then
      log_result "T-N117.1" "섹션 '$section' 존재" "PASS"
    else
      log_result "T-N117.1" "섹션 '$section' 미존재" "FAIL"
    fi
  done
fi

# T-N117.2: 생성 스크립트 실행 테스트
echo ""
echo "--- T-N117.2: 생성 스크립트 실행 ---"
SCRIPT="/data/ai-saas/scripts/generate-postmortem.sh"
TEST_DIR="/tmp/postmortem-test-$$"
chmod +x "$SCRIPT"
if bash "$SCRIPT" "TEST-001" "SEV2" "테스트 인시던트" "$TEST_DIR" 2>/dev/null; then
  if [ -f "$TEST_DIR/postmortem-TEST-001.md" ]; then
    log_result "T-N117.2" "포스트모템 파일 생성 성공" "PASS"
    # 변수 치환 확인
    if ! grep -q '\${' "$TEST_DIR/postmortem-TEST-001.md" 2>/dev/null; then
      log_result "T-N117.2" "템플릿 변수 치환 완료" "PASS"
    else
      log_result "T-N117.2" "미치환 변수 존재" "FAIL"
    fi
  else
    log_result "T-N117.2" "포스트모템 파일 미생성" "FAIL"
  fi
else
  log_result "T-N117.2" "생성 스크립트 실행 실패" "FAIL"
fi
rm -rf "$TEST_DIR"

# T-N117.3: 인시던트 분류 체계 YAML 유효성
echo ""
echo "--- T-N117.3: 분류 체계 유효성 ---"
CLASS="/data/ai-saas/infra/incident-management/incident-classification.yaml"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$CLASS')))" 2>/dev/null; then
  log_result "T-N117.3" "분류 체계 YAML 유효" "PASS"
else
  log_result "T-N117.3" "분류 체계 YAML 파싱 실패" "FAIL"
fi

# 4단계 심각도 정의 확인
for sev in SEV1 SEV2 SEV3 SEV4; do
  if grep -q "$sev" "$CLASS"; then
    log_result "T-N117.3" "$sev 심각도 정의" "PASS"
  else
    log_result "T-N117.3" "$sev 심각도 미정의" "FAIL"
  fi
done

# T-N117.4: CSAP D-06 매핑
echo ""
echo "--- T-N117.4: CSAP D-06 매핑 ---"
if grep -q "D-06" "$TPL" && grep -q "D-06" "$CLASS"; then
  log_result "T-N117.4" "CSAP D-06 매핑 존재" "PASS"
else
  log_result "T-N117.4" "CSAP D-06 매핑 부족" "FAIL"
fi

# 결과 요약
echo ""
echo "=========================================="
echo "총 테스트: $TOTAL | 통과: $PASS | 실패: $FAIL"
echo "통과율: $(( PASS * 100 / TOTAL ))%"
echo "=========================================="
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
