---
sidebar_position: 2
---

# k3s 배포

k3s는 경량 Kubernetes로, 프로덕션 환경에서 사용합니다.

> **상세 가이드**: [k3s 완전 가이드](./k3s-complete-guide) — 초급부터 고급까지 설치, 관리, 모니터링 전체 포함

## 빠른 시작

```bash
# 1. k3s 설치 (공공 SaaS 보안 옵션 포함)
sudo ./docs/framework/08-infra/k3s-wsl2/scripts/install-k3s.sh

# 2. kubectl 설정
mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config

# 3. 확인
kubectl get nodes
kubectl get pods -n saas-platform
```

## 주요 운영 명령어

```bash
kubectl get all -n saas-platform          # 전체 현황
kubectl top pods -n saas-platform         # 리소스 사용량
kubectl get events -A --sort-by=.lastTimestamp  # 이벤트 확인
kubectl port-forward svc/portal-svc 14000:4000 -n saas-platform  # 접근
```

자세한 내용은 [k3s 완전 가이드](./k3s-complete-guide)를 참조하세요.
