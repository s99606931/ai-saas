#!/bin/bash
# Design Ref: MTU-N243
# Plan SC: FR-PM.1 ~ FR-PM.4
# 플랫폼 성숙도 자동 평가

set -euo pipefail

TOTAL_CHECKS=0
PASSED_CHECKS=0

check_exists() {
  local path="$1"
  local desc="$2"
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if [ -e "$path" ] || ls $path 2>/dev/null | head -1 | grep -q "."; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    echo "  [L4+] $desc"
    return 0
  else
    echo "  [---] $desc (미구현)"
    return 1
  fi
}

echo "============================================================"
echo " 공공기관 SaaS 플랫폼 성숙도 평가"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo " 모델: CNCF Platform Maturity + CSAP/N2SF Extension"
echo "============================================================"

# --- 1. CI/CD 파이프라인 ---
echo ""
echo "=== 1. CI/CD 파이프라인 ==="
CICD_PASS=0; CICD_TOTAL=5
check_exists ".gitea/workflows/" "자동화된 빌드/테스트 워크플로우" && CICD_PASS=$((CICD_PASS+1))
check_exists "infra/cosign/" "보안 스캔 통합 (Cosign)" && CICD_PASS=$((CICD_PASS+1))
check_exists "infra/flux/" "GitOps 배포 자동화 (Flux)" && CICD_PASS=$((CICD_PASS+1))
check_exists "infra/feature-flags/" "Feature Flag 점진적 배포" && CICD_PASS=$((CICD_PASS+1))
check_exists ".gitea/workflows/hotfix-pipeline.yaml" "Hotfix 파이프라인" && CICD_PASS=$((CICD_PASS+1))
CICD_SCORE=$((CICD_PASS * 5 / CICD_TOTAL))
echo "  >> CI/CD 성숙도: L${CICD_SCORE} ($CICD_PASS/$CICD_TOTAL)"

# --- 2. 관측성 ---
echo ""
echo "=== 2. 관측성 ==="
OBS_PASS=0; OBS_TOTAL=5
check_exists "infra/monitoring/" "메트릭 수집 (Prometheus)" && OBS_PASS=$((OBS_PASS+1))
check_exists "infra/monitoring/dashboards/" "대시보드 (Grafana)" && OBS_PASS=$((OBS_PASS+1))
check_exists "infra/monitoring/rules/" "Recording/Alert Rules" && OBS_PASS=$((OBS_PASS+1))
check_exists "infra/monitoring/dashboards/business-kpi-dashboard.json" "비즈니스 KPI 대시보드" && OBS_PASS=$((OBS_PASS+1))
check_exists "infra/monitoring/alerts/predictive-alerts.yaml" "예측적 알림" && OBS_PASS=$((OBS_PASS+1))
OBS_SCORE=$((OBS_PASS * 5 / OBS_TOTAL))
echo "  >> 관측성 성숙도: L${OBS_SCORE} ($OBS_PASS/$OBS_TOTAL)"

# --- 3. 보안 컴플라이언스 ---
echo ""
echo "=== 3. 보안 컴플라이언스 ==="
SEC_PASS=0; SEC_TOTAL=5
check_exists "infra/compliance/" "CSAP 컴플라이언스" && SEC_PASS=$((SEC_PASS+1))
check_exists "infra/cosign/" "공급망 보안 (Cosign/SBOM)" && SEC_PASS=$((SEC_PASS+1))
check_exists "infra/network-policies/" "네트워크 격리" && SEC_PASS=$((SEC_PASS+1))
check_exists "scripts/api-standard-validator.sh" "공공 API 표준 검증" && SEC_PASS=$((SEC_PASS+1))
check_exists "infra/compliance/egov-compatibility-checklist.yaml" "전자정부 호환성" && SEC_PASS=$((SEC_PASS+1))
SEC_SCORE=$((SEC_PASS * 5 / SEC_TOTAL))
echo "  >> 보안 성숙도: L${SEC_SCORE} ($SEC_PASS/$SEC_TOTAL)"

# --- 4. 인프라 자동화 ---
echo ""
echo "=== 4. 인프라 자동화 ==="
INF_PASS=0; INF_TOTAL=5
check_exists "infra/helm/" "IaC (Helm Charts)" && INF_PASS=$((INF_PASS+1))
check_exists "infra/flux/" "GitOps (Flux)" && INF_PASS=$((INF_PASS+1))
check_exists "infra/keycloak/ldap-federation/" "LDAP/AD 연동" && INF_PASS=$((INF_PASS+1))
check_exists "scripts/tenant-provisioning/" "멀티테넌트 프로비저닝" && INF_PASS=$((INF_PASS+1))
check_exists "infra/dr/" "DR 자동화" && INF_PASS=$((INF_PASS+1))
INF_SCORE=$((INF_PASS * 5 / INF_TOTAL))
echo "  >> 인프라 성숙도: L${INF_SCORE} ($INF_PASS/$INF_TOTAL)"

# --- 5. 거버넌스 ---
echo ""
echo "=== 5. 거버넌스 ==="
GOV_PASS=0; GOV_TOTAL=5
check_exists ".claude/audit.jsonl" "감사 로그" && GOV_PASS=$((GOV_PASS+1))
check_exists "docs/archive/" "PDCA 문서화" && GOV_PASS=$((GOV_PASS+1))
check_exists "scripts/change-impact-analysis-v2.sh" "변경 영향 분석" && GOV_PASS=$((GOV_PASS+1))
check_exists "packages/dora-exporter/" "DORA 메트릭" && GOV_PASS=$((GOV_PASS+1))
check_exists "infra/slo/" "SRE 문화 (SLO)" && GOV_PASS=$((GOV_PASS+1))
GOV_SCORE=$((GOV_PASS * 5 / GOV_TOTAL))
echo "  >> 거버넌스 성숙도: L${GOV_SCORE} ($GOV_PASS/$GOV_TOTAL)"

# --- 종합 ---
TOTAL_SCORE=$((CICD_SCORE + OBS_SCORE + SEC_SCORE + INF_SCORE + GOV_SCORE))
AVG_SCORE=$((TOTAL_SCORE / 5))
PERCENTAGE=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))

echo ""
echo "============================================================"
echo " 종합 플랫폼 성숙도 평가 결과"
echo "============================================================"
echo ""
echo " CI/CD 파이프라인:  L${CICD_SCORE}/5"
echo " 관측성:            L${OBS_SCORE}/5"
echo " 보안 컴플라이언스: L${SEC_SCORE}/5"
echo " 인프라 자동화:     L${INF_SCORE}/5"
echo " 거버넌스:          L${GOV_SCORE}/5"
echo ""
echo " 종합 성숙도 수준:  L${AVG_SCORE}/5"
echo " 항목 통과율:       $PASSED_CHECKS/$TOTAL_CHECKS ($PERCENTAGE%)"
echo ""
echo " 성숙도 등급:"
if [ "$AVG_SCORE" -ge 5 ]; then echo "  *** L5: Optimizing (최적화) ***"
elif [ "$AVG_SCORE" -ge 4 ]; then echo "  *** L4: Measured (측정) ***"
elif [ "$AVG_SCORE" -ge 3 ]; then echo "  *** L3: Defined (정의) ***"
elif [ "$AVG_SCORE" -ge 2 ]; then echo "  *** L2: Managed (관리) ***"
else echo "  *** L1: Initial (초기) ***"
fi
echo "============================================================"
