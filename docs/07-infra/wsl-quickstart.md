# WSL2 DevOps 빠른 시작 가이드

> **소요 시간**: 5분 (사전 요건 충족 시)
> **대상**: 기본 도구(Docker, k3s)가 설치된 환경
> **상세 가이드**: [wsl-devops-complete-guide.md](./wsl-devops-complete-guide.md)

---

## 1. 원클릭 설치

```bash
cd /data/ai-saas
./scripts/setup-wsl2-all.sh
```

이 스크립트가 다음을 자동 수행합니다:
1. 사전 요건 확인 (Docker, k3s 등)
2. Gitea + PostgreSQL 기동
3. Harbor 설치 및 기동
4. Act Runner 등록
5. k3s 레지스트리 미러 설정
6. 전체 검증 테스트

---

## 2. 상태 확인

```bash
./scripts/setup-wsl2-all.sh --status
```

또는 개별 확인:

```bash
# k3s
kubectl get nodes                          # Ready 확인

# Gitea
curl -s http://localhost:3000/api/v1/version   # {"version":"1.22.6"}

# Harbor
curl -s http://localhost:8080/api/v2.0/health  # components 목록

# Flux
kubectl get pods -n flux-system            # 4개 Running

# Prometheus
curl -s http://localhost:30090/api/v1/query?query=up  # 메트릭

# Grafana
# 브라우저에서 http://localhost:30302 접속 (admin/admin)
```

---

## 3. 접근 URL

| 서비스 | URL | 계정 |
|--------|-----|------|
| Gitea | http://localhost:3000 | saas-admin / (설치 시 생성된 비밀번호) |
| Harbor | http://localhost:8080 | admin / (설치 시 생성된 비밀번호) |
| Grafana | http://localhost:30302 | admin / admin |
| Prometheus | http://localhost:30090 | (인증 없음) |

---

## 4. 첫 번째 배포 (Push → Build → Deploy)

```bash
# 1. Gitea에 저장소 생성
source /data/ai-saas/infra/gitea/.env
curl -X POST -u "${GITEA_ADMIN_USER}:${GITEA_ADMIN_PASSWORD}" \
  -H "Content-Type: application/json" \
  -d '{"name":"hello-app","auto_init":true}' \
  http://localhost:3000/api/v1/user/repos

# 2. 소스코드 Push
git clone http://localhost:3000/saas-admin/hello-app.git /tmp/hello-app
cd /tmp/hello-app
echo 'FROM alpine:3.19
CMD ["echo","Hello Public SaaS"]' > Dockerfile
git add . && git commit -m "feat: add Dockerfile"
git push

# 3. 이미지 빌드 및 Harbor Push
docker build -t localhost:8080/public-saas/hello-app:v1 .
docker push localhost:8080/public-saas/hello-app:v1

# 4. k3s 배포
kubectl run hello-app --image=localhost:8080/public-saas/hello-app:v1 --restart=Never
kubectl logs hello-app
# 예상 출력: Hello Public SaaS
```

---

## 5. 중지 및 재시작

```bash
# 전체 중지
./scripts/setup-wsl2-all.sh --stop

# Gitea만 중지
cd /data/ai-saas/infra/gitea && docker compose stop

# Harbor만 중지
cd /opt/harbor && docker compose stop

# k3s 중지/시작
sudo systemctl stop k3s
sudo systemctl start k3s
```

---

## 문제 발생 시

[트러블슈팅 가이드](./wsl-troubleshooting.md) 참조

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
