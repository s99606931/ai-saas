#!/usr/bin/env bash
# OpenSSF Scorecard CI E2E 테스트
# Design Ref: DS-N115.6
# Plan SC: FR-N115.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
log_result() {
  TOTAL=$((TOTAL + 1))
  if [ "$3" = "PASS" ]; then PASS=$((PASS + 1)); echo "[PASS] $1: $2"
  else FAIL=$((FAIL + 1)); echo "[FAIL] $1: $2"; fi
}

echo "=========================================="
echo "OpenSSF Scorecard CI E2E 테스트"
echo "MTU-N115 | $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# T-N115.1: CI 워크플로우 YAML 유효성
echo ""
echo "--- T-N115.1: CI 워크플로우 유효성 ---"
WF="/data/ai-saas/.gitea/workflows/scorecard-ci.yaml"
if [ -f "$WF" ]; then
  if python3 -c "import yaml; yaml.safe_load(open('$WF'))" 2>/dev/null; then
    log_result "T-N115.1" "워크플로우 YAML 유효" "PASS"
  else
    log_result "T-N115.1" "워크플로우 YAML 파싱 실패" "FAIL"
  fi
  # pull_request 트리거 확인
  if grep -q "pull_request" "$WF"; then
    log_result "T-N115.1" "PR 트리거 설정" "PASS"
  else
    log_result "T-N115.1" "PR 트리거 미설정" "FAIL"
  fi
  # schedule 트리거 확인
  if grep -q "schedule" "$WF"; then
    log_result "T-N115.1" "스케줄 트리거 설정" "PASS"
  else
    log_result "T-N115.1" "스케줄 트리거 미설정" "FAIL"
  fi
fi

# T-N115.2: 게이트 스크립트 동작 검증
echo ""
echo "--- T-N115.2: PR 게이트 스크립트 검증 ---"
GATE="/data/ai-saas/scripts/scorecard-gate.sh"
if [ -f "$GATE" ]; then
  chmod +x "$GATE"
  # 설정 파일 기반 정적 검증 (SARIF 없이)
  if bash "$GATE" /nonexistent 2>/dev/null; then
    log_result "T-N115.2" "게이트 스크립트 정적 검증 통과" "PASS"
  else
    log_result "T-N115.2" "게이트 스크립트 실행 실패" "FAIL"
  fi
fi

# T-N115.3: 파싱 스크립트 동작 검증
echo ""
echo "--- T-N115.3: SARIF 파싱 스크립트 검증 ---"
PARSER="/data/ai-saas/scripts/scorecard-parse.py"
if [ -f "$PARSER" ]; then
  # 인자 없이 실행 (기본 출력)
  OUTPUT=$(python3 "$PARSER" 2>/dev/null)
  if echo "$OUTPUT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'totalScore' in d" 2>/dev/null; then
    log_result "T-N115.3" "파싱 스크립트 기본 출력 유효 JSON" "PASS"
  else
    log_result "T-N115.3" "파싱 스크립트 출력 유효하지 않음" "FAIL"
  fi
fi

# T-N115.4: 기존 Scorecard 설정 파일 호환성
echo ""
echo "--- T-N115.4: 기존 설정 파일 호환성 ---"
CONFIG="/data/ai-saas/infra/security/scorecard/config.yaml"
if [ -f "$CONFIG" ]; then
  if python3 -c "import yaml; yaml.safe_load(open('$CONFIG'))" 2>/dev/null; then
    log_result "T-N115.4" "기존 Scorecard 설정 유효" "PASS"
  else
    log_result "T-N115.4" "기존 Scorecard 설정 파싱 실패" "FAIL"
  fi
  # 최소 점수 설정 확인
  if grep -q "minimum:" "$CONFIG"; then
    log_result "T-N115.4" "최소 점수 기준 설정 존재" "PASS"
  else
    log_result "T-N115.4" "최소 점수 기준 미설정" "FAIL"
  fi
fi

# T-N115.5: 보안 개선 제안 매핑 완전성
echo ""
echo "--- T-N115.5: 보안 개선 제안 매핑 ---"
GUIDE_COUNT=$(grep -c "REMEDIATION_GUIDE" "$PARSER" | head -1 || echo "0")
# 실제 매핑 항목 수 확인
MAPPING_COUNT=$(python3 -c "
import ast
with open('$PARSER') as f:
    tree = ast.parse(f.read())
for node in ast.walk(tree):
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if hasattr(target, 'id') and target.id == 'REMEDIATION_GUIDE':
                if isinstance(node.value, ast.Dict):
                    print(len(node.value.keys))
" 2>/dev/null)
if [ -n "$MAPPING_COUNT" ] && [ "$MAPPING_COUNT" -ge 10 ]; then
  log_result "T-N115.5" "보안 개선 제안 ${MAPPING_COUNT}개 매핑" "PASS"
else
  log_result "T-N115.5" "보안 개선 제안 매핑 부족 (${MAPPING_COUNT:-0}/10)" "FAIL"
fi

# T-N115.6: CSAP 감사 로그 기록 확인
echo ""
echo "--- T-N115.6: 감사 로그 기록 확인 ---"
if grep -q "audit.jsonl" "$WF"; then
  log_result "T-N115.6" "워크플로우에 감사 로그 기록 포함" "PASS"
else
  log_result "T-N115.6" "감사 로그 기록 미포함" "FAIL"
fi

# 결과 요약
echo ""
echo "=========================================="
echo "테스트 결과 요약"
echo "총 테스트: $TOTAL | 통과: $PASS | 실패: $FAIL"
echo "통과율: $(( PASS * 100 / TOTAL ))%"
echo "=========================================="
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
