#!/usr/bin/env bash
# 개발자 생산성 도구 E2E 테스트
# Plan SC: FR-N119.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
log_result() {
  TOTAL=$((TOTAL + 1))
  if [ "$3" = "PASS" ]; then PASS=$((PASS + 1)); echo "[PASS] $1: $2"
  else FAIL=$((FAIL + 1)); echo "[FAIL] $1: $2"; fi
}

echo "=========================================="
echo "개발자 생산성 도구 E2E 테스트"
echo "MTU-N119 | $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# T-N119.1: 스캐폴딩 CLI 실행 테스트
echo ""
echo "--- T-N119.1: 스캐폴딩 CLI ---"
SCAFFOLD="/data/ai-saas/tools/scaffolding/create-service.sh"
chmod +x "$SCAFFOLD"
TEST_SVC="test-svc-$$"
if bash "$SCAFFOLD" "$TEST_SVC" api saas-system 2>/dev/null; then
  SVC_DIR="/data/ai-saas/services/$TEST_SVC"
  # 필수 파일 존재 확인
  for f in "package.json" "tsconfig.json" "src/index.ts" "Dockerfile" "k8s/deployment.yaml" "k8s/service.yaml"; do
    if [ -f "$SVC_DIR/$f" ]; then
      log_result "T-N119.1" "$f 생성" "PASS"
    else
      log_result "T-N119.1" "$f 미생성" "FAIL"
    fi
  done
  # 정리
  rm -rf "$SVC_DIR"
else
  log_result "T-N119.1" "스캐폴딩 실행 실패" "FAIL"
fi

# T-N119.2: DevContainer 설정 유효성
echo ""
echo "--- T-N119.2: DevContainer ---"
DC="/data/ai-saas/.devcontainer/devcontainer-lite.json"
if [ -f "$DC" ]; then
  if python3 -c "import json; json.load(open('$DC'))" 2>/dev/null; then
    log_result "T-N119.2" "DevContainer JSON 유효" "PASS"
  else
    log_result "T-N119.2" "DevContainer JSON 파싱 실패" "FAIL"
  fi
  # VS Code 확장 포함 확인
  EXT_COUNT=$(python3 -c "import json; d=json.load(open('$DC')); print(len(d.get('customizations',{}).get('vscode',{}).get('extensions',[])))")
  if [ "$EXT_COUNT" -ge 4 ]; then
    log_result "T-N119.2" "VS Code 확장 ${EXT_COUNT}개 설정" "PASS"
  else
    log_result "T-N119.2" "확장 부족 ($EXT_COUNT/4)" "FAIL"
  fi
fi

# T-N119.3: 로컬 k3s 프로파일 유효성
echo ""
echo "--- T-N119.3: 로컬 k3s 프로파일 ---"
K3S_PROFILE="/data/ai-saas/tools/scaffolding/local-k3s-profile.yaml"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$K3S_PROFILE')))" 2>/dev/null; then
  log_result "T-N119.3" "k3s 로컬 프로파일 YAML 유효" "PASS"
else
  log_result "T-N119.3" "k3s 프로파일 파싱 실패" "FAIL"
fi

# T-N119.4: IDE 권장 목록 존재
echo ""
echo "--- T-N119.4: IDE 권장 목록 ---"
if [ -f "/data/ai-saas/tools/scaffolding/ide-recommendations.md" ]; then
  log_result "T-N119.4" "IDE 권장 목록 존재" "PASS"
else
  log_result "T-N119.4" "IDE 권장 목록 미존재" "FAIL"
fi

# T-N119.5: CSAP 보안 기본값 내장 확인
echo ""
echo "--- T-N119.5: CSAP 보안 기본값 ---"
# 스캐폴딩 다시 생성하여 보안 기본값 확인
TEST_SVC2="test-csap-$$"
bash "$SCAFFOLD" "$TEST_SVC2" api saas-system 2>/dev/null
SVC_DIR2="/data/ai-saas/services/$TEST_SVC2"
if [ -f "$SVC_DIR2/src/index.ts" ]; then
  # Zod 입력 검증 확인
  if grep -q "zod\|z\.object\|z\.string" "$SVC_DIR2/src/index.ts"; then
    log_result "T-N119.5" "Zod 입력 검증 내장" "PASS"
  else
    log_result "T-N119.5" "입력 검증 미내장" "FAIL"
  fi
  # 보안 헤더 확인
  if grep -q "X-Content-Type-Options\|X-Frame-Options" "$SVC_DIR2/src/index.ts"; then
    log_result "T-N119.5" "보안 헤더 내장" "PASS"
  else
    log_result "T-N119.5" "보안 헤더 미내장" "FAIL"
  fi
  # Dockerfile 비루트 실행 확인
  if grep -q "USER appuser\|runAsNonRoot" "$SVC_DIR2/Dockerfile"; then
    log_result "T-N119.5" "비루트 실행 내장" "PASS"
  else
    log_result "T-N119.5" "비루트 실행 미내장" "FAIL"
  fi
fi
rm -rf "$SVC_DIR2"

# 결과 요약
echo ""
echo "=========================================="
echo "총 테스트: $TOTAL | 통과: $PASS | 실패: $FAIL"
echo "통과율: $(( PASS * 100 / TOTAL ))%"
echo "=========================================="
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
