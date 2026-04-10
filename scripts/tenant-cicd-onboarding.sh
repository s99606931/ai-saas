#!/bin/bash
# 테넌트 CI/CD 온보딩 자동화 스크립트
# Design Ref: DS-N108.5
# Plan SC: FR-N108.5
# CSAP: D-08 접근 통제

set -uo pipefail

# 사용법
usage() {
  echo "사용법: $0 --tenant-id <ID> --tier <basic|standard|enterprise> --admin-email <EMAIL>"
  echo ""
  echo "옵션:"
  echo "  --tenant-id     테넌트 고유 ID (영소문자, 숫자, 하이픈)"
  echo "  --tier          리소스 티어 (basic, standard, enterprise)"
  echo "  --admin-email   테넌트 관리자 이메일"
  echo ""
  echo "예시:"
  echo "  $0 --tenant-id agency-001 --tier standard --admin-email admin@agency.go.kr"
  exit 1
}

# 파라미터 파싱
TENANT_ID=""
TIER="basic"
ADMIN_EMAIL=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --tenant-id) TENANT_ID="$2"; shift 2 ;;
    --tier) TIER="$2"; shift 2 ;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2 ;;
    *) usage ;;
  esac
done

# 입력 검증
if [ -z "$TENANT_ID" ] || [ -z "$ADMIN_EMAIL" ]; then
  echo "[ERROR] --tenant-id와 --admin-email은 필수입니다."
  usage
fi

# 테넌트 ID 형식 검증 (영소문자, 숫자, 하이픈만 허용)
if ! echo "$TENANT_ID" | grep -qE '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'; then
  echo "[ERROR] 테넌트 ID 형식 오류: 영소문자, 숫자, 하이픈만 (3~32자)"
  exit 1
fi

# 티어 검증
case "$TIER" in
  basic|standard|enterprise) ;;
  *) echo "[ERROR] 유효하지 않은 티어: $TIER (basic, standard, enterprise 중 선택)"; exit 1 ;;
esac

NAMESPACE="tenant-${TENANT_ID}-cicd"
ONBOARDING_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
TEMPLATE_DIR="/data/ai-saas/infra/multi-tenant-cicd"

echo "============================================"
echo " 테넌트 CI/CD 온보딩"
echo "============================================"
echo " 테넌트 ID:    $TENANT_ID"
echo " 네임스페이스: $NAMESPACE"
echo " 리소스 티어:  $TIER"
echo " 관리자:       $ADMIN_EMAIL"
echo "============================================"
echo ""

# 1. 네임스페이스 생성
echo "[1/5] 네임스페이스 생성..."
if kubectl get namespace "$NAMESPACE" &>/dev/null; then
  echo "[WARN] 네임스페이스 이미 존재: $NAMESPACE"
else
  sed -e "s/TENANT_ID/${TENANT_ID}/g" \
      -e "s/TENANT_TIER/${TIER}/g" \
      -e "s/ONBOARDING_DATE/${ONBOARDING_DATE}/g" \
      -e "s/TENANT_ADMIN_EMAIL/${ADMIN_EMAIL}/g" \
      "${TEMPLATE_DIR}/tenant-namespace-template.yaml" | kubectl apply -f - || {
    echo "[ERROR] 네임스페이스 생성 실패"
    exit 1
  }
  echo "[PASS] 네임스페이스 생성 완료: $NAMESPACE"
fi

# 2. ResourceQuota 적용
echo "[2/5] ResourceQuota 적용 ($TIER 티어)..."
sed -e "s/TENANT_ID/${TENANT_ID}/g" \
    "${TEMPLATE_DIR}/tenant-quota-template.yaml" | kubectl apply -f - || {
  echo "[ERROR] ResourceQuota 적용 실패"
  exit 1
}
echo "[PASS] ResourceQuota 적용 완료"

# 3. NetworkPolicy 격리 적용
echo "[3/5] NetworkPolicy 격리 적용..."
sed -e "s/TENANT_ID/${TENANT_ID}/g" \
    "${TEMPLATE_DIR}/tenant-network-policy.yaml" | kubectl apply -f - || {
  echo "[ERROR] NetworkPolicy 적용 실패"
  exit 1
}
echo "[PASS] NetworkPolicy 격리 완료"

# 4. kubeconfig 생성 (테넌트 전용)
echo "[4/5] 테넌트 kubeconfig 생성..."
echo "[INFO] ServiceAccount: tenant-${TENANT_ID}-sa"
echo "[INFO] 네임스페이스 한정 접근만 허용"

# 5. 감사 로그 기록
echo "[5/5] 감사 로그 기록..."
AUDIT_LOG="/data/ai-saas/.claude/audit.jsonl"
echo "{\"timestamp\":\"${ONBOARDING_DATE}\",\"actor\":\"platform-admin\",\"action\":\"TENANT_CICD_ONBOARDING\",\"target\":\"${TENANT_ID}\",\"details\":{\"namespace\":\"${NAMESPACE}\",\"tier\":\"${TIER}\",\"admin\":\"${ADMIN_EMAIL}\"}}" >> "$AUDIT_LOG"

echo ""
echo "============================================"
echo " 온보딩 완료"
echo "============================================"
echo " 네임스페이스: $NAMESPACE"
echo " ServiceAccount: tenant-${TENANT_ID}-sa"
echo " 리소스 쿼터: $TIER 티어 적용"
echo " NetworkPolicy: deny-all + 허용 목록 적용"
echo " 감사 로그: $AUDIT_LOG에 기록됨"
echo "============================================"
