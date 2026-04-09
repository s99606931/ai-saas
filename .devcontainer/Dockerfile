# =============================================================================
# 공공기관 SaaS 프레임워크 개발 컨테이너
# Design Ref: MTU-N58 Section 3.1
# Plan SC: FR-N58.2, FR-N58.5
#
# 포함 도구: Node.js 22, pnpm, kubectl, helm, flux, k9s, cosign, step, etc.
# =============================================================================

FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# 시스템 패키지
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget jq apt-transport-https ca-certificates gnupg \
    postgresql-client redis-tools \
    shellcheck \
    && rm -rf /var/lib/apt/lists/*

# kubectl
RUN curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /" > /etc/apt/sources.list.d/kubernetes.list \
    && apt-get update && apt-get install -y kubectl \
    && rm -rf /var/lib/apt/lists/*

# Helm
RUN curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Flux CLI
RUN curl -s https://fluxcd.io/install.sh | bash 2>/dev/null || true

# kustomize
RUN curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash \
    && mv kustomize /usr/local/bin/ 2>/dev/null || true

# k9s
RUN curl -fsSL https://github.com/derailed/k9s/releases/latest/download/k9s_Linux_amd64.tar.gz | tar xz -C /usr/local/bin k9s 2>/dev/null || true

# yq
RUN wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 \
    && chmod +x /usr/local/bin/yq

# cosign
RUN curl -fsSL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 -o /usr/local/bin/cosign \
    && chmod +x /usr/local/bin/cosign 2>/dev/null || true

# pnpm (글로벌 설치)
RUN npm install -g pnpm@latest

# 비루트 사용자 설정
USER node
WORKDIR /workspace

# kubeconfig 디렉토리
RUN mkdir -p /home/node/.kube /home/node/.config/helm
