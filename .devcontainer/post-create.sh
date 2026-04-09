#!/bin/bash
# =============================================================================
# DevContainer 초기화 스크립트
# Design Ref: MTU-N58 Section 3.1
# Plan SC: FR-N58.3, FR-N58.5
#
# 이 스크립트는 devcontainer 생성 후 자동 실행됩니다.
# =============================================================================

set -euo pipefail

echo "=============================================="
echo " 공공기관 SaaS 프레임워크 - 개발 환경 초기화"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# --- Step 1: pnpm 설치 ---
echo ""
echo "[1/6] 의존성 설치..."
if [ -f "pnpm-lock.yaml" ] || [ -f "package.json" ]; then
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install || echo "[SKIP] pnpm install 실패 (수동 실행 필요)"
fi

# --- Step 2: k3s kubeconfig 연결 ---
echo ""
echo "[2/6] k3s kubeconfig 설정..."
if [ -f "/etc/rancher/k3s/k3s.yaml" ]; then
  mkdir -p "$HOME/.kube"
  cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
  chmod 600 "$HOME/.kube/config"
  echo "  k3s kubeconfig 복사 완료"
elif [ -n "${KUBECONFIG:-}" ] && [ -f "${KUBECONFIG}" ]; then
  echo "  KUBECONFIG 환경 변수 사용: ${KUBECONFIG}"
else
  echo "  [INFO] k3s 미설치. kubeconfig 수동 설정 필요"
  echo "  방법: WSL 호스트에서 k3s.yaml 복사"
  echo "    cp /etc/rancher/k3s/k3s.yaml ~/.kube/config"
fi

# --- Step 3: Helm 리포지토리 추가 ---
echo ""
echo "[3/6] Helm 리포지토리 설정..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true
helm repo add linkerd https://helm.linkerd.io/stable 2>/dev/null || true
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts 2>/dev/null || true
helm repo add kedacore https://kedacore.github.io/charts 2>/dev/null || true
helm repo add flagger https://flagger.app 2>/dev/null || true
helm repo update 2>/dev/null || true
echo "  Helm 리포지토리 6개 추가 완료"

# --- Step 4: Git 설정 ---
echo ""
echo "[4/6] Git 설정..."
git config --global core.autocrlf input
git config --global init.defaultBranch main
git config --global pull.rebase false
echo "  Git 기본 설정 완료"

# --- Step 5: 시크릿 보호 확인 ---
echo ""
echo "[5/6] 시크릿 보호 확인..."
if [ -f ".gitignore" ]; then
  for pattern in ".env" "secrets.*" "*credential*" "*.key" "*.pem"; do
    if grep -q "$pattern" .gitignore 2>/dev/null; then
      echo "  .gitignore: ${pattern} 보호됨"
    else
      echo "  [WARNING] .gitignore에 ${pattern} 패턴 추가 권장"
    fi
  done
fi

# --- Step 6: 도구 버전 확인 ---
echo ""
echo "[6/6] 도구 버전 확인..."
echo "  Node.js:  $(node --version 2>/dev/null || echo 'N/A')"
echo "  pnpm:     $(pnpm --version 2>/dev/null || echo 'N/A')"
echo "  kubectl:  $(kubectl version --client --short 2>/dev/null || echo 'N/A')"
echo "  helm:     $(helm version --short 2>/dev/null || echo 'N/A')"
echo "  flux:     $(flux --version 2>/dev/null || echo 'N/A')"
echo "  k9s:      $(k9s version --short 2>/dev/null || echo 'N/A')"
echo "  jq:       $(jq --version 2>/dev/null || echo 'N/A')"
echo "  yq:       $(yq --version 2>/dev/null || echo 'N/A')"
echo "  cosign:   $(cosign version 2>/dev/null | head -1 || echo 'N/A')"

echo ""
echo "=============================================="
echo " 개발 환경 초기화 완료!"
echo " 온보딩 가이드: .devcontainer/onboarding-guide.md"
echo "=============================================="
