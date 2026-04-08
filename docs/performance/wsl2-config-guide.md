# WSL2 .wslconfig 권장 설정 가이드

> Plan SC: FR-N19.3
> Design Ref: D-N19.3
> CSAP: D-07 가용성 (안정적 운영 환경)

| 항목 | 내용 |
|------|------|
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 대상 | Windows 11 + WSL2 + k3s 환경 |

---

## 1. .wslconfig 파일 위치

```
%UserProfile%\.wslconfig
예: C:\Users\{사용자명}\.wslconfig
```

> **주의**: .wslconfig 변경 후 `wsl --shutdown` 실행 필요

---

## 2. 호스트 RAM별 권장 설정

### 8GB RAM 호스트 (최소 환경)

```ini
[wsl2]
memory=4GB
processors=2
swap=2GB
localhostForwarding=true
nestedVirtualization=false

[experimental]
autoMemoryReclaim=gradual
sparseVhd=true
```

- WSL2: 4GB (50%)
- Windows 예약: 4GB
- k3s + 17 서비스: ~2.8GB (requests 기준)
- 여유: ~1.2GB (버스트 + 빌드)

### 16GB RAM 호스트 (권장 환경)

```ini
[wsl2]
memory=8GB
processors=4
swap=4GB
localhostForwarding=true
nestedVirtualization=false

[experimental]
autoMemoryReclaim=gradual
sparseVhd=true
```

- WSL2: 8GB (50%)
- Windows 예약: 8GB (LM Studio 등 Windows 앱 실행 가능)
- k3s + 17 서비스: ~2.8GB (requests 기준)
- 여유: ~5.2GB (빌드 + 테스트 + Docker)

### 32GB RAM 호스트 (고급 환경)

```ini
[wsl2]
memory=16GB
processors=8
swap=8GB
localhostForwarding=true
nestedVirtualization=false

[experimental]
autoMemoryReclaim=gradual
sparseVhd=true
```

- WSL2: 16GB (50%)
- Windows 예약: 16GB
- 모든 서비스 limits 기준 운영 가능 + HPA 확장

---

## 3. 설정 항목 상세 설명

| 항목 | 설명 | 권장값 |
|------|------|--------|
| `memory` | WSL2 최대 메모리 | 호스트 RAM의 50% |
| `processors` | WSL2 CPU 코어 수 | 호스트 코어의 50~75% |
| `swap` | 스왑 파일 크기 | memory의 50% |
| `localhostForwarding` | localhost 포트 포워딩 | true (k3s NodePort 접근) |
| `nestedVirtualization` | 중첩 가상화 | false (k3s에 불필요) |
| `autoMemoryReclaim` | 메모리 자동 회수 | gradual (점진적 회수) |
| `sparseVhd` | 가상 디스크 희소 파일 | true (디스크 공간 절약) |

---

## 4. 성능 최적화 팁

### 파일 I/O 최적화

```bash
# WSL2 내부 파일시스템 사용 (ext4) -- 네이티브 속도
/home/user/projects/ai-saas  # 빠름

# Windows 마운트 (/mnt/c) 사용 금지 -- 10~100배 느림
/mnt/c/Users/user/projects/  # 느림
```

### Docker Desktop 없이 Docker 사용

```bash
# WSL2 내에서 직접 Docker 설치 (Docker Desktop 대비 메모리 절약)
sudo apt-get update
sudo apt-get install -y docker.io
sudo usermod -aG docker $USER
```

### k3s 전용 cgroup 설정

```bash
# /etc/wsl.conf (WSL2 배포판 내부)
[boot]
systemd=true

[automount]
enabled=true
options="metadata,uid=1000,gid=1000"
```

---

## 5. 문제 해결

### OOM Kill 발생 시

```bash
# 1. 현재 메모리 사용량 확인
free -h
kubectl top pods -n saas

# 2. .wslconfig memory 증가
# 3. k3s 서비스 replicas 축소
# 4. 불필요 서비스 일시 중지
kubectl scale deployment billing-service --replicas=0 -n saas
```

### WSL2 메모리 미반환 시

```powershell
# Windows PowerShell에서 실행
wsl --shutdown
# 재시작 후 메모리 회수됨
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent |
