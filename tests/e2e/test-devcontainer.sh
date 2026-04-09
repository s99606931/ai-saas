#!/bin/bash
# =============================================================================
# DevContainer 개발 환경 통합 테스트
# Design Ref: MTU-N58
# Plan SC: FR-N58.8
# =============================================================================

set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'

log_test() {
  local tc_id="$1"; local desc="$2"; local result="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "PASS" ]; then
    PASS=$((PASS + 1)); echo -e "  ${GREEN}[PASS]${NC} $tc_id: $desc"
  else
    FAIL=$((FAIL + 1)); echo -e "  ${RED}[FAIL]${NC} $tc_id: $desc"
  fi
}

echo "=============================================="
echo " DevContainer 개발 환경 통합 테스트"
echo " MTU-N58"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="
echo ""

DC_DIR="/data/ai-saas/.devcontainer"

# --- TC-01: devcontainer.json ---
echo "[Phase 1] 설정 파일 검증"
if [ -f "${DC_DIR}/devcontainer.json" ]; then
  HAS_NAME=$(python3 -c "import json; d=json.load(open('${DC_DIR}/devcontainer.json')); print(1 if d.get('name') else 0)" 2>/dev/null || echo "0")
  HAS_BUILD=$(python3 -c "import json; d=json.load(open('${DC_DIR}/devcontainer.json')); print(1 if d.get('build') else 0)" 2>/dev/null || echo "0")
  HAS_EXT=$(python3 -c "import json; d=json.load(open('${DC_DIR}/devcontainer.json')); exts=d.get('customizations',{}).get('vscode',{}).get('extensions',[]); print(len(exts))" 2>/dev/null || echo "0")
  HAS_PORTS=$(python3 -c "import json; d=json.load(open('${DC_DIR}/devcontainer.json')); print(len(d.get('forwardPorts',[])))" 2>/dev/null || echo "0")
  if [ "$HAS_NAME" = "1" ] && [ "$HAS_BUILD" = "1" ]; then
    log_test "TC-01" "devcontainer.json 유효 (name, build 포함)" "PASS"
  else
    log_test "TC-01" "devcontainer.json 필수 항목 누락" "FAIL"
  fi
  if [ "$HAS_EXT" -ge 10 ]; then
    log_test "TC-02" "VS Code 확장 ${HAS_EXT}개 사전 설치" "PASS"
  else
    log_test "TC-02" "VS Code 확장 부족 (${HAS_EXT}개)" "FAIL"
  fi
  if [ "$HAS_PORTS" -ge 5 ]; then
    log_test "TC-03" "포트 포워딩 ${HAS_PORTS}개 설정" "PASS"
  else
    log_test "TC-03" "포트 포워딩 부족" "FAIL"
  fi
else
  log_test "TC-01" "devcontainer.json 미존재" "FAIL"
  log_test "TC-02" "VS Code 확장 검증 불가" "FAIL"
  log_test "TC-03" "포트 포워딩 검증 불가" "FAIL"
fi

# --- TC-04: Dockerfile ---
echo ""
echo "[Phase 2] Dockerfile 검증"
if [ -f "${DC_DIR}/Dockerfile" ]; then
  HAS_NODE=$(grep -c "node\|Node" "${DC_DIR}/Dockerfile" || true)
  HAS_KUBECTL=$(grep -c "kubectl" "${DC_DIR}/Dockerfile" || true)
  HAS_HELM=$(grep -c "helm" "${DC_DIR}/Dockerfile" || true)
  HAS_COSIGN=$(grep -c "cosign" "${DC_DIR}/Dockerfile" || true)
  HAS_PNPM=$(grep -c "pnpm" "${DC_DIR}/Dockerfile" || true)
  TOOLS_COUNT=0
  [ "$HAS_KUBECTL" -ge 1 ] && TOOLS_COUNT=$((TOOLS_COUNT+1))
  [ "$HAS_HELM" -ge 1 ] && TOOLS_COUNT=$((TOOLS_COUNT+1))
  [ "$HAS_COSIGN" -ge 1 ] && TOOLS_COUNT=$((TOOLS_COUNT+1))
  [ "$HAS_PNPM" -ge 1 ] && TOOLS_COUNT=$((TOOLS_COUNT+1))
  if [ "$HAS_NODE" -ge 1 ]; then
    log_test "TC-04" "Dockerfile Node.js 기반 이미지" "PASS"
  else
    log_test "TC-04" "Node.js 이미지 미설정" "FAIL"
  fi
  if [ "$TOOLS_COUNT" -ge 3 ]; then
    log_test "TC-05" "k8s 도구 ${TOOLS_COUNT}종 포함 (kubectl, helm, cosign, pnpm)" "PASS"
  else
    log_test "TC-05" "k8s 도구 부족 (${TOOLS_COUNT}종)" "FAIL"
  fi
