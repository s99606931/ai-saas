#!/bin/bash
# =============================================================================
# Linkerd v2.16 설치 스크립트 (k3s + WSL2 환경)
# Design Ref: MTU-N54 Section 3.1
# Plan SC: FR-N54.1, FR-N54.2, FR-N54.3
# CSAP: D-09 암호화 (서비스 간 mTLS 자동화)
# =============================================================================

set -euo pipefail

LINKERD_VERSION="stable-2.16.0"
STEP_VERSION="0.27.4"
NAMESPACE="linkerd"

echo "=============================================="
echo " Linkerd 서비스 메시 설치 (k3s + WSL2)"
echo " 버전: ${LINKERD_VERSION}"
echo " $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# --- Step 1: Linkerd CLI 설치 ---
echo ""
echo "[Step 1] Linkerd CLI 설치..."
if ! command -v linkerd &>/dev/null; then
  curl --proto '=https' --tlsv1.3 -sSfL https://run.linkerd.io/install | sh
  export PATH="$HOME/.linkerd2/bin:$PATH"
  echo 'export PATH="$HOME/.linkerd2/bin:$PATH"' >> ~/.bashrc
fi
echo "Linkerd CLI: $(linkerd version --client 2>/dev/null || echo '설치 필요')"

# --- Step 2: step CLI 설치 (인증서 생성용) ---
echo ""
echo "[Step 2] step CLI 확인..."
if ! command -v step &>/dev/null; then
  echo "step CLI 미설치. 설치 방법:"
  echo "  wget https://dl.smallstep.com/gh-release/cli/docs-cli-install/v${STEP_VERSION}/step-cli_${STEP_VERSION}_amd64.deb"
  echo "  sudo dpkg -i step-cli_${STEP_VERSION}_amd64.deb"
fi

# --- Step 3: Trust Anchor 인증서 생성 ---
echo ""
echo "[Step 3] Trust Anchor 인증서 생성..."
CERT_DIR="/data/ai-saas/infra/linkerd/certs"
mkdir -p "$CERT_DIR"

if [ ! -f "${CERT_DIR}/ca.crt" ]; then
  if command -v step &>/dev/null; then
    step certificate create root.linkerd.cluster.local \
      "${CERT_DIR}/ca.crt" "${CERT_DIR}/ca.key" \
      --profile root-ca --no-password --insecure \
      --not-after=87600h
    echo "Trust Anchor 생성 완료 (10년 유효)"
  else
    echo "[SKIP] step CLI 미설치 - 인증서 수동 생성 필요"
    echo "  참조: infra/linkerd/trust-anchor-guide.md"
  fi
fi

if [ ! -f "${CERT_DIR}/issuer.crt" ]; then
  if command -v step &>/dev/null && [ -f "${CERT_DIR}/ca.crt" ]; then
    step certificate create identity.linkerd.cluster.local \
      "${CERT_DIR}/issuer.crt" "${CERT_DIR}/issuer.key" \
      --profile intermediate-ca --not-after=8760h \
      --no-password --insecure \
      --ca "${CERT_DIR}/ca.crt" --ca-key "${CERT_DIR}/ca.key"
    echo "Identity Issuer 생성 완료 (1년 유효)"
  fi
fi

# --- Step 4: Linkerd CRDs 설치 ---
echo ""
echo "[Step 4] Linkerd CRDs 설치..."
if kubectl get crd serverauthorizations.policy.linkerd.io &>/dev/null 2>&1; then
  echo "Linkerd CRDs 이미 설치됨"
else
  echo "Linkerd CRDs 설치 중..."
  helm repo add linkerd-edge https://helm.linkerd.io/edge 2>/dev/null || true
  helm repo add linkerd https://helm.linkerd.io/stable 2>/dev/null || true
  helm repo update

  helm install linkerd-crds linkerd/linkerd-crds \
    -n "${NAMESPACE}" --create-namespace --wait
  echo "Linkerd CRDs 설치 완료"
fi

# --- Step 5: Linkerd Control Plane 설치 ---
echo ""
echo "[Step 5] Linkerd Control Plane 설치..."
if kubectl get deploy -n "${NAMESPACE}" linkerd-destination &>/dev/null 2>&1; then
  echo "Linkerd Control Plane 이미 설치됨"
else
  if [ -f "${CERT_DIR}/ca.crt" ] && [ -f "${CERT_DIR}/issuer.crt" ]; then
    helm install linkerd-control-plane linkerd/linkerd-control-plane \
      -n "${NAMESPACE}" \
      --set-file identityTrustAnchorsPEM="${CERT_DIR}/ca.crt" \
      --set-file identity.issuer.tls.crtPEM="${CERT_DIR}/issuer.crt" \
      --set-file identity.issuer.tls.keyPEM="${CERT_DIR}/issuer.key" \
      -f /data/ai-saas/infra/linkerd/values.yaml \
      --wait --timeout 5m
    echo "Linkerd Control Plane 설치 완료"
  else
    echo "[SKIP] 인증서 미생성 - Trust Anchor 먼저 생성 필요"
  fi
fi

# --- Step 6: Linkerd Viz 확장 설치 ---
echo ""
echo "[Step 6] Linkerd Viz 대시보드 설치..."
if kubectl get ns linkerd-viz &>/dev/null 2>&1; then
  echo "Linkerd Viz 이미 설치됨"
else
  helm install linkerd-viz linkerd/linkerd-viz \
    -n linkerd-viz --create-namespace \
    --set prometheus.enabled=false \
    --set prometheusUrl="http://kube-prometheus-stack-prometheus.monitoring:9090" \
    --wait --timeout 5m 2>/dev/null || echo "[SKIP] Viz 설치 보류 (Control Plane 필요)"
fi

# --- Step 7: 네임스페이스 메시 주입 ---
echo ""
echo "[Step 7] 서비스 네임스페이스 메시 주입 설정..."
for ns in saas default; do
  if kubectl get ns "$ns" &>/dev/null 2>&1; then
    kubectl annotate ns "$ns" linkerd.io/inject=enabled --overwrite 2>/dev/null || true
    echo "  ${ns}: 메시 주입 활성화"
  fi
done

echo ""
echo "=============================================="
echo " Linkerd 설치 완료"
echo " mTLS: 자동 활성화 (메시 주입된 Pod 간)"
echo " 인증서 회전: 24시간 주기"
echo "=============================================="
