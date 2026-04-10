#!/usr/bin/env bash
# E2E 릴리스 파이프라인 v2 테스트
# Plan SC: FR-N118.6
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
log_result() {
  TOTAL=$((TOTAL + 1))
  if [ "$3" = "PASS" ]; then PASS=$((PASS + 1)); echo "[PASS] $1: $2"
  else FAIL=$((FAIL + 1)); echo "[FAIL] $1: $2"; fi
}

echo "=========================================="
echo "E2E 릴리스 파이프라인 v2 테스트"
echo "MTU-N118 | $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# T-N118.1: 릴리스 워크플로우 유효성
echo ""
echo "--- T-N118.1: 릴리스 워크플로우 ---"
WF="/data/ai-saas/.gitea/workflows/release-pipeline-v2.yaml"
if python3 -c "import yaml; yaml.safe_load(open('$WF'))" 2>/dev/null; then
  log_result "T-N118.1" "릴리스 워크플로우 YAML 유효" "PASS"
else
  log_result "T-N118.1" "릴리스 워크플로우 파싱 실패" "FAIL"
fi

# 필수 Job 확인
for job in "build-test" "security-scan" "image-build-sign" "production-readiness"; do
  if grep -q "$job" "$WF"; then
    log_result "T-N118.1" "Job '$job' 정의" "PASS"
  else
    log_result "T-N118.1" "Job '$job' 미정의" "FAIL"
  fi
done

# T-N118.2: SLO 기반 롤백 AnalysisTemplate 유효성
echo ""
echo "--- T-N118.2: SLO 롤백 분석 ---"
AT="/data/ai-saas/infra/argo-rollouts/slo-rollback-analysis.yaml"
if python3 -c "import yaml; list(yaml.safe_load_all(open('$AT')))" 2>/dev/null; then
  log_result "T-N118.2" "AnalysisTemplate YAML 유효" "PASS"
else
  log_result "T-N118.2" "AnalysisTemplate 파싱 실패" "FAIL"
fi

# SLO 메트릭 3개 확인 (에러율, 지연시간, 가용성)
METRIC_COUNT=$(grep -c "name:.*slo" "$AT" || echo "0")
if [ "$METRIC_COUNT" -ge 3 ]; then
  log_result "T-N118.2" "SLO 메트릭 ${METRIC_COUNT}개 정의" "PASS"
else
  log_result "T-N118.2" "SLO 메트릭 부족 ($METRIC_COUNT/3)" "FAIL"
fi

# T-N118.3: 프로덕션 체크리스트 스크립트
echo ""
echo "--- T-N118.3: 프로덕션 체크리스트 ---"
PRC="/data/ai-saas/scripts/production-readiness-check.sh"
chmod +x "$PRC"
if bash "$PRC" 2>/dev/null; then
  log_result "T-N118.3" "프로덕션 체크리스트 통과" "PASS"
else
  log_result "T-N118.3" "프로덕션 체크리스트 실행 실패" "FAIL"
fi

# T-N118.4: 릴리스 노트 생성 스크립트
echo ""
echo "--- T-N118.4: 릴리스 노트 생성 ---"
RN="/data/ai-saas/scripts/generate-release-notes-v2.sh"
chmod +x "$RN"
if bash "$RN" "v-test-$(date +%s)" 2>/dev/null; then
  log_result "T-N118.4" "릴리스 노트 생성 성공" "PASS"
else
  log_result "T-N118.4" "릴리스 노트 생성 실패" "FAIL"
fi

# T-N118.5: Cosign 서명 단계 확인
echo ""
echo "--- T-N118.5: 보안 단계 확인 ---"
if grep -q "cosign sign" "$WF"; then
  log_result "T-N118.5" "Cosign 이미지 서명 단계 존재" "PASS"
else
  log_result "T-N118.5" "Cosign 서명 단계 미존재" "FAIL"
fi
if grep -q "sbom\|syft\|SBOM" "$WF"; then
  log_result "T-N118.5" "SBOM 생성 단계 존재" "PASS"
else
  log_result "T-N118.5" "SBOM 생성 단계 미존재" "FAIL"
fi

# T-N118.6: 감사 로그 기록 확인
if grep -q "audit.jsonl" "$WF"; then
  log_result "T-N118.6" "감사 로그 기록 포함" "PASS"
else
  log_result "T-N118.6" "감사 로그 미포함" "FAIL"
fi

# 결과 요약
echo ""
echo "=========================================="
echo "총 테스트: $TOTAL | 통과: $PASS | 실패: $FAIL"
echo "통과율: $(( PASS * 100 / TOTAL ))%"
echo "=========================================="
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
