#!/bin/bash
# Keycloak Realm Export 자동화
# Design Ref: MTU-N170 §3.8
# Plan SC: FR-SSO.8
# CSAP D-06: 감사 추적 - 구성 변경 이력 관리

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-https://sso.example.go.kr}"
REALM="${REALM:-public-saas}"
EXPORT_DIR="${EXPORT_DIR:-/data/ai-saas/infra/keycloak/realm-config}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "[INFO] Keycloak Realm Export 시작: ${REALM}"
echo "[INFO] URL: ${KEYCLOAK_URL}"
echo "[INFO] 출력 경로: ${EXPORT_DIR}"

# 관리자 토큰 발급
ADMIN_TOKEN=$(curl -s -X POST \
  "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${KEYCLOAK_ADMIN_USER}" \
  -d "password=${KEYCLOAK_ADMIN_PASSWORD}" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" | jq -r '.access_token')

if [ "${ADMIN_TOKEN}" = "null" ] || [ -z "${ADMIN_TOKEN}" ]; then
  echo "[ERROR] 관리자 토큰 발급 실패"
  exit 1
fi

# Realm 전체 내보내기
echo "[INFO] Realm '${REALM}' 내보내기 중..."
curl -s -X GET \
  "${KEYCLOAK_URL}/admin/realms/${REALM}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Accept: application/json" \
  -o "${EXPORT_DIR}/${REALM}-realm-${TIMESTAMP}.json"

# Client 목록 내보내기
echo "[INFO] Client 목록 내보내기 중..."
curl -s -X GET \
  "${KEYCLOAK_URL}/admin/realms/${REALM}/clients" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Accept: application/json" \
  -o "${EXPORT_DIR}/${REALM}-clients-${TIMESTAMP}.json"

# Role 목록 내보내기
echo "[INFO] Role 목록 내보내기 중..."
curl -s -X GET \
  "${KEYCLOAK_URL}/admin/realms/${REALM}/roles" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Accept: application/json" \
  -o "${EXPORT_DIR}/${REALM}-roles-${TIMESTAMP}.json"

# Group 목록 내보내기
echo "[INFO] Group 목록 내보내기 중..."
curl -s -X GET \
  "${KEYCLOAK_URL}/admin/realms/${REALM}/groups" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Accept: application/json" \
  -o "${EXPORT_DIR}/${REALM}-groups-${TIMESTAMP}.json"

echo "[INFO] Realm Export 완료: ${EXPORT_DIR}/"
echo "[INFO] 파일 목록:"
ls -la "${EXPORT_DIR}/"*-${TIMESTAMP}.json 2>/dev/null || echo "  (파일 없음)"

# 감사 로그 기록
echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"REALM_EXPORT\",\"realm\":\"${REALM}\",\"actor\":\"system\",\"status\":\"success\"}" \
  >> /data/ai-saas/.claude/audit.jsonl

echo "[INFO] 감사 로그 기록 완료"
