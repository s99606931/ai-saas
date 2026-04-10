#!/bin/bash
# MTU-N184: Round 17 통합 검증
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() { TOTAL=$((TOTAL+1)); if [ "$2" = "0" ]; then echo "[PASS] $1"; PASS=$((PASS+1)); else echo "[FAIL] $1"; FAIL=$((FAIL+1)); fi; }

echo "============================================"
echo "MTU-N184: Round 17 통합 검증"
echo "일시: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# 1. 모든 MTU 산출물 존재 확인
echo "--- 산출물 존재 검증 ---"
for mtu in N179 N180 N181 N182 N183; do
  check "MTU-${mtu} Plan 존재" "$(test -f "docs/01-plan/mtus/MTU-${mtu}.plan.md" && echo 0 || echo 1)"
  check "MTU-${mtu} Design 존재" "$(test -f "docs/02-design/mtus/MTU-${mtu}.design.md" && echo 0 || echo 1)"
  check "MTU-${mtu} Report 존재" "$(test -f "docs/04-report/MTU-${mtu}.report.md" && echo 0 || echo 1)"
done

# 2. 모든 인프라 파일 존재
echo ""
echo "--- 인프라 파일 검증 ---"
check "네트워크 품질 rules" "$(test -f "infra/monitoring/network-quality-rules.yaml" && echo 0 || echo 1)"
check "컨테이너 런타임 rules" "$(test -f "infra/monitoring/container-runtime-rules.yaml" && echo 0 || echo 1)"
check "로그 이상 탐지 rules" "$(test -f "infra/monitoring/log-anomaly-rules.yaml" && echo 0 || echo 1)"
check "로그 메트릭 rules" "$(test -f "infra/monitoring/log-metrics-rules.yaml" && echo 0 || echo 1)"
check "Ingress 트래픽 rules" "$(test -f "infra/monitoring/ingress-traffic-rules.yaml" && echo 0 || echo 1)"
check "Job/CronJob rules" "$(test -f "infra/monitoring/job-cronjob-rules.yaml" && echo 0 || echo 1)"

# 3. 대시보드 파일 존재 및 유효성
echo ""
echo "--- 대시보드 검증 ---"
for db in network-quality container-runtime log-anomaly ingress-traffic job-cronjob; do
  check "${db} 대시보드 존재" "$(test -f "infra/monitoring/dashboards/${db}.json" && echo 0 || echo 1)"
  check "${db} JSON 유효성" "$(python3 -c "import json; json.load(open('infra/monitoring/dashboards/${db}.json'))" 2>/dev/null && echo 0 || echo 1)"
done

# 4. CSAP 통제항목 매핑 검증
echo ""
echo "--- CSAP 통제항목 매핑 ---"
check "D-06 매핑 (침해사고)" "$(grep -rl 'D-06' infra/monitoring/network-quality-rules.yaml infra/monitoring/container-runtime-rules.yaml infra/monitoring/log-anomaly-rules.yaml infra/monitoring/log-metrics-rules.yaml infra/monitoring/job-cronjob-rules.yaml | wc -l | awk '{print ($1>=3)? 0:1}')"
check "D-08 매핑 (접근통제)" "$(grep -rl 'D-08' infra/monitoring/log-anomaly-rules.yaml infra/monitoring/ingress-traffic-rules.yaml | wc -l | awk '{print ($1>=1)? 0:1}')"
check "D-09 매핑 (암호화)" "$(grep -q 'D-09' infra/monitoring/ingress-traffic-rules.yaml && echo 0 || echo 1)"
check "D-12 매핑 (시스템보안)" "$(grep -rl 'D-12' infra/monitoring/container-runtime-rules.yaml infra/monitoring/log-anomaly-rules.yaml infra/monitoring/job-cronjob-rules.yaml | wc -l | awk '{print ($1>=2)? 0:1}')"
check "D-13 매핑 (네트워크)" "$(grep -rl 'D-13' infra/monitoring/network-quality-rules.yaml infra/monitoring/ingress-traffic-rules.yaml | wc -l | awk '{print ($1>=2)? 0:1}')"

# 5. N2SF 매핑 검증
echo ""
echo "--- N2SF 매핑 ---"
check "네트워크 N2SF 라벨" "$(grep -q 'n2sf' infra/monitoring/network-quality-rules.yaml && echo 0 || echo 1)"
check "로그 N2SF 라벨" "$(grep -q 'n2sf' infra/monitoring/log-metrics-rules.yaml && echo 0 || echo 1)"

# 6. 아카이브 검증
echo ""
echo "--- 아카이브 검증 ---"
for mtu in N179 N180 N181 N182 N183; do
  dir=$(ls -d docs/archive/2026-04/MTU-${mtu}-* 2>/dev/null | head -1)
  check "MTU-${mtu} 아카이브" "$(test -d "$dir" && echo 0 || echo 1)"
done

# 7. 보안 전수 검증
echo ""
echo "--- 보안 전수 검증 ---"
SECURITY_FAIL=0
for f in infra/monitoring/network-quality-rules.yaml infra/monitoring/container-runtime-rules.yaml infra/monitoring/log-anomaly-rules.yaml infra/monitoring/log-metrics-rules.yaml infra/monitoring/ingress-traffic-rules.yaml infra/monitoring/job-cronjob-rules.yaml; do
  if grep -qiE '(password|secret|token|api.?key)\s*[:=]' "$f" 2>/dev/null; then
    SECURITY_FAIL=1
  fi
done
check "전체 rules 시크릿 없음" "$SECURITY_FAIL"

echo ""
echo "============================================"
echo "통합 검증 결과: $PASS/$TOTAL 통과 (실패: $FAIL)"
echo "============================================"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
echo "Round 17 통합 검증 완료"
