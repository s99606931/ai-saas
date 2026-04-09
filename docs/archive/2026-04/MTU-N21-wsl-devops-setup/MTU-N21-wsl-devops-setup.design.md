# MTU-N21: WSL DevOps 환경 완전 구축 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **Plan 참조**: docs/01-plan/mtus/MTU-N21-wsl-devops-setup.plan.md

---

## 1. 아키텍처 결정

### Option C: Pragmatic Balance (선택)

기존 스크립트를 최대한 재사용하되, 실제 실행 결과에 기반하여 수정/보강합니다.

```
[WSL2 Ubuntu]
  |
  +-- Docker Engine (v29.3.1)
  |     |
  |     +-- Gitea (gitea:1.22) + PostgreSQL (16-alpine)
  |     |     port: 3000 (HTTP), 2222 (SSH), 5433 (DB)
  |     |
  |     +-- Act Runner (gitea/act_runner:latest)
  |     |     Docker-in-Docker via /var/run/docker.sock
  |     |
  |     +-- Harbor (v2.11.2, offline installer)
  |           port: 8080 (HTTP)
  |
  +-- k3s (v1.34.6+k3s1, 이미 설치됨)
  |     |
  |     +-- saas-platform namespace (23 pods)
  |     +-- monitoring namespace (신규: Prometheus + Grafana)
  |     +-- flux-system namespace (신규: Flux v2)
  |
  +-- Flux v2 CLI
        GitOps 부트스트랩 → Gitea 저장소 연동
```

---

## 2. 실행 설계 (Session Guide)

### Phase 1: 기존 환경 확인 및 포트 충돌 해소 (5분)

```bash
# 현재 상태: k3s Running, Docker Running
# 포트 충돌 확인:
#   - 3000: k3s api-gateway NodePort(32276) vs Gitea(3000)
#     → Gitea를 3001로 변경하거나, k3s api-gateway 포트 변경
#   - 5432: saas-postgres 사용 중 → Gitea DB는 5433 사용 (충돌 없음)
#   - 8080: 미사용 → Harbor 사용 가능
```

**포트 할당 최종 결정**:

| 서비스 | 포트 | 비고 |
|--------|------|------|
| k3s API | 6443 | 기존 |
| Gitea HTTP | 3001 | 3000은 k3s api-gateway와 충돌 가능 → 3001 사용 |
| Gitea SSH | 2222 | 기존 |
| Gitea DB | 5433 | 기존 |
| Harbor HTTP | 8080 | 기존 |
| Prometheus | 9090 | k8s 내부 |
| Grafana | 3002 | NodePort 30302 |

### Phase 2: Gitea 기동 (10분)

```bash
# 1. .env 파일 생성 (비밀번호 자동 생성)
# 2. docker compose up -d
# 3. 관리자 계정 자동 생성
# 4. Health check 확인
```

### Phase 3: Harbor 설치 (10분)

```bash
# 1. Harbor offline installer 다운로드
# 2. harbor.yml 생성 (HTTP 모드, 개발환경)
# 3. install.sh 실행
# 4. 프로젝트 생성 (public-saas)
# 5. k3s registries.yaml 설정
```

### Phase 4: Flux v2 설치 (5분)

```bash
# 1. flux CLI 설치
# 2. flux install (k3s 클러스터)
# 3. Gitea 연동 부트스트랩 (선택적: Gitea 저장소 필요)
```

### Phase 5: 모니터링 스택 (5분)

```bash
# 1. kube-prometheus-stack Helm chart 배포
# 2. Grafana NodePort 설정
# 3. 기존 대시보드 JSON import
```

---

## 3. 기존 스크립트 수정 사항

| 스크립트 | 수정 내용 |
|---------|----------|
| setup-gitea-wsl2.sh | 포트 3001 기본값 변경, 포트 충돌 감지 강화 |
| setup-harbor-wsl2.sh | Harbor offline installer 자동 다운로드 로직 검증 |
| setup-wsl2-all.sh | Flux 설치 단계 추가, 모니터링 배포 단계 추가 |

---

## 4. Design Anchor

| 항목 | 참조 |
|------|------|
| Plan | docs/01-plan/mtus/MTU-N21-wsl-devops-setup.plan.md |
| CSAP 매핑 | D-09(시크릿), D-10(네트워크 격리), D-11(가상화), D-12(개발보안) |
| 기존 MTU | MTU-I1(k3s), MTU-I2(Gitea), MTU-I3(Harbor/Flux) 설계 참조 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
