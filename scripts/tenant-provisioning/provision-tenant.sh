#!/bin/bash
# Design Ref: MTU-N236 SS2
# Plan SC: FR-MT.1, FR-MT.2, FR-MT.4
# 테넌트 자동 프로비저닝 스크립트 (Keycloak Organizations API)

set -euo pipefail

# --- 사용법 ---
usage() {
  cat <<EOF
사용법: $0 --name <기관명> --domain <도메인> [옵션]

필수:
  --name      기관명 (예: 행정안전부)
  --domain    도메인 (예: mois.go.kr)

선택:
  --admin-email   관리자 이메일
  --description   기관 설명
  --idp-type      IdP 유형 (ldap|saml|oidc)
  --dry-run       실행하지 않고 요청 내용만 출력

환경 변수:
  KEYCLOAK_URL        Keycloak 서버 URL
  KEYCLOAK_REALM      대상 Realm (기본: public-saas)
  KEYCLOAK_CLIENT_ID  Admin 클라이언트 ID
  KEYCLOAK_CLIENT_SECRET  Admin 클라이언트 시크릿
EOF
  exit 1
}

# --- 기본값 ---
KEYCLOAK_URL="${KEYCLOAK_URL:-https://auth.saas.go.kr}"
KEYCLOAK_REALM="${KEYCLOAK_REALM:-public-saas}"
KEYCLOAK_CLIENT_ID="${KEYCLOAK_CLIENT_ID:-admin-cli}"
DRY_RUN=false
TENANT_NAME=""
TENANT_DOMAIN=""
ADMIN_EMAIL=""
DESCRIPTION=""
IDP_TYPE=""

# --- 인자 파싱 ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) TENANT_NAME="$2"; shift 2;;
    --domain) TENANT_DOMAIN="$2"; shift 2;;
    --admin-email) ADMIN_EMAIL="$2"; shift 2;;
    --description) DESCRIPTION="$2"; shift 2;;
    --idp-type) IDP_TYPE="$2"; shift 2;;
    --dry-run) DRY_RUN=true; shift;;
    *) usage;;
  esac
done

[ -z "$TENANT_NAME" ] && echo "ERROR: --name 필수" && usage
[ -z "$TENANT_DOMAIN" ] && echo "ERROR: --domain 필수" && usage

echo "============================================"
echo " 테넌트 프로비저닝: $TENANT_NAME"
echo " 도메인: $TENANT_DOMAIN"
echo " Keycloak: $KEYCLOAK_URL"
echo " Realm: $KEYCLOAK_REALM"
echo "============================================"

# --- 토큰 획득 ---
get_token() {
  if [ -z "${KEYCLOAK_CLIENT_SECRET:-}" ]; then
    echo "ERROR: KEYCLOAK_CLIENT_SECRET 환경 변수 필요"
    exit 1
  fi

  curl -sf -X POST \
    "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
    -d "grant_type=client_credentials" \
    -d "client_id=$KEYCLOAK_CLIENT_ID" \
    -d "client_secret=$KEYCLOAK_CLIENT_SECRET" \
    | jq -r '.access_token'
}

# --- Organization 생성 (FR-MT.2) ---
create_organization() {
  local token="$1"
  local payload
  payload=$(cat <<ORGEOF
{
  "name": "$TENANT_NAME",
  "alias": "$(echo "$TENANT_DOMAIN" | tr '.' '-')",
  "enabled": true,
  "description": "${DESCRIPTION:-$TENANT_NAME 테넌트}",
  "domains": [
    {
      "name": "$TENANT_DOMAIN",
      "verified": false
    }
  ],
  "attributes": {
    "tier": ["standard"],
    "provisionedAt": ["$(date -u +%Y-%m-%dT%H:%M:%SZ)"],
    "provisionedBy": ["auto-provisioning-script"]
  }
}
ORGEOF
  )

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Organization 생성 요청:"
    echo "$payload" | jq .
    return
  fi

  echo "[STEP 1/4] Organization 생성..."
  curl -sf -X POST \
    "$KEYCLOAK_URL/admin/realms/$KEYCLOAK_REALM/organizations" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$payload"
  echo "  완료"
}

# --- 기본 그룹 생성 (FR-MT.4) ---
create_default_groups() {
  local token="$1"
  local org_alias
  org_alias="$(echo "$TENANT_DOMAIN" | tr '.' '-')"

  local groups=("${org_alias}-admin" "${org_alias}-user" "${org_alias}-viewer")

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] 기본 그룹 생성: ${groups[*]}"
    return
  fi

  echo "[STEP 2/4] 기본 그룹 생성..."
  for group in "${groups[@]}"; do
    curl -sf -X POST \
      "$KEYCLOAK_URL/admin/realms/$KEYCLOAK_REALM/groups" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"name\": \"$group\"}" || true
    echo "  그룹 생성: $group"
  done
}

# --- 관리자 초대 ---
invite_admin() {
  local token="$1"

  if [ -z "$ADMIN_EMAIL" ]; then
    echo "[STEP 3/4] 관리자 이메일 미지정, 건너뜀"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] 관리자 초대: $ADMIN_EMAIL"
    return
  fi

  echo "[STEP 3/4] 관리자 초대: $ADMIN_EMAIL"
  # Organization 멤버 초대 API
  local org_id
  org_id=$(curl -sf \
    "$KEYCLOAK_URL/admin/realms/$KEYCLOAK_REALM/organizations?search=$(echo "$TENANT_DOMAIN" | tr '.' '-')" \
    -H "Authorization: Bearer $token" | jq -r '.[0].id')

  if [ "$org_id" != "null" ] && [ -n "$org_id" ]; then
    curl -sf -X POST \
      "$KEYCLOAK_URL/admin/realms/$KEYCLOAK_REALM/organizations/$org_id/members/invite-user" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "{\"email\": \"$ADMIN_EMAIL\", \"roles\": [\"org-admin\"]}" || true
    echo "  초대 완료"
  fi
}

# --- 감사 로그 기록 ---
log_audit() {
  local action="$1"
  local status="$2"
  local audit_entry
  audit_entry=$(cat <<AUDITEOF
{"timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","action":"TENANT_${action}","tenant":"$TENANT_NAME","domain":"$TENANT_DOMAIN","status":"$status","actor":"provisioning-script"}
AUDITEOF
  )

  if [ -f ".claude/audit.jsonl" ]; then
    echo "$audit_entry" >> .claude/audit.jsonl
  fi
  echo "[AUDIT] $audit_entry"
}

# --- 메인 실행 ---
main() {
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN 모드] 실행하지 않고 요청 내용만 출력합니다."
    create_organization ""
    create_default_groups ""
    invite_admin ""
    echo ""
    echo "[DRY-RUN] 프로비저닝 시뮬레이션 완료"
    log_audit "PROVISION_DRY_RUN" "success"
    return
  fi

  local token
  token=$(get_token)

  create_organization "$token"
  create_default_groups "$token"
  invite_admin "$token"

  echo "[STEP 4/4] 프로비저닝 완료"
  log_audit "PROVISION" "success"

  echo ""
  echo "============================================"
  echo " 프로비저닝 완료: $TENANT_NAME ($TENANT_DOMAIN)"
  echo "============================================"
}

main
