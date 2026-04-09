# WSL2 DevOps 트러블슈팅 가이드

> **작성일**: 2026-04-08 | **검증 환경**: WSL2 Ubuntu, k3s v1.34.6
> **참조**: [완전 구축 가이드](./wsl-devops-complete-guide.md)

---

## 1. WSL2 네트워크 리셋 후 k3s 불통

**증상**: Windows 재부팅 또는 WSL 재시작 후 `kubectl get nodes` 실패

**원인**: WSL2는 재시작 시 네트워크 인터페이스가 재생성됨. k3s 인증서가 이전 IP 기준.

**해결**:
```bash
# k3s 재시작
sudo systemctl restart k3s

# 여전히 안 되면 k3s 노드 인증서 재생성
sudo k3s kubectl --insecure-skip-tls-verify get nodes

# 최후 수단: k3s 재설치
curl -sfL https://get.k3s.io | sh -
```

---

## 2. WSL2 메모리 부족

**증상**: OOMKilled Pod, Docker 컨테이너 비정상 종료

**원인**: WSL2 기본 메모리 제한이 낮거나 전체 스택이 메모리를 초과

**해결**:
```ini
# %USERPROFILE%\.wslconfig 수정 (Windows 측)
[wsl2]
memory=12GB
swap=4GB
```

```powershell
# PowerShell에서 WSL 재시작
wsl --shutdown
```

**메모리 사용량 확인**:
```bash
free -m
# 최소 권장: 가용 메모리 4GB 이상

# k3s Pod별 메모리 확인
kubectl top pods -A --sort-by=memory | head -20
```

---

## 3. systemd 미지원 환경 대응

**증상**: `systemctl` 명령어 실패

**원인**: 일부 WSL2 배포판에서 systemd가 비활성화

**해결**:
```bash
# systemd 활성화 확인
cat /etc/wsl.conf
# [boot]
# systemd=true

# 없으면 추가
sudo tee -a /etc/wsl.conf > /dev/null << EOF
[boot]
systemd=true
EOF
```

```powershell
# PowerShell에서 WSL 재시작
wsl --shutdown
```

---

## 4. localhost vs host.docker.internal

**증상**: 컨테이너 내에서 호스트 서비스 접근 불가

**원인**: Docker 컨테이너 내부에서 `localhost`는 컨테이너 자체를 가리킴

**해결**:
```bash
# 컨테이너 → 호스트: host.docker.internal 사용
# Docker Compose에서 extra_hosts 추가
services:
  my-service:
    extra_hosts:
      - "host.docker.internal:host-gateway"

# 또는 호스트 네트워크 사용
docker run --network host my-image
```

**Gitea ↔ Harbor 연동 시**:
- Gitea 컨테이너에서 Harbor 접근: `http://host.docker.internal:8080`
- 같은 Docker 네트워크면: 서비스 이름 사용 (예: `http://gitea:3000`)

---

## 5. Windows 방화벽 차단

**증상**: 외부(Windows 브라우저)에서 WSL 서비스 접근 불가

**원인**: Windows 방화벽이 WSL2 포트 접근 차단

**해결**:
```powershell
# PowerShell (관리자) — 특정 포트 허용
New-NetFirewallRule -DisplayName "WSL2 Gitea" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "WSL2 Harbor" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "WSL2 Grafana" -Direction Inbound -LocalPort 30302 -Protocol TCP -Action Allow
```

**또는 `.wslconfig`에서 localhostForwarding 확인**:
```ini
[wsl2]
localhostForwarding=true
```

---

## 6. WSL2 디스크 공간 회수

**증상**: WSL2 가상 디스크(ext4.vhdx)가 계속 증가

**원인**: WSL2는 삭제된 파일의 디스크 공간을 자동 회수하지 않음

**해결**:
```bash
# WSL 내에서 불필요한 Docker 리소스 정리
docker system prune -a --volumes -f

# 사용하지 않는 이미지 제거
docker image prune -a -f
```

```powershell
# PowerShell에서 VHDX 압축
wsl --shutdown
# Optimize-VHD 또는 diskpart 사용
```

---

## 7. DNS 해석 실패

**증상**: `apt update`, `curl`, `pip install` 등에서 DNS 실패

**원인**: WSL2의 자동 생성된 `/etc/resolv.conf`가 잘못된 DNS 서버 지정

**해결**:
```bash
# 임시 해결
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf

# 영구 해결 (자동 생성 비활성화)
sudo tee /etc/wsl.conf > /dev/null << EOF
[network]
generateResolvConf = false
[boot]
systemd = true
EOF

echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
sudo chattr +i /etc/resolv.conf  # 변경 방지
```

