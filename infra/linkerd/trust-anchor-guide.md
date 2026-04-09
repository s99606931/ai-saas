# Linkerd Trust Anchor 인증서 관리 가이드

> **Design Ref**: MTU-N54 Section 3.2
> **Plan SC**: FR-N54.2, FR-N54.11
> **CSAP**: D-09 암호화

---

## 1. 개요

Linkerd의 mTLS는 3계층 인증서 체계를 사용합니다:

```
Trust Anchor (Root CA) ─── 10년 유효, 오프라인 보관
  └── Identity Issuer (Intermediate CA) ─── 1년 유효, 클러스터 내 배포
        └── 워크로드 인증서 ─── 24시간 유효, 자동 회전
```

---

## 2. 사전 요구사항

```bash
# step CLI 설치 (인증서 생성 도구)
wget https://dl.smallstep.com/gh-release/cli/docs-cli-install/v0.27.4/step-cli_0.27.4_amd64.deb
sudo dpkg -i step-cli_0.27.4_amd64.deb
step version
```

---

## 3. Trust Anchor 생성

```bash
# Trust Anchor (Root CA) - 10년 유효
# 보안 주의: ca.key는 오프라인 보관 필수 (git 커밋 금지)
step certificate create root.linkerd.cluster.local ca.crt ca.key \
  --profile root-ca \
  --no-password --insecure \
  --not-after=87600h

# 검증
step certificate inspect ca.crt --short
```

---

## 4. Identity Issuer 생성

```bash
# Identity Issuer (Intermediate CA) - 1년 유효
step certificate create identity.linkerd.cluster.local issuer.crt issuer.key \
  --profile intermediate-ca \
  --not-after=8760h \
  --no-password --insecure \
  --ca ca.crt --ca-key ca.key

# 검증
step certificate inspect issuer.crt --short
```

---

## 5. Linkerd 설치 시 인증서 적용

```bash
helm install linkerd-control-plane linkerd/linkerd-control-plane \
  -n linkerd \
  --set-file identityTrustAnchorsPEM=ca.crt \
  --set-file identity.issuer.tls.crtPEM=issuer.crt \
  --set-file identity.issuer.tls.keyPEM=issuer.key \
  -f values.yaml
```

---

## 6. 인증서 회전 절차

### 6.1 Identity Issuer 회전 (매년)

```bash
# 새 Issuer 생성
step certificate create identity.linkerd.cluster.local issuer-new.crt issuer-new.key \
  --profile intermediate-ca --not-after=8760h \
  --no-password --insecure \
  --ca ca.crt --ca-key ca.key

# Linkerd 업데이트
helm upgrade linkerd-control-plane linkerd/linkerd-control-plane \
  -n linkerd \
  --set-file identity.issuer.tls.crtPEM=issuer-new.crt \
  --set-file identity.issuer.tls.keyPEM=issuer-new.key \
  --reuse-values
```

### 6.2 Trust Anchor 회전 (10년 전 갱신 권장: 9년차)

Trust Anchor 회전은 번들 방식으로 수행합니다:
1. 새 Trust Anchor 생성
2. 기존 + 신규 Trust Anchor를 번들로 배포
3. 모든 워크로드가 새 CA를 신뢰하면 기존 제거

---

## 7. k3s + WSL2 주의사항

- k3s의 기본 CNI(flannel)와 Linkerd는 호환됩니다
- WSL2 환경에서 iptables 설정 확인: `sudo iptables -L`
- WSL2 메모리 제한 시 프록시 리소스 최소화 (10Mi/프록시)
- `/etc/wsl.conf`에서 systemd=true 확인 필수

---

## 8. 보안 주의사항 (CSAP D-09)

- **ca.key (Trust Anchor 개인키)**: 절대 git 커밋 금지. 오프라인 보관
- **issuer.key (Issuer 개인키)**: Sealed Secrets로 암호화 후 GitOps 배포
- 인증서 만료 모니터링: Prometheus 알림 설정 필수
- 워크로드 인증서: 24시간 자동 회전 (수동 개입 불필요)
