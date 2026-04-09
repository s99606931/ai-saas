# 트러블슈팅 및 FAQ

> **문서 ID**: ECO-TROUBLESHOOTING-FAQ
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ECO4.3, FR-ECO4.4, FR-ECO4.5 | **Design Ref**: MTU-ECO4 Design 2.3

---

## 1. 트러블슈팅 (빈발 오류 Top 10)

### TS01: Docker Compose 기동 실패 (포트 충돌)

**증상**: `Bind for 0.0.0.0:5432 failed: port is already allocated`

**원인**: 호스트에 이미 PostgreSQL 등이 실행 중

**해결**:
```bash
# 사용 중인 포트 확인
lsof -i :5432
# 기존 서비스 중지 또는 docker-compose.yml에서 포트 변경
# ports: "5433:5432"
```

### TS02: PostgreSQL 연결 거부

**증상**: `FATAL: password authentication failed for user "postgres"`

**원인**: .env의 DATABASE_URL 비밀번호 불일치

**해결**:
```bash
# 1. .env 파일의 DATABASE_URL 확인
# 2. Docker 컨테이너 재생성 (데이터 볼륨 초기화)
docker compose down -v
docker compose up -d
```

### TS03: pnpm install 의존성 오류

**증상**: `ERR_PNPM_PEER_DEP_ISSUES`

**원인**: pnpm strict 모드에서 peer dependency 충돌

**해결**:
```bash
# .npmrc에 추가
echo "strict-peer-dependencies=false" >> .npmrc
pnpm install
```

### TS04: Prisma 마이그레이션 실패

**증상**: `P3009: migrate found failed migrations`

**원인**: 이전 마이그레이션 실패 기록 잔존

**해결**:
```bash
# 마이그레이션 상태 확인
pnpm prisma migrate status
# 실패 마이그레이션 해결 후 재실행
pnpm prisma migrate resolve --applied {migration_name}
pnpm prisma migrate deploy
```

### TS05: JWT 토큰 검증 실패

**증상**: `JsonWebTokenError: invalid signature`

**원인**: private.pem / public.pem 키 쌍 불일치

**해결**:
```bash
# 키 쌍 재생성
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
# .env에 키 경로 또는 내용 업데이트
```

### TS06: Redis 연결 타임아웃

**증상**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**원인**: Redis 컨테이너 미기동 또는 REDIS_URL 설정 오류

**해결**:
```bash
# Redis 컨테이너 상태 확인
docker compose ps redis
# 재시작
docker compose restart redis
# .env의 REDIS_URL 확인
```

### TS07: Next.js 빌드 오류 (환경 변수 누락)

**증상**: `Error: Missing required env variable NEXT_PUBLIC_*`

**원인**: 빌드 시점에 필요한 NEXT_PUBLIC_ 환경 변수 미설정

**해결**:
```bash
# .env에 NEXT_PUBLIC_ 접두사 변수 추가
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME="공공 SaaS 포털"
```

### TS08: WSL2 메모리 부족

**증상**: Docker 컨테이너가 갑자기 종료되거나 OOM 발생

**원인**: WSL2 기본 메모리 제한 (물리 메모리의 50%)

**해결**:
```
# %UserProfile%\.wslconfig 생성/편집
[wsl2]
memory=8GB
swap=4GB

# WSL 재시작
wsl --shutdown
```

### TS09: SSL 인증서 오류 (자체 서명)

**증상**: `ERR_CERT_AUTHORITY_INVALID` (브라우저)

**원인**: 개발 환경에서 자체 서명 인증서 사용

**해결**:
```bash
# 개발 환경: HTTPS 비활성화 (HTTP 사용)
# 운영 환경: Let's Encrypt 또는 기관 인증서 적용
```

### TS10: 파일 권한 오류 (Linux)

**증상**: `EACCES: permission denied`

**원인**: Docker 볼륨 마운트 시 파일 권한 불일치

**해결**:
```bash
# 데이터 디렉토리 권한 설정
sudo chown -R 1000:1000 ./data
# 또는 Docker Compose에서 user 지정
```

---

## 2. FAQ (자주 묻는 질문)

### 일반

**Q01: 최소 서버 사양은?**
- 개발/테스트: CPU 2코어, RAM 8GB, SSD 50GB
- 스테이징: CPU 4코어, RAM 16GB, SSD 100GB
- 프로덕션: CPU 8코어+, RAM 32GB+, SSD 200GB+

**Q02: Windows에서 실행 가능한가?**
- WSL2 환경에서 실행 가능합니다. Docker Desktop + WSL2 조합을 권장합니다.
- 네이티브 Windows에서는 지원하지 않습니다.

**Q03: 외부 DB(기관 기존 DB) 연결은 가능한가?**
- PostgreSQL 16 호환이면 가능합니다. `.env`의 `DATABASE_URL`을 외부 DB로 설정하세요.
- 기존 Oracle/MySQL DB는 직접 연결 불가. 데이터 마이그레이션이 필요합니다.

**Q04: 멀티테넌시 없이 단일 기관용으로 사용 가능한가?**
- 가능합니다. 테넌트를 1개만 생성하면 단일 기관 모드로 동작합니다.

**Q05: CSAP 인증 없이 사용 가능한가?**
- 프레임워크 자체는 인증 없이 사용 가능합니다.
- 공공기관에 클라우드 서비스를 제공하려면 CSAP 인증이 필요합니다.

### 기술

**Q06: Node.js 버전을 변경할 수 있나?**
- Node.js 20 LTS를 권장합니다. 18 LTS도 호환되나 테스트되지 않았습니다.

**Q07: pnpm 대신 npm이나 yarn을 사용할 수 있나?**
- pnpm 전용 워크스페이스 설정(pnpm-workspace.yaml)을 사용합니다. npm/yarn은 지원하지 않습니다.

**Q08: AI/LLM 연동 없이 사용 가능한가?**
- ai-service를 비활성화하면 됩니다. docker-compose.yml에서 해당 서비스를 주석 처리하세요.

**Q09: k3s 대신 다른 Kubernetes를 사용할 수 있나?**
- 가능합니다. Helm 차트나 kustomize 매니페스트를 제공합니다. 단, k3s에서만 테스트되었습니다.

**Q10: 데이터베이스 백업은 어떻게 하나?**
```bash
# PostgreSQL 백업
docker exec postgres pg_dump -U postgres saas_db > backup_$(date +%Y%m%d).sql
# 복원
docker exec -i postgres psql -U postgres saas_db < backup_20260406.sql
```

### 보안

**Q11: 비밀번호 정책을 변경할 수 있나?**
- `platform/services/auth-service/src/lib/password-policy.ts`에서 변경 가능합니다.

**Q12: MFA(다중 인증)를 지원하나?**
- TOTP 기반 MFA를 지원합니다. 관리자 포털에서 활성화할 수 있습니다.

**Q13: 감사 로그는 어디에 저장되나?**
- `.claude/audit.jsonl` (append-only). 프로덕션에서는 audit-service가 별도 DB에 저장합니다.

**Q14: 시크릿 관리는 어떻게 하나?**
- `.env` 파일로 관리합니다. 프로덕션에서는 Kubernetes Secret 또는 Vault 사용을 권장합니다.
- `.env` 파일은 절대 Git에 커밋하지 마세요.

### 인증

**Q15: CSAP 인증에 얼마나 걸리나?**
- 프레임워크 활용 시 증적 준비 약 2개월, 심사 신청~인증 발급 약 4개월. 총 6개월 예상.

**Q16: ISMS-P는 CSAP 후에 해야 하나?**
- CSAP 선행 시 45% 증적 재활용 가능하므로 순차 진행을 권장합니다.

**Q17: 인증 비용은 얼마나 드나?**
- CSAP: 2,000~5,000만원 (규모별), ISMS-P: 2,000~8,000만원 (규모별)

**Q18: 포크 기관도 별도 인증이 필요한가?**
- 네, 각 기관이 독립적으로 인증을 취득해야 합니다. 프레임워크 증적은 재활용 가능합니다.

### 운영

**Q19: 업스트림 변경을 어떻게 반영하나?**
```bash
git remote add upstream {원본 저장소 URL}
git fetch upstream
git merge upstream/main  # 충돌 해결 후 커밋
```

**Q20: 프레임워크 버전 업그레이드 시 주의사항은?**
- CHANGELOG.md에서 Breaking Changes 확인
- DB 마이그레이션 스크립트 실행 필수
- 커스터마이징 영역과 충돌 여부 확인

---

## 3. 감리 대응 가이드 (포크 기관용)

### 3.1 감리 대상 산출물

| 산출물 코드 | 산출물명 | 프레임워크 제공 | 기관 작성 필요 |
|-----------|---------|-------------|-------------|
| T01 | 사업계획서 | 템플릿 제공 | 기관별 사업 내용 작성 |
| T02 | 요구사항 정의서 | FR ID 체계 + 예시 | 기관별 요구사항 추가 |
| T03 | 설계서 | 아키텍처 + 설계 문서 | 커스터마이징 설계 추가 |
| T04 | 시험 결과서 | E2E 테스트 프레임워크 | 기관별 테스트 케이스 추가 |
| T05 | 사용자 매뉴얼 | 포털 사용법 기본 | 기관별 업무 매뉴얼 추가 |
| T06 | 운영자 매뉴얼 | 운영 가이드 제공 | 기관 인프라 운영 추가 |
| T07 | 보안 점검 결과 | 취약점 점검 체계 | 기관별 점검 결과 작성 |

### 3.2 감리 기준 <-> 프레임워크 산출물 매핑

| 감리 기준 조항 | 프레임워크 대응 |
|-------------|-------------|
| 요구사항 추적성 | FR ID 체계 + 추적성 매트릭스 |
| 설계 완전성 | Design 문서 3옵션 분석 + Session Guide |
| 코드 품질 | ESLint + Reviewer 에이전트 |
| 테스트 커버리지 | Playwright E2E + 단위 테스트 |
| 보안 점검 | OWASP Top 10 + Trivy + npm audit |
| 형상 관리 | Gitea + Conventional Commits |

### 3.3 감리 시연 준비

1. 포털 로그인 -> 대시보드 데이터 확인
2. RBAC 시연 (역할별 접근 통제)
3. 감사 로그 조회 시연
4. E2E 테스트 실행 결과 제시
5. 보안 스캔 결과 제시

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 — TS 10건 + FAQ 20건 + 감리 가이드 | PM Agent |
