# 첫 주 학습 계획 (Day 1~5)

> **문서 ID**: ONBOARD-01-03
> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: Implementer (Sonnet)
> **학습 대상**: 개발 환경 설정을 완료한 신규 팀원
> **예상 소요 시간**: 첫 주 전체 (5일)
> **선행 문서**: `02-environment-setup.md` (환경 설정 완료 필수)

---

## 목차

1. [첫 주 전체 계획 개요](#1-첫-주-전체-계획-개요)
2. [Day 1: 환경 확인 + 프로젝트 클론 + 첫 빌드](#2-day-1-환경-확인--프로젝트-클론--첫-빌드)
3. [Day 2: auth-service 실행해보기](#3-day-2-auth-service-실행해보기)
4. [Day 3: Claude Code로 첫 기능 구현](#4-day-3-claude-code로-첫-기능-구현)
5. [Day 4: 첫 PR 제출](#5-day-4-첫-pr-제출)
6. [Day 5: Q-Gate 통과 경험](#6-day-5-q-gate-통과-경험)
7. [Week 1 완료 체크리스트](#7-week-1-완료-체크리스트)

---

## 1. 첫 주 전체 계획 개요

### Gantt 차트

```mermaid
gantt
    title 첫 주 학습 계획 (Day 1~5)
    dateFormat  YYYY-MM-DD
    axisFormat  Day %d

    section Day 1 (월)
    환경 최종 확인               :d1a, 2026-04-13, 2h
    프로젝트 구조 탐색           :d1b, after d1a, 2h
    첫 빌드 실행                 :d1c, after d1b, 1h
    00-overview.md 정독          :d1d, after d1c, 3h

    section Day 2 (화)
    auth-service 코드 읽기       :d2a, 2026-04-14, 2h
    로컬에서 auth-service 실행   :d2b, after d2a, 2h
    API 직접 호출 실습           :d2c, after d2b, 2h
    로그 및 감사 흔적 확인       :d2d, after d2c, 2h

    section Day 3 (수)
    Plan + Design 문서 읽기      :d3a, 2026-04-15, 2h
    Claude Code 첫 실행          :d3b, after d3a, 1h
    간단한 기능 구현 실습        :d3c, after d3b, 4h
    코드 리뷰 셀프 체크          :d3d, after d3c, 1h

    section Day 4 (목)
    브랜치 생성                  :d4a, 2026-04-16, 1h
    변경사항 정리 및 커밋        :d4b, after d4a, 2h
    PR 제출 및 설명 작성         :d4c, after d4b, 2h
    Q-Gate 7단계 공부            :d4d, after d4c, 3h

    section Day 5 (금)
    CI/CD 파이프라인 관찰        :d5a, 2026-04-17, 2h
    리뷰어 피드백 반영           :d5b, after d5a, 2h
    Q-Gate 통과 확인             :d5c, after d5b, 2h
    Week 1 회고                  :d5d, after d5c, 2h
```

### 하루 목표 요약

| 날짜 | 목표 | 완료 기준 |
|------|------|---------|
| Day 1 | 환경 확인 + 첫 빌드 성공 | `pnpm build` 오류 없이 완료 |
| Day 2 | auth-service 이해 + API 직접 호출 | 로그인 API 응답 200 확인 |
| Day 3 | Claude Code로 기능 구현 | 간단한 기능 구현 + 테스트 통과 |
| Day 4 | 첫 PR 제출 | PR 링크 생성 완료 |
| Day 5 | Q-Gate 통과 경험 | CI/CD 초록불 확인 |

---

## 2. Day 1: 환경 확인 + 프로젝트 클론 + 첫 빌드

### 목표

오늘의 목표는 딱 하나입니다. 로컬 환경에서 프로젝트가 빌드되는 것을 확인합니다.

### 2.1 환경 최종 확인 (09:00~11:00)

`02-environment-setup.md` 를 참고하여 모든 도구가 정상 설치됐는지 확인합니다.

```bash
# 검증 명령어 한 번에 실행
node --version && pnpm --version && docker version --format '{{.Client.Version}}' && kubectl get nodes && helm version --short && flux --version
```

기대 출력:

```
v22.x.x
9.15.0
26.x.x
NAME        STATUS   ROLES   AGE   VERSION
...         Ready    ...
v3.14.x+xxx
flux version 2.x.x
```

### 2.2 프로젝트 클론 (11:00~12:00)

> 이미 프로젝트가 `/data/ai-saas`에 있다면 이 단계를 건너뜁니다.

```bash
# 프로젝트 저장소 클론 (팀장에게 저장소 URL 확인)
git clone https://gitea.internal.example.go.kr/saas/ai-saas.git /data/ai-saas

# 프로젝트 디렉토리로 이동
cd /data/ai-saas

# 현재 브랜치 확인
git branch
# * main 또는 stg 출력 확인

# 최신 변경사항 가져오기
git pull origin main
```

### 2.3 첫 빌드 실행 (13:00~14:00)

```bash
# 프로젝트 루트에서 실행
cd /data/ai-saas

# 의존성 설치 (첫 실행 시 수분 소요될 수 있음)
pnpm install
# 기대 출력:
# Packages: +1200
# Progress: resolved 1200, reused 1100, downloaded 100, added 200, done

# 전체 빌드
pnpm build
# 기대 출력:
# Tasks: 20 successful, 0 failed
# Cached: 0, Time: xxxms
```

빌드 실패 시:

```bash
# 어떤 서비스가 실패했는지 확인
pnpm build 2>&1 | grep -E "error|failed|Error"

# 특정 서비스만 빌드하여 문제 격리
pnpm --filter @public-saas/auth-service build
```

### 2.4 프로젝트 구조 탐색 (14:00~17:00)

`00-overview.md`를 읽으면서 실제 디렉토리 구조와 비교합니다.

```bash
# 서비스 목록 확인
ls /data/ai-saas/platform/services/
# 출력: 17개 서비스 디렉토리

# 공유 패키지 확인
ls /data/ai-saas/platform/packages/

# Plan 문서 확인
ls /data/ai-saas/docs/01-plan/mtus/

# 설계 문서 확인 (있는 경우)
ls /data/ai-saas/docs/02-design/features/ 2>/dev/null || echo "설계 문서 없음"
```

서비스 하나를 열어 코드 구조를 파악합니다.

```bash
# auth-service 파일 구조 확인
ls /data/ai-saas/platform/services/auth-service/src/
# 출력: handlers/ lib/ middleware/ routes.ts schemas/ index.ts

# 라우트 파일 열기
code /data/ai-saas/platform/services/auth-service/src/routes.ts
```

### Day 1 완료 체크

- [ ] `pnpm build` 오류 없이 완료
- [ ] 17개 서비스 디렉토리 확인
- [ ] `00-overview.md` 절반 이상 읽기
- [ ] `auth-service/src/routes.ts` 파일 열어서 구조 확인

---

## 3. Day 2: auth-service 실행해보기

### 목표

auth-service를 로컬에서 실행하고 실제 API를 호출합니다. 인증이 어떻게 동작하는지 직접 확인합니다.

### 3.1 auth-service 코드 읽기 (09:00~11:00)

핵심 파일 세 개를 순서대로 읽습니다.

```bash
# 1. 진입점 — 서비스 설정과 플러그인 등록
code /data/ai-saas/platform/services/auth-service/src/index.ts

# 2. 라우트 — 어떤 API 엔드포인트가 있는가
code /data/ai-saas/platform/services/auth-service/src/routes.ts

# 3. 로그인 핸들러 — 로그인이 어떻게 처리되는가
code /data/ai-saas/platform/services/auth-service/src/handlers/login.handler.ts
```

login.handler.ts에서 주목할 부분:

```typescript
// 1단계: Zod로 입력 검증 (CSAP D-12 SQL 주입 방지)
const parseResult = loginSchema.safeParse(request.body);

// 4단계: 계정 잠금 확인 (CSAP D-08-06)
if (user.lockedUntil && user.lockedUntil > new Date()) { ... }

// 9단계: 감사 로그 (CSAP D-06 — 모든 로그인 시도 기록)
await logAuthEvent('LOGIN_SUCCESS', user.id, tenant.id, ip, userAgent);
```

이런 주석들은 각 코드가 어떤 CSAP 항목을 구현하는지 나타냅니다. 코드를 작성할 때 이런 주석을 반드시 추가해야 합니다.

### 3.2 로컬에서 auth-service 실행 (11:00~13:00)

auth-service를 실행하려면 PostgreSQL과 Redis가 필요합니다. Docker Compose로 간단히 실행할 수 있습니다.

```bash
# 로컬 개발용 데이터베이스 실행
cd /data/ai-saas

# docker-compose 파일 확인
ls docker-compose*.yml

# 개발용 PostgreSQL + Redis 실행
docker compose -f docker-compose.dev.yml up -d postgres redis
# 없다면 팀장에게 docker-compose.dev.yml 파일 요청

# PostgreSQL 접속 확인
docker exec -it saas-postgres psql -U postgres -c "SELECT version();"

# Redis 접속 확인
docker exec -it saas-redis redis-cli ping
# PONG 출력 확인
```

환경 변수 설정:

```bash
# auth-service 디렉토리로 이동
cd /data/ai-saas/platform/services/auth-service

# 환경 변수 파일 생성 (팀장에게 실제 값 확인)
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://postgres:password@localhost:5432/saas_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=local-dev-secret-do-not-use-in-production
JWT_REFRESH_SECRET=local-dev-refresh-secret
ENCRYPTION_KEY=local-dev-encryption-key-32chars!
NODE_ENV=development
LOG_LEVEL=debug
PORT=3001
EOF

# 중요: .env.local은 절대 git에 커밋하지 마십시오!
echo ".env.local" >> .gitignore
```

auth-service 실행:

```bash
# 데이터베이스 마이그레이션 실행
pnpm --filter @public-saas/auth-service db:migrate

# 개발 모드로 실행 (코드 변경 시 자동 재시작)
pnpm --filter @public-saas/auth-service dev

# 기대 출력:
# [info] auth-service 기동: http://0.0.0.0:3001
# [info] OpenAPI 문서: http://localhost:3001/docs
```

### 3.3 API 직접 호출 실습 (13:00~15:00)

auth-service가 실행 중인 상태에서 API를 직접 호출합니다.

```bash
# 헬스 체크
curl http://localhost:3001/health
# 기대 출력: {"status":"ok","service":"auth-service","timestamp":"..."}

# OpenAPI 문서 확인 (브라우저에서 열기)
# http://localhost:3001/docs

# 로그인 시도 (먼저 테스트 계정 생성 필요 — 팀장에게 seed 데이터 확인)
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test-tenant.go.kr",
    "password": "Test1234!",
    "tenantSlug": "test-tenant"
  }'

# 성공 시 기대 출력:
# {
#   "success": true,
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ...",
#     "expiresIn": 900
#   }
# }
```

VS Code Thunder Client (또는 curl)로 API를 호출하고 응답을 확인합니다.

```bash
# 발급된 토큰으로 JWT 검증 API 호출
ACCESS_TOKEN="eyJ..."  # 위에서 받은 토큰 입력

curl http://localhost:3001/auth/verify \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 성공 시 사용자 정보 반환
```

### 3.4 로그 및 감사 흔적 확인 (15:00~17:00)

auth-service 실행 중 터미널에서 로그를 확인합니다. CSAP D-06에 따라 모든 로그인 시도가 기록됩니다.

```bash
# auth-service 로그를 다른 터미널에서 확인
# (auth-service가 실행 중인 터미널과 별도로 열기)

# 감사 로그 파일 확인
tail -f /data/ai-saas/.claude/audit.jsonl

# 또는 서비스 로그에서 감사 이벤트 필터링
pnpm --filter @public-saas/auth-service dev 2>&1 | grep -i "audit\|login\|auth"
```

### Day 2 완료 체크

- [ ] auth-service 코드 3개 파일 읽기 완료
- [ ] auth-service 로컬 실행 성공
- [ ] 로그인 API 직접 호출 + 200 응답 확인
- [ ] JWT 검증 API 호출 성공
- [ ] 로그인 이벤트가 감사 로그에 기록됨 확인

---

## 4. Day 3: Claude Code로 첫 기능 구현

### 목표

Claude Code를 사용하여 간단한 기능을 구현합니다. 바이브코딩의 흐름을 경험합니다.

### 4.1 Plan + Design 문서 읽기 (09:00~11:00)

구현 전에 반드시 Plan 문서와 Design 문서를 읽어야 합니다. 이것이 이 프로젝트의 규칙입니다.

```bash
# 최근 완료된 MTU Plan 문서 하나 읽기
ls /data/ai-saas/docs/01-plan/mtus/ | head -5

# 예: SVC-AUTH 계열 문서 읽기
cat /data/ai-saas/docs/01-plan/mtus/SVC-AI-ADV-R2.plan.md | head -100
```

Plan 문서에서 주목할 섹션:

```markdown
## Context Anchor
- WHY: 왜 이 기능이 필요한가
- WHO: 누가 사용하는가
- RISK: 어떤 위험이 있는가
- SUCCESS: 무엇을 달성해야 하는가

## 요구사항
- FR-*.* : 기능 요구사항 (Feature Requirement) ID
- NFR-*  : 비기능 요구사항
```

### 4.2 Claude Code 첫 실행 (11:00~12:00)

```bash
# 프로젝트 루트에서 Claude Code 실행
cd /data/ai-saas
claude

# Claude Code가 CLAUDE.md를 자동으로 읽고 프로젝트 컨텍스트를 파악합니다
# 프롬프트(>) 가 나타나면 지시를 입력할 수 있습니다
```

Claude Code에 좋은 지시를 내리는 방법:

```
# 좋지 않은 지시 (맥락이 없음)
> 로그인 API 만들어줘

# 좋은 지시 (바이브코딩 방식 — WHY + WHO + CONSTRAINT 포함)
> auth-service의 비밀번호 변경 API를 확인하고 싶어.
> FR-AUTH.2 요구사항에 따라 구현되어 있는지 검토해줘.
> 특히 CSAP D-08-07 비밀번호 정책 (최소 8자, 대소문자, 숫자 혼합)이
> 올바르게 검증되는지 확인해줘.
```

### 4.3 간단한 기능 구현 실습 (12:00~16:00)

Day 3의 실습 과제는 `auth-service`에 **현재 사용자 세션 목록 조회 API**를 추가하는 것입니다.

> 이 기능은 이미 구현되어 있을 수 있습니다. 이미 있다면 다른 간단한 기능을 담당 팀장에게 요청하십시오.

Claude Code로 구현하는 과정:

```
> platform/services/auth-service/src/lib/session.ts 파일을 읽고,
> 현재 사용자의 활성 세션 목록을 조회하는 함수가 있는지 확인해줘.

(Claude Code가 파일을 읽고 분석)

> 세션 목록 조회 함수를 만들어야 한다면, 다음 요구사항을 충족해야 해:
> 1. 현재 로그인한 사용자의 userId를 기반으로 Redis에서 세션 키 목록 조회
> 2. CSAP D-08: JWT 토큰으로 사용자 인증 후 본인 세션만 조회 가능
> 3. CSAP D-06: 세션 조회 이벤트도 감사 로그에 기록
> 4. 응답에는 세션 ID, 생성 시각, IP 주소, 마지막 활동 시각 포함
> routes.ts에 GET /auth/sessions 엔드포인트 추가해줘.
```

구현 후 직접 테스트:

```bash
# auth-service가 실행 중인지 확인
curl http://localhost:3001/health

# 먼저 로그인하여 토큰 획득
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test-tenant.go.kr","password":"Test1234!","tenantSlug":"test-tenant"}' \
  | jq -r '.data.accessToken')

# 새 엔드포인트 호출
curl http://localhost:3001/auth/sessions \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### 4.4 코드 리뷰 셀프 체크 (16:00~17:00)

구현 후 스스로 다음 항목을 체크합니다.

```
CSAP D-12 입력 검증:
  [ ] 모든 사용자 입력에 Zod 스키마 검증을 적용했는가?
  [ ] SQL 주입 가능성이 있는 문자열 결합이 없는가?

CSAP D-08 접근 제어:
  [ ] JWT 토큰 검증을 먼저 하는가?
  [ ] 본인 데이터만 접근 가능한가? (다른 사용자 세션 조회 불가)

CSAP D-06 감사 로그:
  [ ] 중요 작업에 auditLog() 호출이 있는가?
  [ ] 에러 메시지에 민감 정보(비밀번호, 토큰 값)가 없는가?

코딩 스타일:
  [ ] 함수가 80줄 이하인가?
  [ ] 주석에 왜(Why)를 설명했는가?
  [ ] Design Ref 주석이 있는가?
```

### Day 3 완료 체크

- [ ] Plan 문서 1개 읽기 완료
- [ ] Claude Code 첫 실행 성공
- [ ] 간단한 기능 구현 완료
- [ ] 구현된 기능 직접 API 호출 테스트 성공
- [ ] CSAP 셀프 체크 완료

---

## 5. Day 4: 첫 PR 제출

### 목표

구현한 기능을 PR(Pull Request)로 제출합니다. 팀의 코드 리뷰 프로세스를 경험합니다.

### 5.1 브랜치 생성 (09:00~10:00)

```bash
# 최신 main 브랜치에서 시작
cd /data/ai-saas
git checkout main
git pull origin main

# 기능 브랜치 생성 (Conventional Commits 규칙에 따라)
# 형식: feat/{서비스명}/{기능명}
git checkout -b feat/auth-service/session-list-api

# 브랜치 확인
git branch
# * feat/auth-service/session-list-api
#   main
```

### 5.2 변경사항 정리 및 커밋 (10:00~12:00)

```bash
# 변경된 파일 확인
git status
# 기대 출력: 수정된 파일 목록

# 변경 내용 상세 확인
git diff

# 단계별로 파일 스테이징
git add platform/services/auth-service/src/handlers/session-list.handler.ts
git add platform/services/auth-service/src/routes.ts

# 절대 추가하면 안 되는 파일들
# .env.local, secrets.*, *.credential* 등은 절대 커밋 금지!

# 커밋 (Conventional Commits 형식 필수)
git commit -m "feat(auth): GET /auth/sessions 세션 목록 조회 API 추가

- CSAP D-08: JWT 인증 후 본인 세션만 조회 가능
- CSAP D-06: 세션 조회 이벤트 감사 로그 기록
- FR-AUTH.5: 세션 관리 기능 요구사항 구현

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

커밋 메시지 형식 규칙:

```
<타입>(<범위>): <제목>

<본문> (선택)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

타입 종류:
  feat    — 새 기능
  fix     — 버그 수정
  docs    — 문서 변경
  refactor — 리팩토링 (기능 변경 없음)
  test    — 테스트 추가/수정
  chore   — 빌드 설정, 도구 변경
```

### 5.3 PR 제출 (13:00~15:00)

```bash
# 원격 저장소에 브랜치 푸시
git push -u origin feat/auth-service/session-list-api

# Gitea에서 PR 생성 (팀장에게 Gitea URL 확인)
# https://gitea.internal.example.go.kr/saas/ai-saas/compare/main...feat/auth-service/session-list-api
```

PR 설명 작성 가이드:

```markdown
## 요약

auth-service에 현재 사용자의 활성 세션 목록 조회 API를 추가했습니다.

## 변경 사항

- `GET /auth/sessions` 엔드포인트 신규 추가
- `session-list.handler.ts` 핸들러 파일 생성
- `routes.ts` 라우트 등록

## CSAP 준수 항목

- D-08 (접근 통제): JWT 인증 필수, 본인 세션만 조회 가능
- D-06 (감사 로그): 세션 조회 이벤트 audit.jsonl에 기록

## FR 추적성

- FR-AUTH.5: 세션 관리 기능

## 테스트 방법

1. auth-service 실행: `pnpm --filter @public-saas/auth-service dev`
2. 로그인하여 토큰 획득
3. `curl http://localhost:3001/auth/sessions -H "Authorization: Bearer $TOKEN"` 실행
4. 세션 목록 응답 확인
```

### 5.4 Q-Gate 7단계 공부 (15:00~17:00)

PR을 제출했으니 이제 자동으로 실행될 Q-Gate를 공부합니다.

```bash
# Gitea Actions 워크플로우 파일 확인
ls /data/ai-saas/.gitea/workflows/

# Q-Gate 워크플로우 내용 확인
cat /data/ai-saas/.gitea/workflows/dora-gate.yml
```

Q-Gate 각 단계에서 무엇을 검사하는지 이해합니다.

```
G1 (요구사항 전수): 코드에 FR ID 주석이 있는가?
G2 (설계 완전성): Design 문서가 있고 구현과 일치하는가?
G3 (코드 품질): AgentShield 102개 규칙 통과, 린트 오류 없음?
G4 (테스트 커버리지): 80% 이상인가?
G5 (OWASP Top 10): 웹 취약점 없음?
G6 (CSAP 준수): D-06, D-08, D-12 항목 충족?
G7 (감사 추적): audit.jsonl에 기록이 있는가?
```

### Day 4 완료 체크

- [ ] feat/auth-service/session-list-api 브랜치 생성
- [ ] Conventional Commits 형식으로 커밋 완료
- [ ] 원격 저장소에 푸시 성공
- [ ] Gitea에서 PR 생성 완료 (URL 확인)
- [ ] PR 설명에 요약, CSAP 항목, FR 추적성 포함

---

## 6. Day 5: Q-Gate 통과 경험

### 목표

CI/CD 파이프라인이 실행되는 것을 관찰하고 Q-Gate를 통과합니다.

### 6.1 CI/CD 파이프라인 관찰 (09:00~11:00)

PR 제출 후 Gitea Actions가 자동으로 실행됩니다.

```bash
# Gitea에서 PR의 Checks 탭 확인
# https://gitea.internal.example.go.kr/saas/ai-saas/pulls/{PR번호}

# 로컬에서 린트 먼저 확인
cd /data/ai-saas
pnpm lint

# 타입 체크
pnpm typecheck

# 테스트 실행
pnpm test
```

### 6.2 린트 오류 수정 (11:00~13:00)

린트 오류가 있다면 수정합니다.

```bash
# 린트 오류 자동 수정 시도
pnpm lint --fix

# 수정 후 다시 확인
pnpm lint

# 오류 없으면 커밋 및 푸시
git add -A
git commit -m "fix(auth): 린트 오류 수정"
git push
```

일반적인 린트 오류 유형:

```typescript
// 오류: 사용되지 않는 변수
const unusedVariable = 'this is unused'  // eslint: no-unused-vars

// 수정: 제거하거나 사용
// const unusedVariable = 'this is unused'  // 제거

// 오류: any 타입 사용
function process(data: any) { ... }  // @typescript-eslint/no-explicit-any

// 수정: 구체적인 타입 지정
interface SessionData { sessionId: string; createdAt: Date }
function process(data: SessionData) { ... }
```

### 6.3 테스트 커버리지 확인 (13:00~15:00)

```bash
# 특정 서비스 테스트 실행
pnpm --filter @public-saas/auth-service test

# 커버리지 리포트 생성
pnpm --filter @public-saas/auth-service test:coverage

# 커버리지가 80% 미만이면 테스트 추가 필요
# 새로 추가한 handler 파일에 대한 테스트 작성
```

Claude Code로 테스트 작성 요청:

```
> platform/services/auth-service/src/handlers/session-list.handler.ts 를 읽고,
> 이 핸들러에 대한 단위 테스트를 tests/ 폴더에 작성해줘.
> 다음 케이스를 포함해야 해:
> 1. 인증 없는 요청 → 401 반환
> 2. 유효한 토큰으로 요청 → 세션 목록 반환
> 3. 세션이 없는 사용자 → 빈 배열 반환
```

### 6.4 Q-Gate 통과 확인 (15:00~17:00)

모든 체크가 통과하면 Gitea PR 페이지에서 초록불을 확인할 수 있습니다.

```
Checks:
  ✓ G1 요구사항 전수
  ✓ G2 설계 완전성
  ✓ G3 코드 품질 (AgentShield)
  ✓ G4 테스트 커버리지 (82%)
  ✓ G5 OWASP Top 10
  ✓ G6 CSAP 준수
  ✓ G7 감사 추적
```

이제 리뷰어가 코드를 리뷰하고 승인하면 머지됩니다.

### 6.5 Week 1 회고 (17:00~18:00)

첫 주를 돌아보며 다음 질문에 답해봅니다.

```
1. 이해한 것
   - 공공기관 SaaS 프레임워크의 목적은 무엇인가?
   - CSAP D-06, D-08, D-12가 코드에서 어떻게 구현되는가?
   - 감사 로그는 어디에 기록되는가?

2. 아직 모르는 것 (다음 주 공부 목록)
   - k3s 클러스터에 실제로 배포하는 방법은?
   - AI 서비스는 N2SF 데이터 등급을 어떻게 처리하는가?
   - Flux GitOps 동기화는 어떻게 동작하는가?

3. 도움이 필요한 것
   - 막히는 부분을 팀장이나 담당자에게 질문할 목록
```

### Day 5 완료 체크

- [ ] CI/CD 파이프라인 실행 관찰 완료
- [ ] 린트 오류 0개 확인
- [ ] 테스트 커버리지 80% 이상
- [ ] Q-Gate 7단계 모두 초록불 확인
- [ ] Week 1 회고 작성

---

## 7. Week 1 완료 체크리스트

첫 주가 완료되었습니다. 아래 모든 항목을 체크하면 2장 아키텍처로 이동합니다.

### 지식 이해

- [ ] 공공기관 SaaS 프레임워크의 목적을 3줄로 설명할 수 있다
- [ ] CSAP, N2SF, 행안부 감리의 차이를 설명할 수 있다
- [ ] Q-Gate 7단계를 순서대로 말할 수 있다
- [ ] MTU, PDCA가 무엇인지 설명할 수 있다

### 기술 실습

- [ ] `pnpm build`가 오류 없이 완료됨
- [ ] auth-service를 로컬에서 실행하고 API를 직접 호출함
- [ ] Claude Code를 사용하여 기능을 구현함
- [ ] Conventional Commits 형식으로 커밋을 작성함
- [ ] PR을 제출하고 Q-Gate를 통과함

### 다음 단계

Week 1을 완료했다면 아래 문서를 순서대로 학습합니다.

```
2장: 02-architecture/ — 시스템 아키텍처 심화 학습
3장: 03-vibecoding.md — Claude Code 바이브코딩 심화
4장: 04-infrastructure.md — k3s + Flux + GitOps 학습
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 | Implementer (Sonnet) |
