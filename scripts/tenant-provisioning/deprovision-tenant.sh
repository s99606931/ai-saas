#!/bin/bash
# Design Ref: MTU-N236 SS3
# Plan SC: FR-MT.6
# 테넌트 디프로비저닝 (비활성화 → 보존 → 삭제)

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-https://auth.saas.go.kr}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-public-saas}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-admin-cli}"

usage() {
  cat <<EOF
사용법: $0 --domain <도메인> [--force-delete]

  --domain        대상 테넌트 도메인
  --force-delete  보존 기간 무시하고 즉시 삭제 (주의)
  --dry-run       실행하지 않고 내용만 출력
EOF
  exit 1
}

DOMAIN=""
FORCE_DELETE=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2;;
    --force-delete) FORCE_DELETE=true; shift;;
    --dry-run) DRY_RUN=true; shift;;
    *) usage;;
  esac
done

[ -z "$DOMAIN" ] && usage

echo "============================================"
echo " 테넌트 디프로비저닝: $DOMAIN"
echo " 모드: $([ "$FORCE_DELETE" = true ] && echo '즉시 삭제' || echo '비활성화 (90일 보존)')"
echo "============================================"

get_token() {
  curl -sf -X POST \
    "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -d "grant_type=client_credentials" \
    -d "client_id=$KEYCLOAK_CLIENT_ID" \
    -d "client_secret=$KEYCLOAK_CLIENT_SECRET" \
    | jq -r '.access_token'
}

deactivate_org() {
  local token="$1"
  local org_alias
  org_alias="$(echo "$DOMAIN" | tr '.' '-')"

  echo "[STEP 1] Organization 비활성화..."
  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY-RUN] PATCH organizations/$org_alias {enabled: false}"
    return
  fi

  local org_id
  org_id=$(curl -sf \
    "$KEYCLOAK_URL/admin/realms/$KEYCLOAK_REALM/organizations?search=$org_alias" \
    -H "Authorization: Bearer $token" | jq -r '.[0].id')

  if [ "$org_id" = "null" ] || [ -z "$org_id" ]; then
    echo "  ERROR: Organization 찾을 수 없음: $org_alias"
    exit 1
  fi

  curl -sf -X PUT \
    "$KEYCLOAK_URL/admin/realms/$KEYCLOAK_REALM/organizations/$org_id" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "{\"enabled\": false, \"attributes\": {\"deactivatedAt\": [\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"], \"retentionDays\": [\"90\"]}}"
  echo "  비활성화 완료 (90일 보존 후 삭제)"
}

# 감사 로그
log_audit() {
  local action="$1"
  local audit_entry="{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"TENANT_${action}\",\"domain\":\"$DOMAIN\",\"actor\":\"deprovisioning-script\"}"
  if [ -f ".claude/audit.jsonl" ]; then
    echo "$audit_entry" >> .claude/audit.jsonl
  fi
  echo "[AUDIT] $audit_entry"
}

main() {
  if [ "$DRY_RUN" = true ]; then
    deactivate_org ""
    log_audit "DEPROVISION_DRY_RUN"
    return
  fi

  local token
  token=$(get_token)
  deactivate_org "$token"
  log_audit "DEPROVISION"
}

main