---

## 8. Docker Desktop vs Docker Engine 선택

**증상**: Docker 명령어 충돌, 리소스 이중 사용

**권장**: WSL2 환경에서는 **Docker Engine (CE)** 직접 설치 권장

| 항목 | Docker Desktop | Docker Engine (CE) |
|------|---------------|-------------------|
| 메모리 | 2GB+ 추가 사용 | 최소 사용 |
| WSL 통합 | 자동 (별도 백엔드) | 네이티브 |
| 라이선스 | 유료 (기업, 250+명) | 무료 |
| 권장 | 개인 개발 | 서버/CI 환경 |

```bash
# Docker Engine 설치 (이미 Docker Desktop 사용 중이면 먼저 제거)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

---

## 9. k3s 인증서 만료

**증상**: `Unable to connect to the server: x509: certificate has expired`

**원인**: k3s 자동 생성 인증서 만료 (기본 1년)

**해결**:
```bash
# 인증서 갱신
sudo k3s certificate rotate

# k3s 재시작
sudo systemctl restart k3s

# 검증
kubectl get nodes
```

---

## 10. 포트 충돌 해결

**증상**: `port is already allocated` 또는 `Address already in use`

**원인**: 다른 서비스가 동일 포트 사용

**진단**:
```bash
# 포트 사용 중인 프로세스 확인
ss -tlnp | grep :3000
# 또는
sudo lsof -i :3000
```

**해결**:
```bash
# 기본 포트 충돌 매핑
# 3000: Gitea (k3s api-gateway와 충돌 가능 → Gitea를 3001로 변경)
# 5432: saas-postgres 사용 중 → Gitea DB는 5434 사용
# 5433: local-postgres 사용 중 → 5434 이상 사용
# 8080: Harbor 기본 → 충돌 시 8443으로 변경
# 9090: Prometheus → NodePort 30090 사용

# Gitea 포트 변경
# infra/gitea/.env에서 GITEA_HTTP_PORT=3001
```

---

## 11. Prometheus node-exporter CrashLoop (WSL2 전용)

**증상**: `CreateContainerError` 또는 `path "/" is mounted on "/" but it is not a shared or slave mount`

**원인**: WSL2의 rootfs mount propagation 미지원

**해결**:
```bash
# Helm 설치 시 또는 업그레이드 시 옵션 추가
helm upgrade kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus-node-exporter.hostRootFsMount.enabled=false
```

---

## 12. Gitea REQUIRE_SIGNIN_VIEW + Health Check 실패

**증상**: Gitea Docker health check이 `unhealthy`로 표시

**원인**: `REQUIRE_SIGNIN_VIEW=true` 설정 시 인증 없는 API 호출이 403 반환

**해결**:

docker-compose.yml의 health check 수정:
```yaml
healthcheck:
  test: ["CMD-SHELL", "curl -sfo /dev/null -w '%{http_code}' http://localhost:3000/ | grep -qE '200|302|303'"]
  interval: 15s
  timeout: 5s
  retries: 10
  start_period: 30s
```

---

## 13. Harbor + k3s 이미지 Pull 실패

**증상**: `ImagePullBackOff` 또는 `unauthorized: unauthorized to access repository`

**원인**: k3s registries.yaml 미설정 또는 k3s 재시작 누락

**해결**:
```bash
# 1. registries.yaml 확인
cat /etc/rancher/k3s/registries.yaml

# 2. 비밀번호가 정확한지 확인
curl -u "admin:비밀번호" http://localhost:8080/api/v2.0/projects

# 3. k3s 재시작
sudo systemctl restart k3s

# 4. Docker insecure-registry 설정 (필요 시)
# /etc/docker/daemon.json
{
  "insecure-registries": ["localhost:8080"]
}
sudo systemctl restart docker
```

---

## 14. Act Runner 등록 토큰 만료

**증상**: Runner 시작 시 `unauthorized` 또는 `invalid token`

**해결**:
```bash
# 새 토큰 발급
docker exec --user git gitea gitea actions generate-runner-token \
  --config /data/gitea/conf/app.ini

# .env 업데이트 후 Runner 재시작
cd /data/ai-saas/infra/gitea
# .env의 RUNNER_REGISTRATION_TOKEN 수정

# Runner 데이터 초기화 후 재시작
docker compose rm -f runner
docker volume rm gitea_runner-data
docker compose up -d runner
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 (실제 구축 중 발생한 이슈 기반) | PM Lead |