else
  log_test "TC-04" "Dockerfile 미존재" "FAIL"
  log_test "TC-05" "도구 검증 불가" "FAIL"
fi

# --- TC-06: post-create.sh ---
echo ""
echo "[Phase 3] 초기화 스크립트 검증"
if [ -f "${DC_DIR}/post-create.sh" ]; then
  HAS_PNPM_INSTALL=$(grep -c "pnpm install" "${DC_DIR}/post-create.sh" || true)
  HAS_HELM_REPO=$(grep -c "helm repo" "${DC_DIR}/post-create.sh" || true)
  HAS_GIT_CONFIG=$(grep -c "git config" "${DC_DIR}/post-create.sh" || true)
  HAS_SECRET_CHECK=$(grep -c "시크릿\|secret\|gitignore" "${DC_DIR}/post-create.sh" || true)
  if [ "$HAS_PNPM_INSTALL" -ge 1 ] && [ "$HAS_HELM_REPO" -ge 1 ] && [ "$HAS_GIT_CONFIG" -ge 1 ]; then
    log_test "TC-06" "초기화 스크립트 (pnpm + helm + git)" "PASS"
  else
    log_test "TC-06" "초기화 스크립트 불완전" "FAIL"
  fi
  if [ "$HAS_SECRET_CHECK" -ge 1 ]; then
    log_test "TC-07" "시크릿 보호 확인 로직 포함" "PASS"
  else
    log_test "TC-07" "시크릿 보호 확인 누락" "FAIL"
  fi
else
  log_test "TC-06" "post-create.sh 미존재" "FAIL"
  log_test "TC-07" "시크릿 보호 검증 불가" "FAIL"
fi

# --- TC-08: 온보딩 가이드 ---
echo ""
echo "[Phase 4] 문서 검증"
if [ -f "${DC_DIR}/onboarding-guide.md" ]; then
  HAS_PREREQ=$(grep -c "사전 요구\|Prerequisites\|사전" "${DC_DIR}/onboarding-guide.md" || true)
  HAS_K3S=$(grep -c "k3s\|kubectl" "${DC_DIR}/onboarding-guide.md" || true)
  HAS_CSAP=$(grep -c "CSAP\|N2SF\|시크릿\|보안" "${DC_DIR}/onboarding-guide.md" || true)
  if [ "$HAS_PREREQ" -ge 1 ] && [ "$HAS_K3S" -ge 1 ] && [ "$HAS_CSAP" -ge 1 ]; then
    log_test "TC-08" "온보딩 가이드 (사전요구, k3s, CSAP 주의사항)" "PASS"
  else
    log_test "TC-08" "온보딩 가이드 내용 불충분" "FAIL"
  fi
else
  log_test "TC-08" "onboarding-guide.md 미존재" "FAIL"
fi

# --- TC-09: JSON 유효성 ---
if python3 -c "import json; json.load(open('${DC_DIR}/devcontainer.json'))" 2>/dev/null; then
  log_test "TC-09" "devcontainer.json JSON 유효성" "PASS"
else
  log_test "TC-09" "devcontainer.json JSON 파싱 실패" "FAIL"
fi

# --- TC-10: 보안 설정 ---
if grep -q "remoteUser" "${DC_DIR}/devcontainer.json" 2>/dev/null; then
  REMOTE_USER=$(python3 -c "import json; print(json.load(open('${DC_DIR}/devcontainer.json')).get('remoteUser',''))" 2>/dev/null)
  if [ "$REMOTE_USER" != "root" ] && [ -n "$REMOTE_USER" ]; then
    log_test "TC-10" "비루트 사용자 설정 (${REMOTE_USER})" "PASS"
  else
    log_test "TC-10" "루트 사용자 사용 (보안 위험)" "FAIL"
  fi
else
  log_test "TC-10" "remoteUser 미설정" "FAIL"
fi

# --- 최종 리포트 ---
echo ""
echo "=============================================="
echo " 테스트 결과 요약"
echo "=============================================="
echo -e " 총 테스트: ${TOTAL}"
echo -e " ${GREEN}PASS${NC}: ${PASS}"
echo -e " ${RED}FAIL${NC}: ${FAIL}"
RATE=$(awk "BEGIN {printf \"%.1f\", ($PASS/$TOTAL)*100}")
echo " 통과율: ${RATE}%"

if [ "$FAIL" -eq 0 ]; then
  echo -e "\n${GREEN}[ALL PASS] DevContainer 통합 테스트 완료${NC}"
  exit 0
else
  echo -e "\n${RED}[PARTIAL] ${FAIL}건 실패${NC}"
  exit 1
fi
