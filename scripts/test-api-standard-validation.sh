#!/bin/bash
# Design Ref: MTU-N240
set -euo pipefail

PASS=0; FAIL=0; TOTAL=0
check() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "0" ]; then echo "  [PASS] $1"; PASS=$((PASS + 1))
  else echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); fi
}

echo "============================================"
echo " MTU-N240: 공공 API 표준 검증 테스트"
echo "============================================"

echo ""
echo "[TC-01] 검증 스크립트"
test -f scripts/api-standard-validator.sh; check "validator 스크립트 존재" $?
grep -q "securitySchemes" scripts/api-standard-validator.sh; check "보안 스킴 검사" $?
grep -q "resultCode" scripts/api-standard-validator.sh; check "공공 표준 응답 검사" $?
grep -q "operationId" scripts/api-standard-validator.sh; check "operationId 검사" $?
grep -q "HTTPS" scripts/api-standard-validator.sh; check "HTTPS 검사" $?
grep -q "json" scripts/api-standard-validator.sh; check "JSON 출력 지원" $?

echo ""
echo "[TC-02] API 표준 규칙 파일"
test -f infra/cicd/api-standard-rules.yaml; check "규칙 파일 존재" $?
grep -q "response_format:" infra/cicd/api-standard-rules.yaml; check "응답 형식 규칙" $?
grep -q "error_codes:" infra/cicd/api-standard-rules.yaml; check "에러 코드 규칙" $?
grep -q "security_rules:" infra/cicd/api-standard-rules.yaml; check "보안 규칙" $?
grep -q "openapi_rules:" infra/cicd/api-standard-rules.yaml; check "OpenAPI 규칙" $?
grep -q "versioning_rules:" infra/cicd/api-standard-rules.yaml; check "버전 관리 규칙" $?

echo ""
echo "[TC-03] 샘플 OpenAPI 스펙 검증"
# 임시 테스트 스펙 생성
TEMP_SPEC=$(mktemp /tmp/test-api-spec-XXXXXX.yaml)
cat > "$TEMP_SPEC" <<'SPECEOF'
openapi: "3.0.3"
info:
  title: "공공기관 SaaS API"
  version: "1.0.0"
servers:
  - url: "https://api.saas.go.kr/api/v1"
paths:
  /tenants:
    get:
      operationId: listTenants
      security:
        - bearerAuth: []
      responses:
        "200":
          description: "성공"
          content:
            application/json:
              schema:
                type: object
                properties:
                  resultCode: { type: string }
                  resultMsg: { type: string }
                  data: { type: array }
        "400":
          description: "잘못된 요청"
        "401":
          description: "인증 실패"
        "403":
          description: "권한 없음"
        "404":
          description: "리소스 없음"
        "500":
          description: "서버 오류"
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
SPECEOF

bash scripts/api-standard-validator.sh "$TEMP_SPEC" > /dev/null 2>&1; check "샘플 스펙 검증 통과" $?
rm -f "$TEMP_SPEC"

echo ""
echo "[TC-04] Design/Plan 추적성"
grep -q "Design Ref" scripts/api-standard-validator.sh; check "스크립트 Design Ref" $?
grep -q "Plan SC" scripts/api-standard-validator.sh; check "스크립트 Plan SC" $?
grep -q "Design Ref" infra/cicd/api-standard-rules.yaml; check "규칙 Design Ref" $?

echo ""
echo "============================================"
echo " 결과: $PASS / $TOTAL PASS  ($FAIL FAIL)"
echo "============================================"
[ "$FAIL" -eq 0 ] && echo "ALL TESTS PASSED" || echo "SOME TESTS FAILED"
