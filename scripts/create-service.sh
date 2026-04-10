#!/usr/bin/env bash
# Design Ref: MTU-N86 §Design Anchor
# Plan SC: FR-N86.5
# 셀프서비스 프로비저닝 스크립트
set -euo pipefail

TEMPLATE_DIR="/data/ai-saas/templates/golden-path"
SERVICE_NAME="${1:-}"
TARGET_DIR="${2:-/data/ai-saas/packages/${SERVICE_NAME}}"

if [ -z "$SERVICE_NAME" ]; then
  echo "사용법: $0 <서비스명> [대상경로]"
  echo ""
  echo "예시:"
  echo "  $0 payment-service"
  echo "  $0 report-service /data/ai-saas/packages/report-service"
  echo ""
  echo "Golden Path 포함 항목:"
  echo "  - Node.js 서비스 (Express + TypeScript)"
  echo "  - Helm Chart (PSS Restricted 기본값)"
  echo "  - CI/CD 파이프라인 (Gitea Actions)"
  echo "  - CSAP D-12 보안 설정 자동 적용"
  exit 1
fi

echo "============================================"
echo " Golden Path 서비스 프로비저닝"
echo " 서비스명: ${SERVICE_NAME}"
echo " 대상 경로: ${TARGET_DIR}"
echo "============================================"
echo ""

# 대상 디렉토리 존재 확인
if [ -d "$TARGET_DIR" ]; then
  echo "[ERROR] 디렉토리가 이미 존재합니다: ${TARGET_DIR}"
  exit 1
fi

# 템플릿 복사
echo "[1/4] 템플릿 복사..."
mkdir -p "${TARGET_DIR}"
cp -r "${TEMPLATE_DIR}/nodejs/"* "${TARGET_DIR}/"
mkdir -p "${TARGET_DIR}/helm"
cp -r "${TEMPLATE_DIR}/helm/"* "${TARGET_DIR}/helm/"
mkdir -p "${TARGET_DIR}/.gitea/workflows"
cp "${TEMPLATE_DIR}/cicd/gitea-workflow.yaml" "${TARGET_DIR}/.gitea/workflows/ci.yaml"

# 변수 치환
echo "[2/4] 서비스명 치환..."
find "${TARGET_DIR}" -type f \( -name "*.yaml" -o -name "*.json" -o -name "*.ts" -o -name "*.md" \) | while read f; do
  sed -i "s/{{SERVICE_NAME}}/${SERVICE_NAME}/g" "$f" 2>/dev/null || true
done

# tsconfig.json 생성
echo "[3/4] TypeScript 설정 생성..."
cat > "${TARGET_DIR}/tsconfig.json" <<'TSCONF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
TSCONF

# 완료 메시지
echo "[4/4] 프로비저닝 완료."
echo ""
echo "============================================"
echo " 서비스 생성 완료: ${SERVICE_NAME}"
echo "============================================"
echo ""
echo " 다음 단계:"
echo "   cd ${TARGET_DIR}"
echo "   npm install"
echo "   npm run dev"
echo ""
echo " 배포:"
echo "   helm install ${SERVICE_NAME} ./helm -n saas-dev"
echo ""
echo " CSAP 보안 기본값 포함:"
echo "   - PSS Restricted 준수"
echo "   - NetworkPolicy 기본 활성화"
echo "   - RBAC 최소 권한"
echo "   - 이미지 서명 (Cosign)"
echo "   - SBOM 자동 생성"
echo "============================================"
