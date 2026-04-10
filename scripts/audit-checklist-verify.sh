#!/usr/bin/env bash
# Design Ref: MTU-N85 §아키텍처
# Plan SC: FR-N85.3
# 행안부 감리 체크리스트 자동 점검
set -euo pipefail

echo "============================================"
echo " 행안부 감리 체크리스트 자동 점검"
echo " 정보시스템 감리기준 (고시 제2023-1호)"
echo "============================================"
echo ""

PASS=0
FAIL=0
WARN=0
TOTAL=0

check() {
  local id="$1"
  local desc="$2"
  local cmd="$3"

  TOTAL=$((TOTAL + 1))
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  [PASS] ${id}: ${desc}"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] ${id}: ${desc}"
    FAIL=$((FAIL + 1))
  fi
}

warn_check() {
  local id="$1"
  local desc="$2"
  local cmd="$3"

  TOTAL=$((TOTAL + 1))
  if eval "$cmd" >/dev/null 2>&1; then
    echo "  [PASS] ${id}: ${desc}"
    PASS=$((PASS + 1))
  else
    echo "  [WARN] ${id}: ${desc}"
    WARN=$((WARN + 1))
  fi
}

# === 1. 사업 관리 영역 ===
echo "--- 1. 사업 관리 ---"
check "G1.1" "요구사항 정의서 존재" \
  "find /data/ai-saas/docs -name '*.plan.md' | head -1 | grep -q '.'"
check "G1.2" "설계 문서 존재" \
  "find /data/ai-saas/docs -name '*.design.md' | head -1 | grep -q '.'"
check "G1.3" "PDCA 상태 관리" \
  "test -f /data/ai-saas/.bkit/state/pdca-status.json"

# === 2. 개발 관리 영역 ===
echo "--- 2. 개발 관리 ---"
check "G2.1" "소스 코드 버전 관리" \
  "test -d /data/ai-saas/.git"
check "G2.2" "CI/CD 파이프라인 설정" \
  "find /data/ai-saas/infra/cicd -name '*.yaml' | head -1 | grep -q '.'"
check "G2.3" "코드 리뷰 정책" \
  "test -f /data/ai-saas/CLAUDE.md"
check "G2.4" "테스트 스크립트 존재" \
  "find /data/ai-saas/tests -name '*.sh' | head -1 | grep -q '.'"

# === 3. 보안 관리 영역 ===
echo "--- 3. 보안 관리 ---"
check "G3.1" "접근 통제 정책 (RBAC)" \
  "find /data/ai-saas/infra -name '*.yaml' | xargs grep -l 'ClusterRole\\|RoleBinding' 2>/dev/null | head -1 | grep -q '.'"
check "G3.2" "암호화 설정 (TLS)" \
  "test -d /data/ai-saas/infra/cert-manager"
check "G3.3" "감사 로그 존재" \
  "test -f /data/ai-saas/.claude/audit.jsonl"
check "G3.4" "네트워크 격리 (NetworkPolicy)" \
  "find /data/ai-saas/infra -name 'network-policy*.yaml' | head -1 | grep -q '.'"
check "G3.5" "보안 스캔 도구 설정" \
  "test -d /data/ai-saas/infra/trivy-operator"
check "G3.6" "런타임 보안 (Falco)" \
  "test -d /data/ai-saas/infra/falco"
check "G3.7" "이미지 서명 (Cosign)" \
  "test -d /data/ai-saas/infra/cosign"
check "G3.8" "정책 엔진 (Kyverno)" \
  "test -d /data/ai-saas/infra/kyverno"

# === 4. 운영 관리 영역 ===
echo "--- 4. 운영 관리 ---"
check "G4.1" "모니터링 설정" \
  "test -d /data/ai-saas/infra/monitoring"
check "G4.2" "백업 설정" \
  "test -d /data/ai-saas/infra/velero"
check "G4.3" "SLO/SLI 정의" \
  "test -d /data/ai-saas/infra/slo"
check "G4.4" "알림 규칙 설정" \
  "find /data/ai-saas/infra -name 'alerting-rules.yaml' | head -1 | grep -q '.'"
warn_check "G4.5" "SRE Runbook 존재" \
  "find /data/ai-saas/scripts/runbook-automation -name '*.sh' | head -1 | grep -q '.'"

# === 5. 품질 관리 영역 ===
echo "--- 5. 품질 관리 ---"
check "G5.1" "E2E 테스트 존재" \
  "find /data/ai-saas/tests/e2e -name '*.sh' | head -1 | grep -q '.'"
check "G5.2" "CSAP 증거 수집 자동화" \
  "test -d /data/ai-saas/infra/compliance/evidence-collector"
check "G5.3" "규정 준수 보고서 자동화" \
  "test -d /data/ai-saas/infra/compliance/report-generator"

echo ""
echo "============================================"
echo " 감리 체크리스트 결과"
echo "============================================"
echo " 통과: ${PASS}/${TOTAL}"
echo " 실패: ${FAIL}/${TOTAL}"
echo " 경고: ${WARN}/${TOTAL}"
RATE=$((PASS * 100 / TOTAL))
echo " 준수율: ${RATE}%"
echo "============================================"

[ "$FAIL" -gt 3 ] && exit 1 || exit 0
