#!/usr/bin/env bash
# ChatOps 통합 E2E 테스트
# Plan SC: FR-N116.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
log_result() {
  TOTAL=$((TOTAL + 1))
  if [ "$3" = "PASS" ]; then PASS=$((PASS + 1)); echo "[PASS] $1: $2"
  else FAIL=$((FAIL + 1)); echo "[FAIL] $1: $2"; fi
}

echo "=========================================="
echo "ChatOps 통합 E2E 테스트"
echo "MTU-N116 | $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

DIR="/data/ai-saas/infra/chatops"

# T-N116.1: Botkube values YAML 유효성
echo ""
echo "--- T-N116.1: Botkube Values 유효성 ---"
if python3 -c "import yaml; yaml.safe_load(open('$DIR/botkube-values.yaml'))" 2>/dev/null; then
  log_result "T-N116.1" "Botkube values YAML 유효" "PASS"
else
  log_result "T-N116.1" "Botkube values YAML 파싱 실패" "FAIL"
fi

# T-N116.2: 채널 라우팅 확인 (3개 채널)
CHANNELS=$(grep -c "name:.*saas-" "$DIR/botkube-values.yaml" || echo "0")
if [ "$CHANNELS" -ge 3 ]; then
  log_result "T-N116.2" "채널 ${CHANNELS}개 라우팅 설정" "PASS"
else
  log_result "T-N116.2" "채널 라우팅 부족 ($CHANNELS/3)" "FAIL"
fi

# T-N116.3: RBAC 매니페스트 유효성
echo ""
echo "--- T-N116.3: RBAC 유효성 ---"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$DIR/chatops-rbac.yaml')))" 2>/dev/null; then
  log_result "T-N116.3" "RBAC YAML 유효" "PASS"
else
  log_result "T-N116.3" "RBAC YAML 파싱 실패" "FAIL"
fi

# delete, exec 동사 없음 확인 (읽기전용)
if ! grep -q '"delete"' "$DIR/chatops-rbac.yaml" && ! grep -q '"exec"' "$DIR/chatops-rbac.yaml"; then
  log_result "T-N116.3" "RBAC에 delete/exec 동사 없음 (보안)" "PASS"
else
  log_result "T-N116.3" "RBAC에 위험 동사 포함!" "FAIL"
fi

# T-N116.4: Alertmanager 라우팅 유효성
echo ""
echo "--- T-N116.4: Alertmanager 라우팅 ---"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$DIR/alertmanager-chatops-route.yaml')))" 2>/dev/null; then
  log_result "T-N116.4" "Alertmanager 라우팅 YAML 유효" "PASS"
else
  log_result "T-N116.4" "Alertmanager 라우팅 파싱 실패" "FAIL"
fi

# 심각도별 라우팅 확인
if grep -q "severity: critical" "$DIR/alertmanager-chatops-route.yaml" && grep -q "severity: warning" "$DIR/alertmanager-chatops-route.yaml"; then
  log_result "T-N116.4" "심각도별 라우팅 설정" "PASS"
else
  log_result "T-N116.4" "심각도별 라우팅 미설정" "FAIL"
fi

# T-N116.5: 시크릿 하드코딩 없음
echo ""
echo "--- T-N116.5: 보안 검증 ---"
HARDCODED=false
for f in "$DIR"/*.yaml; do
  if grep -qiE "(xoxb-|xapp-|https://hooks\.slack\.com)" "$f" 2>/dev/null; then
    HARDCODED=true
    log_result "T-N116.5" "$(basename "$f")에 하드코딩 토큰 발견!" "FAIL"
  fi
done
if ! $HARDCODED; then
  log_result "T-N116.5" "하드코딩 토큰/URL 없음 (ESO 참조)" "PASS"
fi

# T-N116.6: 보안 컨텍스트 확인
if grep -q "runAsNonRoot: true" "$DIR/botkube-values.yaml"; then
  log_result "T-N116.6" "보안 컨텍스트 설정 (nonRoot)" "PASS"
else
  log_result "T-N116.6" "보안 컨텍스트 미설정" "FAIL"
fi

# 결과 요약
echo ""
echo "=========================================="
echo "총 테스트: $TOTAL | 통과: $PASS | 실패: $FAIL"
echo "통과율: $(( PASS * 100 / TOTAL ))%"
echo "=========================================="
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
