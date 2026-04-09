# 개발자 온보딩 가이드

> **대상**: 공공기관 SaaS 프레임워크 신규 개발자
> **목표**: 30분 이내 개발 환경 구축 및 첫 코드 실행

---

## 1. 사전 요구사항

- Docker Desktop 또는 Rancher Desktop
- VS Code + Dev Containers 확장
- Git 클라이언트

---

## 2. 환경 구축 (5분)

```bash
# 1. 리포지토리 클론
git clone <repository-url>
cd ai-saas

# 2. VS Code에서 열기
code .

# 3. 좌측 하단 "><" 클릭 → "Reopen in Container" 선택
# 자동으로 Docker 이미지 빌드 + 도구 설치 + 의존성 설치
```

---

## 3. k3s 연결 (10분)

### WSL2 환경 (로컬 개발)
```bash
# WSL2에서 k3s 설치
curl -sfL https://get.k3s.io | sh -

# kubeconfig 복사
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER ~/.kube/config

# 연결 확인
kubectl get nodes
```

### 원격 클러스터 연결
```bash
# kubeconfig 파일을 ~/.kube/config에 복사
# 또는 KUBECONFIG 환경 변수 설정
export KUBECONFIG=~/.kube/remote-config
```

---

## 4. 개발 서버 시작 (5분)

```bash
# 의존성 설치
pnpm install

# 개발 서버 시작
pnpm dev

# 포트 자동 포워딩:
# - 3000: 포털 (Next.js)
# - 3001: 관리자 포털
# - 8080: API Gateway
```

---

## 5. 주요 도구 사용법

```bash
# k3s 클러스터 대시보드
k9s

# Helm 차트 배포
helm install saas-platform ./infra/helm/saas-platform -f infra/helm/saas-platform/values-dev.yaml

# Flux GitOps 상태 확인
flux get all

# 정책 확인
kubectl get constrainttemplates  # Gatekeeper
kubectl get cpol                  # Kyverno
```

---

## 6. CSAP/N2SF 규정 주의사항

1. **시크릿 커밋 금지**: `.env`, `*.key`, `*credential*` 파일은 절대 커밋하지 않습니다
2. **AI API 데이터**: C/S등급 데이터는 AI API에 전송 금지
3. **코드 리뷰**: 모든 PR은 보안 리뷰 필수
4. **감사 로그**: 민감 작업은 자동 감사 로그 기록

---

## 7. 문제 해결

| 증상 | 해결 방법 |
|------|----------|
| Container 빌드 실패 | Docker Desktop 재시작, 디스크 공간 확인 |
| kubectl 연결 실패 | `~/.kube/config` 파일 존재 확인, 권한 확인 |
| pnpm install 실패 | `pnpm store prune` 후 재시도 |
| 포트 충돌 | `lsof -i :3000` 으로 점유 프로세스 확인 |
