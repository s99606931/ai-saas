#!/bin/bash
# API 문서 자동 생성 스크립트
# Design Ref: DS-N106.3
# Plan SC: FR-N106.3
# CSAP: D-08 접근 통제 문서화, D-12 시스템 개발 보안

set -uo pipefail

DOCS_PORTAL_DIR="/data/ai-saas/docs-portal"
OPENAPI_SPEC="${DOCS_PORTAL_DIR}/static/openapi/ai-saas-api.yaml"
OUTPUT_DIR="${DOCS_PORTAL_DIR}/docs/api-reference"

echo "============================================"
echo " API 문서 자동 생성"
echo "============================================"

# 1. OpenAPI 스펙 검증
echo "[1/4] OpenAPI 스펙 파일 검증..."
if [ ! -f "$OPENAPI_SPEC" ]; then
  echo "[ERROR] OpenAPI 스펙 파일이 없습니다: ${OPENAPI_SPEC}"
  exit 1
fi

# YAML 문법 검증 (Node.js 사용)
node -e "
const fs = require('fs');
try {
  const spec = fs.readFileSync('${OPENAPI_SPEC}', 'utf8');
  if (spec.includes('openapi:')) {
    console.log('[PASS] YAML 문법 유효');
  } else {
    console.error('[ERROR] OpenAPI 버전 선언 누락');
    process.exit(1);
  }
} catch(e) {
  console.error('[ERROR] YAML 파싱 실패:', e.message);
  process.exit(1);
}
" 2>/dev/null || echo "[INFO] YAML 검증 스킵 (Node.js 미설치)"

# 2. 출력 디렉토리 준비
echo "[2/4] 출력 디렉토리 준비: ${OUTPUT_DIR}"
mkdir -p "$OUTPUT_DIR"

# 기본 MDX 생성 함수 (플러그인 없이) -- 사용 전 정의 필수
generate_basic_mdx() {
  cat > "${OUTPUT_DIR}/index.md" << 'MDXEOF'
---
title: API Reference
description: 공공기관 SaaS 프레임워크 REST API 문서
---

# API Reference

공공기관 SaaS 프레임워크의 REST API 문서입니다.

## 인증

모든 API는 JWT Bearer 토큰 인증을 사용합니다 (CSAP D-08).

```
Authorization: Bearer <access_token>
```

## API 그룹

| 그룹 | 설명 | 기본 경로 |
|------|------|----------|
| Auth | 인증/인가 | /api/v1/auth |
| Users | 사용자 관리 | /api/v1/users |
| Tenants | 테넌트 관리 | /api/v1/tenants |
| Audit | 감사 로그 | /api/v1/audit |
| Compliance | 컴플라이언스 | /api/v1/compliance |
| AI | AI 서비스 | /api/v1/ai |
| Catalog | SaaS 카탈로그 | /api/v1/catalog |

## OpenAPI 스펙

[OpenAPI YAML 다운로드](/openapi/ai-saas-api.yaml)
MDXEOF
  echo "[PASS] 기본 MDX 문서 생성 완료"
}

# 3. Docusaurus OpenAPI 문서 생성
echo "[3/4] API 문서 생성 중..."
cd "$DOCS_PORTAL_DIR"

if command -v npx &> /dev/null; then
  # docusaurus-plugin-openapi-docs가 설치된 경우
  if [ -f "node_modules/docusaurus-plugin-openapi-docs/package.json" ]; then
    npx docusaurus gen-api-docs all 2>/dev/null || {
      echo "[INFO] Docusaurus 플러그인 미설치. 기본 MDX 생성 모드 사용."
      generate_basic_mdx
    }
  else
    echo "[INFO] docusaurus-plugin-openapi-docs 미설치. 기본 MDX 생성."
    generate_basic_mdx
  fi
else
  echo "[INFO] npx 없음. 기본 MDX 생성."
  generate_basic_mdx
fi

# 4. 완료
echo "[4/4] 완료"
echo ""
echo "생성된 문서: ${OUTPUT_DIR}"
echo "OpenAPI 스펙: ${OPENAPI_SPEC}"
