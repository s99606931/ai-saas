# 현장 적용 체크리스트

> **문서 ID**: ECO-DEPLOYMENT-CHECKLIST
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ECO4.1, FR-ECO4.2 | **Design Ref**: MTU-ECO4 Design 2.2

---

## Phase A: 사전 준비 (10항목)

| # | 항목 | 기준 | 확인 |
|---|------|------|------|
| A01 | 서버 사양 확인 | CPU 4코어+, RAM 16GB+, SSD 100GB+ | [ ] |
| A02 | 네트워크 확인 | 인터넷 접속 가능, 내부망 분리 정책 확인 | [ ] |
| A03 | OS 확인 | Ubuntu 22.04 LTS 또는 RHEL 8+ 또는 WSL2 | [ ] |
| A04 | Docker 설치 | Docker 24.0+ 설치 및 동작 확인 | [ ] |
| A05 | Node.js 설치 | Node.js 20 LTS 설치 확인 | [ ] |
| A06 | pnpm 설치 | pnpm 9.x 설치 확인 (`npm install -g pnpm`) | [ ] |
| A07 | Git 설치 | Git 2.40+ 설치 확인 | [ ] |
| A08 | PostgreSQL 접근 | PostgreSQL 16 접근 가능 (Docker 또는 외부) | [ ] |
| A09 | Redis 접근 | Redis 7 접근 가능 (Docker 또는 외부) | [ ] |
| A10 | DNS/SSL 준비 | 도메인 + SSL 인증서 (운영 환경) | [ ] |

### 환경별 설정 (FR-ECO4.2)

**WSL2 (Windows)**:
```bash
# WSL2 메모리 제한 설정 (권장)
# %UserProfile%\.wslconfig
[wsl2]
memory=8GB
swap=4GB
processors=4
```

**Linux (Ubuntu)**:
```bash
# Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

**Docker Desktop**:
- Settings -> Resources -> Memory: 8GB 이상
- Settings -> Resources -> CPUs: 4개 이상

---

## Phase B: 포크 및 설정 (8항목)

| # | 항목 | 명령/작업 | 확인 |
|---|------|---------|------|
| B01 | 저장소 클론 | `git clone {url} my-saas && cd my-saas` | [ ] |
| B02 | .env 파일 생성 | `cp docs/env.example .env` 후 편집 | [ ] |
| B03 | JWT 키 쌍 생성 | `openssl genrsa -out private.pem 2048` | [ ] |
| B04 | 암호화 키 생성 | `openssl rand -hex 32` | [ ] |
| B05 | DB 마이그레이션 | `pnpm prisma migrate deploy` | [ ] |
| B06 | 시드 데이터 | `pnpm prisma db seed` (기관 정보 수정 후) | [ ] |
| B07 | 의존성 설치 | `pnpm install` | [ ] |
| B08 | 환경별 설정 | WSL2: 포트 포워딩 / Linux: 방화벽 / Docker: 볼륨 | [ ] |

---

## Phase C: 검증 (7항목)

| # | 항목 | 검증 방법 | 확인 |
|---|------|---------|------|
| C01 | 서비스 기동 | `docker compose up -d` 후 19 컨테이너 확인 | [ ] |
| C02 | 포털 접속 | `http://localhost:4000` 로그인 화면 표시 | [ ] |
| C03 | 로그인 확인 | 데모 계정으로 로그인 성공 | [ ] |
| C04 | API 헬스체크 | `curl http://localhost:3001/health` -> `{"status":"ok"}` | [ ] |
| C05 | DB 연동 확인 | 대시보드에 데이터 표시 | [ ] |
| C06 | E2E 테스트 | `pnpm playwright test` (선택) | [ ] |
| C07 | 보안 스캔 | `bash scripts/security-audit.sh` (선택) | [ ] |

---

## Phase D: 커스터마이징 (5항목)

| # | 항목 | 작업 내용 | 확인 |
|---|------|---------|------|
| D01 | 브랜딩 변경 | 로고, 기관명, 색상 테마 변경 | [ ] |
| D02 | 테넌트 설정 | 기관별 테넌트 생성 + 관리자 계정 설정 | [ ] |
| D03 | 메뉴 구조 설정 | 기관 업무에 맞는 메뉴/권한 구조 | [ ] |
| D04 | 플러그인 추가 | 전자결재/공공데이터 등 업무 플러그인 | [ ] |
| D05 | CI/CD 설정 | Gitea Actions 러너 + 파이프라인 설정 | [ ] |

---

## Phase E: 운영 (5항목)

| # | 항목 | 작업 내용 | 확인 |
|---|------|---------|------|
| E01 | 백업 정책 | PostgreSQL 일일 백업 + S3(MinIO) 파일 백업 | [ ] |
| E02 | 모니터링 | 서비스 헬스체크 + 디스크/메모리 알림 | [ ] |
| E03 | 로그 보존 | 감사 로그 1년 이상 보존 (CSAP D-06) | [ ] |
| E04 | 보안 패치 | 월간 의존성 업데이트 + 분기 취약점 점검 | [ ] |
| E05 | 업스트림 동기화 | 분기별 업스트림 변경사항 머지 | [ ] |

---

## 총 35항목 요약

| Phase | 항목 수 | 예상 소요 |
|-------|--------|---------|
| A: 사전 준비 | 10 | 1일 |
| B: 포크 및 설정 | 8 | 1~2일 |
| C: 검증 | 7 | 0.5일 |
| D: 커스터마이징 | 5 | 3~5일 |
| E: 운영 | 5 | 1일 (초기 설정) |
| **합계** | **35** | **6~10일** |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
