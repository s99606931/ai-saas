#!/bin/bash
# Keycloak Realm Import 자동화
# Design Ref: MTU-N170 §3.8
# Plan SC: FR-SSO.8
# CSAP D-06: 감사 추적 - 구성 변경 이력 관리

set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-https://sso.example.go.kr}"
REALM_FILE="${REALM_FILE:-/data/ai-saas/infra/keycloak/realm-config/public-saas-realm.json}"

echo "[INFO] Keycloak Realm Import 시작"
echo "[INFO] URL: ${KEYCLOAK_URL}"
echo "[INFO] Realm 파일: ${REALM_FILE}"

if [ ! -f "${REALM_FILE}" ]; then
  echo "[ERROR] Realm 파일을 찾을 수 없습니다: ${REALM_FILE}"
  exit 1
fi

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

# Realm 존재 확인
REALM_NAME=$(jq -r '.realm' "${REALM_FILE}")
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

if [ "${HTTP_STATUS}" = "200" ]; then
  echo "[INFO] Realm '${REALM_NAME}' 이미 존재. 업데이트 모드로 실행합니다."
  curl -s -X PUT \
    "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d @"${REALM_FILE}"
  echo "[INFO] Realm 업데이트 완료"
else
  echo "[INFO] Realm '${REALM_NAME}' 신규 생성"
  curl -s -X POST \
    "${KEYCLOAK_URL}/admin/realms" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d @"${REALM_FILE}"
  echo "[INFO] Realm 생성 완료"
fi

# 감사 로그 기록
echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"action\":\"REALM_IMPORT\",\"realm\":\"${REALM_NAME}\",\"actor\":\"system\",\"status\":\"success\"}" \
  >> /data/ai-saas/.claude/audit.jsonl

echo "[INFO] Realm Import 완료"
echo "[INFO] 감사 로그 기록 완료"
