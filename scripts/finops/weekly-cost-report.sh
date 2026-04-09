#!/bin/bash
# =============================================================================
# 주간 비용 리포트 자동 생성
# Design Ref: MTU-N59 Section 3.1
# Plan SC: FR-N59.7
# =============================================================================

set -euo pipefail

REPORT_DIR="/data/ai-saas/docs/finops-reports"
REPORT_FILE="${REPORT_DIR}/weekly-$(date +%Y%m%d).md"
mkdir -p "$REPORT_DIR"

echo "=============================================="
echo " 주간 비용 리포트 생성"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# CPU/메모리 가격 (온프레미스 기준, 시간당)
CPU_COST_PER_CORE_HOUR=0.05    # $0.05/core/hour
MEM_COST_PER_GI_HOUR=0.01     # $0.01/GiB/hour

cat > "$REPORT_FILE" << 'HEADER'
# 주간 FinOps 비용 리포트

HEADER

echo "| 항목 | 값 |" >> "$REPORT_FILE"
echo "|------|-----|" >> "$REPORT_FILE"
echo "| 리포트 기간 | $(date -d '7 days ago' +%Y-%m-%d) ~ $(date +%Y-%m-%d) |" >> "$REPORT_FILE"
echo "| 생성 일시 | $(date '+%Y-%m-%d %H:%M:%S') |" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "## 네임스페이스별 리소스 요약" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| 네임스페이스 | Pod 수 | CPU 요청 | 메모리 요청 |" >> "$REPORT_FILE"
echo "|-------------|--------|---------|-----------|" >> "$REPORT_FILE"

for ns in saas default monitoring flux-system; do
  POD_COUNT=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | wc -l || echo "0")
  echo "| ${ns} | ${POD_COUNT} | - | - |" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "## 최적화 권고사항" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "1. VPA 추천값 확인: \`kubectl get vpa -n saas -o yaml\`" >> "$REPORT_FILE"
echo "2. 오버프로비저닝 확인: \`./scripts/finops/overprovisioning-check.sh\`" >> "$REPORT_FILE"
echo "3. 유휴 리소스 확인: \`./scripts/finops/idle-resource-detect.sh\`" >> "$REPORT_FILE"
echo "4. KEDA scale-to-zero 대상 검토" >> "$REPORT_FILE"

echo ""
echo " 리포트 생성: ${REPORT_FILE}"
echo "=============================================="
