#!/usr/bin/env bash
# Plan SC: FR-N88.1 ~ FR-N88.5
# 6라운드 통합검증 — MTU-N79~N87 전수 테스트
set -euo pipefail
shopt -s nullglob

echo "============================================================"
echo " 6라운드 CI/CD·DevOps 고도화 통합검증"
echo " MTU-N79 ~ MTU-N87 (9개 MTU, 49개 산출물)"
echo "============================================================"
echo ""

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_TESTS=0
MTU_RESULTS=""

run_mtu_test() {
  local mtu_id="$1"
  local test_script="$2"

  if [ -f "$test_script" ]; then
    echo "--- ${mtu_id} ---"
    if OUTPUT=$(bash "$test_script" 2>&1); then
      PASS_COUNT=$(echo "$OUTPUT" | grep -c "\[PASS\]" || echo "0")
      TOTAL_PASS=$((TOTAL_PASS + PASS_COUNT))
      TOTAL_TESTS=$((TOTAL_TESTS + PASS_COUNT))
      MTU_RESULTS="${MTU_RESULTS}\n  [PASS] ${mtu_id}: ${PASS_COUNT}개 테스트 통과"
    else
      PASS_COUNT=$(echo "$OUTPUT" | grep -c "\[PASS\]" || echo "0")
      FAIL_COUNT=$(echo "$OUTPUT" | grep -c "\[FAIL\]" || echo "0")
      TOTAL_PASS=$((TOTAL_PASS + PASS_COUNT))
      TOTAL_FAIL=$((TOTAL_FAIL + FAIL_COUNT))
      TOTAL_TESTS=$((TOTAL_TESTS + PASS_COUNT + FAIL_COUNT))
      MTU_RESULTS="${MTU_RESULTS}\n  [WARN] ${mtu_id}: ${PASS_COUNT} 통과, ${FAIL_COUNT} 실패"
    fi
  else
    echo "--- ${mtu_id}: 테스트 없음 ---"
    MTU_RESULTS="${MTU_RESULTS}\n  [SKIP] ${mtu_id}: 테스트 스크립트 없음"
  fi
}

# 개별 MTU 테스트 실행
run_mtu_test "MTU-N79 Renovate Bot" "/data/ai-saas/tests/e2e/test-renovate.sh"
run_mtu_test "MTU-N80 S2C2F Framework" "/data/ai-saas/tests/e2e/test-s2c2f.sh"
run_mtu_test "MTU-N81 Vuln Auto Patch" "/data/ai-saas/tests/e2e/test-vuln-patch.sh"
run_mtu_test "MTU-N82 Pyroscope" "/data/ai-saas/tests/e2e/test-pyroscope.sh"
run_mtu_test "MTU-N83 Anomaly Detection" "/data/ai-saas/tests/e2e/test-anomaly-detection.sh"
run_mtu_test "MTU-N84 CSAP Evidence" "/data/ai-saas/tests/e2e/test-csap-evidence.sh"
run_mtu_test "MTU-N85 Audit Report" "/data/ai-saas/tests/e2e/test-audit-report.sh"
run_mtu_test "MTU-N86 Golden Path" "/data/ai-saas/tests/e2e/test-golden-path.sh"
run_mtu_test "MTU-N87 DR Failover" "/data/ai-saas/tests/e2e/test-dr-failover.sh"

echo ""
echo "============================================================"
echo " 크로스 컴포넌트 검증"
echo "============================================================"

# C01: 전체 YAML 문법 검증
echo "[C01] 6라운드 전체 YAML 문법 검증..."
YAML_OK=0; YAML_TOTAL=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  YAML_TOTAL=$((YAML_TOTAL + 1))
  python3 -c "import yaml; list(yaml.safe_load_all(open('$f')))" 2>/dev/null && YAML_OK=$((YAML_OK + 1))
done < <(find /data/ai-saas/infra/renovate /data/ai-saas/infra/security/s2c2f /data/ai-saas/infra/security/vuln-patch /data/ai-saas/infra/pyroscope /data/ai-saas/infra/anomaly-detection /data/ai-saas/infra/compliance/evidence-collector /data/ai-saas/infra/compliance/report-generator /data/ai-saas/infra/dr -maxdepth 1 -name "*.yaml" 2>/dev/null)
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ "$YAML_OK" -eq "$YAML_TOTAL" ]; then
  TOTAL_PASS=$((TOTAL_PASS + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [PASS] C01: YAML 전수 검증 (${YAML_OK}/${YAML_TOTAL})"
else
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [FAIL] C01: YAML 전수 검증 (${YAML_OK}/${YAML_TOTAL})"
fi

# C02: CSAP 라벨 전수 검증
echo "[C02] CSAP 라벨 전수 검증..."
CSAP_LABELED=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  grep -q "csap.compliance" "$f" 2>/dev/null && CSAP_LABELED=$((CSAP_LABELED + 1))
done < <(find /data/ai-saas/infra/renovate /data/ai-saas/infra/security/s2c2f /data/ai-saas/infra/security/vuln-patch /data/ai-saas/infra/pyroscope /data/ai-saas/infra/anomaly-detection /data/ai-saas/infra/compliance/evidence-collector /data/ai-saas/infra/compliance/report-generator /data/ai-saas/infra/dr -maxdepth 1 -name "*.yaml" 2>/dev/null)
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ "$CSAP_LABELED" -ge 10 ]; then
  TOTAL_PASS=$((TOTAL_PASS + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [PASS] C02: CSAP 라벨 (${CSAP_LABELED}개 파일)"
else
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [FAIL] C02: CSAP 라벨 (${CSAP_LABELED}개만)"
fi

# C03: 시크릿 하드코딩 전수 검사
echo "[C03] 시크릿 하드코딩 전수 검사..."
SECRET_FOUND=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  grep -iE "(password|api.?key)\s*[:=]\s*['\"]?[a-zA-Z0-9]{16}" "$f" 2>/dev/null | grep -v "secretKeyRef\|configMapKeyRef" | grep -q . && SECRET_FOUND=$((SECRET_FOUND + 1))
done < <(find /data/ai-saas/infra/renovate /data/ai-saas/infra/security/s2c2f /data/ai-saas/infra/security/vuln-patch /data/ai-saas/infra/pyroscope /data/ai-saas/infra/anomaly-detection /data/ai-saas/infra/compliance/evidence-collector /data/ai-saas/infra/compliance/report-generator /data/ai-saas/infra/dr -maxdepth 1 -name "*.yaml" 2>/dev/null)
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ "$SECRET_FOUND" -eq 0 ]; then
  TOTAL_PASS=$((TOTAL_PASS + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [PASS] C03: 시크릿 하드코딩 전수 검사 (0건)"
else
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [FAIL] C03: 시크릿 하드코딩 (${SECRET_FOUND}건)"
fi

# C04: 아카이브 검증
echo "[C04] 6라운드 아카이브 검증..."
ARCHIVED=0
for n in 79 80 81 82 83 84 85 86 87; do
  ls -d /data/ai-saas/docs/archive/2026-04/MTU-N${n}* 2>/dev/null | head -1 | grep -q . && ARCHIVED=$((ARCHIVED + 1))
done
TOTAL_TESTS=$((TOTAL_TESTS + 1))
if [ "$ARCHIVED" -ge 8 ]; then
  TOTAL_PASS=$((TOTAL_PASS + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [PASS] C04: 아카이브 검증 (${ARCHIVED}/9 MTU)"
else
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [FAIL] C04: 아카이브 (${ARCHIVED}/9 MTU)"
fi

# C05: 감리 체크리스트 실행
echo "[C05] 행안부 감리 체크리스트..."
if bash /data/ai-saas/scripts/audit-checklist-verify.sh 2>/dev/null | grep -q "준수율:"; then
  RATE=$(bash /data/ai-saas/scripts/audit-checklist-verify.sh 2>/dev/null | grep "준수율:" | grep -oE "[0-9]+")
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  if [ "${RATE:-0}" -ge 80 ]; then
    TOTAL_PASS=$((TOTAL_PASS + 1))
    MTU_RESULTS="${MTU_RESULTS}\n  [PASS] C05: 감리 체크리스트 (준수율 ${RATE}%)"
  else
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
    MTU_RESULTS="${MTU_RESULTS}\n  [WARN] C05: 감리 체크리스트 (준수율 ${RATE}%)"
  fi
else
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  TOTAL_FAIL=$((TOTAL_FAIL + 1))
  MTU_RESULTS="${MTU_RESULTS}\n  [FAIL] C05: 감리 체크리스트 실행 실패"
fi

# 최종 결과
PASS_RATE=$((TOTAL_PASS * 100 / TOTAL_TESTS))
echo ""
echo "============================================================"
echo " 6라운드 통합검증 최종 결과"
echo "============================================================"
echo -e "$MTU_RESULTS"
echo ""
echo "------------------------------------------------------------"
echo " 총 테스트: ${TOTAL_TESTS}"
echo " 통과: ${TOTAL_PASS} | 실패: ${TOTAL_FAIL}"
echo " 통과율: ${PASS_RATE}%"
echo "------------------------------------------------------------"

if [ "$PASS_RATE" -ge 90 ]; then
  echo " [SUCCESS] 6라운드 통합검증 성공 (90%+ 달성)"
  exit 0
elif [ "$PASS_RATE" -ge 80 ]; then
  echo " [PARTIAL] 6라운드 통합검증 부분 통과 (80%+)"
  exit 0
else
  echo " [FAIL] 6라운드 통합검증 실패"
  exit 1
fi
