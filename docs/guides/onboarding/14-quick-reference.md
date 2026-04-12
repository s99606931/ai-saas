# 빠른 참조 카드 — 공공기관 SaaS 프레임워크

> **문서 ID**: ONBOARD-14
> **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: Implementer (Sonnet)
> **목적**: 팀원이 매일 참조하는 명령어·체크리스트·구조를 한 페이지에 압축
> **사용법**: 북마크하여 언제든 열어두십시오. 설명은 최소화하고 실용성에 집중합니다.

---

## 목차

1. [역할별 1주일 학습 플랜](#1-역할별-1주일-학습-플랜)
2. [필수 명령어 치트시트](#2-필수-명령어-치트시트)
3. [보안 체크리스트 (PR 제출 전)](#3-보안-체크리스트-pr-제출-전)
4. [디렉토리 구조 빠른 참조](#4-디렉토리-구조-빠른-참조)
5. [PDCA 빠른 참조](#5-pdca-빠른-참조)
6. [에러 코드 빠른 해결](#6-에러-코드-빠른-해결)
7. [연락처 에스컬레이션](#7-연락처-에스컬레이션)

---

## 1. 역할별 1주일 학습 플랜

> **공통 원칙**: 모든 역할은 Day 1 오전에 0장(프로젝트 개요)과 7장 2절(보안 규칙)을 반드시 먼저 읽습니다.

### 1.1 백엔드 개발자

| 날짜 | 오전 | 오후 | 저녁 (선택) |
|------|------|------|------------|
| **Day 1** | `00-overview.md` 읽기 + 개발 환경 구성 (`pnpm install`, `.env` 설정) | `07-security-compliance.md` 2절 코드 보안 규칙 숙지 | `02-code-management.md` 개요 정독 |
| **Day 2** | `03-development/01-local-setup.md` 로컬 서비스 기동 실습 | `03-development/02-service-development.md` Fastify 패턴 학습 | `03-development/03-testing-guide.md` 테스트 전략 파악 |
| **Day 3** | `03-development/05-prisma-guide.md` Prisma 쿼리 패턴 실습 | `01-document-management.md` PDCA 사이클 이해 + Plan 문서 작성 연습 | `02-architecture/packages/01-core-packages.md` (auth-sdk, rbac) |
| **Day 4** | `10-exercises/01-hello-service.md` 실습 완료 | `10-exercises/02-pdca-mini.md` 미니 PDCA 체험 | `03-development/04-advanced-patterns.md` 고급 패턴 탐독 |
| **Day 5** | `10-exercises/05-security-audit.md` 보안 취약점 찾기 | 첫 실제 PR 제출 (feat/onboarding 브랜치) | Q-Gate G1~G7 결과 리뷰 + 팀 시니어와 코드 리뷰 |

**핵심 목표**: Day 5까지 `pnpm test:coverage`에서 80% 이상, PR 1건 제출 완료.

---

### 1.2 인프라 엔지니어

| 날짜 | 오전 | 오후 | 저녁 (선택) |
|------|------|------|------------|
| **Day 1** | `00-overview.md` + 클러스터 접근 확인 (`kubectl get nodes`) | `07-security-compliance.md` 2절 + `04-infrastructure/01-overview.md` | `04-infrastructure/kubernetes/01-k3s-basics.md` |
| **Day 2** | `04-infrastructure/components/04-vault.md` Vault 시크릿 관리 실습 | `04-infrastructure/components/03-postgresql.md` CNPG 구성 이해 | `04-infrastructure/components/05-redis.md` Redis 운영 |
| **Day 3** | `04-infrastructure/kubernetes/02-helm-charts.md` Helm 차트 구조 분석 | `04-infrastructure/kubernetes/03-gitops-flux.md` Flux 동기화 이해 | `04-infrastructure/components/06-linkerd.md` mTLS 실습 |
| **Day 4** | `05-monitoring/` 관측가능성 스택 전체 파악 (Prometheus, Grafana) | `10-exercises/03-monitoring-lab.md` 대시보드 패널 생성 실습 | `10-exercises/04-k8s-debug.md` 장애 시뮬레이션 |
| **Day 5** | `06-cicd.md` + `.gitea/workflows/` 파이프라인 전체 분석 | 실제 HelmRelease 하나 수정 후 Flux 재동기화 실습 | 클러스터 전체 Pod 상태 점검 체크리스트 작성 |

**핵심 목표**: Day 5까지 `flux reconcile` 직접 수행, Grafana 패널 1개 직접 생성 완료.

---

### 1.3 풀스택 개발자

| 날짜 | 오전 | 오후 | 저녁 (선택) |
|------|------|------|------------|
| **Day 1** | `00-overview.md` + 환경 구성 (pnpm + k3s 접근) | `07-security-compliance.md` 2절 코드 보안 규칙 숙지 | `02-code-management.md` 모노레포 구조 파악 |
| **Day 2** | `03-development/01-local-setup.md` 백엔드 로컬 기동 | `02-architecture/services/17-portal-app.md` Next.js 포털 구조 이해 | `03-development/02-service-development.md` Fastify 패턴 |
| **Day 3** | `03-development/03-testing-guide.md` 프론트·백 테스트 전략 | `01-document-management.md` PDCA 사이클 + Plan 문서 작성 | `03-development/vibecoding/01-basics.md` Claude Code 기초 |
| **Day 4** | `10-exercises/01-hello-service.md` 백엔드 실습 | `10-exercises/02-pdca-mini.md` 풀스택 관점 PDCA 체험 | `06-cicd.md` CI/CD 파이프라인 파악 |
| **Day 5** | `10-exercises/05-security-audit.md` 보안 감사 실습 | 첫 PR 제출 (백엔드 핸들러 + 프론트 컴포넌트 포함) | Q-Gate 결과 리뷰 + 팀 시니어 코드 리뷰 |

**핵심 목표**: Day 5까지 API 핸들러와 프론트엔드 컴포넌트가 연결된 PR 1건 제출 완료.

---

### 1.4 PM / 기획자

| 날짜 | 오전 | 오후 | 저녁 (선택) |
|------|------|------|------------|
| **Day 1** | `00-overview.md` + `00-project-history.md` 프로젝트 배경 이해 | `07-security-compliance.md` 1절 CSAP/N2SF 개요 (구현 규칙 불필요) | `01-document-management.md` 전체 정독 |
| **Day 2** | `docs/01-plan/` 기존 MTU 문서 5개 읽기 (패턴 파악) | Plan 문서 초안 직접 작성 연습 (FR ID 체계 적용) | `12-glossary.md` 핵심 용어 30개 숙지 |
| **Day 3** | `06-cicd.md` 개요 (Q-Gate G1~G7이 무엇인지 파악) | `02-architecture/01-system-overview.md` C4 다이어그램으로 서비스 구조 파악 | `10-exercises/02-pdca-mini.md` PM 관점으로 문서 작성 실습 |
| **Day 4** | 기존 PDCA 완료 보고서 2~3개 분석 | 감리 추적성 매트릭스 읽기 + 직접 작성 연습 | `13-contributing.md` PR 프로세스 이해 |
| **Day 5** | 담당 기능의 Plan 문서 초안 작성 (팀장 검토용) | 팀 스프린트 플래닝 미팅 참여 + 첫 MTU 문서 제출 | 컴플라이언스팀과 CSAP 요건 협의 |

**핵심 목표**: Day 5까지 실제 기능의 Plan 문서(FR ID 포함) 1건 작성 및 팀장 승인 완료.

---

## 2. 필수 명령어 치트시트

### 2.1 개발 명령어

```bash
# ── 의존성 관리 ──────────────────────────────────────────
pnpm install                          # 전체 워크스페이스 의존성 설치
pnpm install --frozen-lockfile        # CI 전용 — lockfile 변경 없이 설치
pnpm add zod                          # 현재 패키지에 의존성 추가
pnpm add -D vitest                    # devDependency 추가
pnpm add -w turbo                     # 루트 워크스페이스에 추가

# ── 빌드 ────────────────────────────────────────────────
pnpm build                            # 전체 빌드 (Turbo 캐싱 적용)
pnpm --filter @public-saas/auth-service build    # 특정 서비스만 빌드
pnpm --filter ...@public-saas/auth-service build # 의존성 포함 빌드
pnpm clean                            # 빌드 아티팩트 초기화

# ── 개발 서버 ────────────────────────────────────────────
pnpm dev                              # 전체 개발 서버
pnpm --filter @public-saas/auth-service dev      # 특정 서비스만 기동

# ── 테스트 ──────────────────────────────────────────────
pnpm test                             # 전체 테스트 실행
pnpm test:coverage                    # 커버리지 포함 테스트 (80% 목표)
pnpm --filter @public-saas/auth-service test     # 특정 서비스 테스트만

# ── 코드 품질 ────────────────────────────────────────────
pnpm lint                             # ESLint 전체 검사
pnpm typecheck                        # TypeScript 타입 검사
pnpm audit                            # 보안 취약점 스캔
pnpm run audit:dead-code              # 미사용 코드 탐지

# ── Prisma ──────────────────────────────────────────────
pnpm prisma migrate dev               # 개발 환경 마이그레이션
pnpm prisma migrate deploy            # 운영 환경 마이그레이션 적용
pnpm prisma db seed                   # 시드 데이터 삽입
pnpm prisma studio                    # DB GUI 브라우저 열기
pnpm prisma generate                  # Prisma Client 재생성
```

---

### 2.2 Kubernetes 명령어

```bash
# ── Pod 상태 ────────────────────────────────────────────
kubectl get pods -n saas-platform                        # 파드 전체 상태
kubectl get pods -n saas-platform -w                     # 실시간 상태 감시
kubectl describe pod <pod-name> -n saas-platform         # 파드 상세 정보 (이벤트 포함)
kubectl get pods -n saas-platform --field-selector=status.phase=Running  # 실행 중인 파드만

# ── 로그 ────────────────────────────────────────────────
kubectl logs -f <pod-name> -n saas-platform              # 로그 실시간 스트리밍
kubectl logs <pod-name> -n saas-platform --previous      # 이전 컨테이너 로그 (크래시 직전)
kubectl logs -f <pod-name> -n saas-platform -c <container>  # 멀티컨테이너 파드 특정 컨테이너

# ── 서비스/배포 ──────────────────────────────────────────
kubectl get deploy -n saas-platform                      # Deployment 목록
kubectl rollout restart deploy/<name> -n saas-platform   # 배포 롤링 재시작
kubectl rollout status deploy/<name> -n saas-platform    # 롤아웃 진행 상태 확인
kubectl rollout undo deploy/<name> -n saas-platform      # 직전 버전으로 롤백

# ── 디버깅 ──────────────────────────────────────────────
kubectl exec -it <pod-name> -n saas-platform -- /bin/sh  # 파드 내부 접속
kubectl port-forward svc/auth-service 3001:3001 -n saas-platform  # 로컬 포트 포워딩
kubectl top pods -n saas-platform                        # CPU/메모리 사용량
kubectl get events -n saas-platform --sort-by=.lastTimestamp  # 최근 이벤트 정렬

# ── 컨피그맵 / 시크릿 ────────────────────────────────────
kubectl get configmap -n saas-platform                   # ConfigMap 목록
kubectl get secret -n saas-platform                      # Secret 목록 (값 비공개)
kubectl describe configmap <name> -n saas-platform       # ConfigMap 내용 확인
```

---

### 2.3 Flux GitOps 명령어

```bash
# ── 동기화 ──────────────────────────────────────────────
flux reconcile hr auth-service -n saas-platform          # HelmRelease 즉시 동기화
flux reconcile source git flux-system                    # Git 소스 강제 갱신
flux reconcile kustomization infra --with-source         # Kustomization + 소스 동기화

# ── 상태 확인 ────────────────────────────────────────────
flux get helmreleases -n saas-platform                   # HelmRelease 상태 목록
flux get kustomizations                                  # Kustomization 상태 전체
flux get sources git                                     # Git 소스 동기화 상태
flux logs --level=error                                  # Flux 에러 로그만 필터

# ── 일시 정지 / 재개 ─────────────────────────────────────
flux suspend hr auth-service -n saas-platform            # HelmRelease 일시 정지
flux resume hr auth-service -n saas-platform             # HelmRelease 재개
```

---

### 2.4 Linkerd 서비스 메시

```bash
linkerd viz stat deploy -n saas-platform                 # 서비스별 성공률/RPS/지연시간
linkerd viz tap deploy/auth-service -n saas-platform     # 실시간 트래픽 탭핑
linkerd check                                            # 전체 메시 상태 점검
linkerd viz dashboard                                    # 대시보드 브라우저 열기
```

---

### 2.5 보안 도구

```bash
# ── Semgrep (정적 분석) ──────────────────────────────────
semgrep --config=auto platform/services/auth-service/src/  # 자동 규칙으로 스캔
semgrep --config=p/owasp-top-ten .                         # OWASP Top10 규칙 스캔

# ── Trivy (이미지/코드 취약점) ────────────────────────────
trivy image ghcr.io/public-saas/auth-service:latest        # 컨테이너 이미지 스캔
trivy fs . --severity HIGH,CRITICAL                        # 파일시스템 고위험 스캔만

# ── Vault (시크릿 조회) ───────────────────────────────────
vault kv get secret/saas-platform/auth-service             # 시크릿 조회
vault kv put secret/saas-platform/new-service KEY=value    # 시크릿 저장

# ── Git 보안 ────────────────────────────────────────────
git log --all --full-history -- '**/*.env'                 # .env 파일 커밋 이력 검색
pnpm audit --audit-level=high                             # 고위험 취약점만 확인
```

---

### 2.6 Claude Code

```bash
claude                                # 대화형 Claude Code 시작
claude "FR-2.1 구현해줘"               # 단일 태스크 비대화식 실행
claude --model claude-opus-4-6        # 감리·CSAP 분석 시 Opus 사용
/review                               # 현재 변경사항 코드 리뷰 요청
/compact                              # 컨텍스트 50% 도달 시 압축
```

---

## 3. 보안 체크리스트 (PR 제출 전)

> **중요**: 이 체크리스트를 통과하지 못한 PR은 Q-Gate G3/G5/G6에서 자동 차단됩니다.

### 3.1 필수 보안 항목

```
인증 및 권한
[ ] 모든 엔드포인트에 verifyToken() 호출이 있는가?
[ ] hasPermission() 또는 RBAC 검사가 있는가?
[ ] 인증 없이 직접 접근 가능한 경로가 없는가?

입력 검증
[ ] 모든 API 입력에 Zod 스키마 검증이 있는가?
[ ] SQL 직접 문자열 결합이 없는가? (매개변수화 쿼리 사용)
[ ] 사용자 입력이 HTML 응답에 그대로 반영되지 않는가? (XSS 방지)

감사 로그
[ ] 민감 작업(생성/수정/삭제/조회)에 auditLog() 호출이 있는가?
[ ] actor, action, target, timestamp, ip 필드가 모두 있는가?

비밀 관리
[ ] 하드코딩된 API 키, 비밀번호, 토큰이 없는가?
[ ] 모든 시크릿은 process.env 또는 Vault에서 읽는가?
[ ] .env 파일이 git에 커밋되지 않았는가?

AI API 관련 (AI 기능 포함 시만 해당)
[ ] 전송 데이터의 N2SF 등급을 확인했는가?
[ ] C/S 등급 데이터가 AI API로 전송되지 않는가?
[ ] PII(이름, 주민번호, 연락처)가 마스킹되었는가?

암호화
[ ] 민감 데이터가 AES-256으로 암호화되어 저장되는가?
[ ] 비밀번호가 bcrypt(rounds=12)로 해시되는가?
[ ] HTTP 직접 통신이 없는가? (TLS 1.3+ 사용)
```

### 3.2 코드 품질 항목

```
테스트
[ ] 테스트 커버리지가 80% 이상인가? (pnpm test:coverage 확인)
[ ] 새 함수에 단위 테스트가 있는가?
[ ] 에러 케이스 테스트가 있는가?

코드 스타일
[ ] 함수가 80줄 이하인가?
[ ] 파일이 800줄 이하인가?
[ ] 미사용 import, 변수, 함수가 없는가?
[ ] 주석 처리된 코드(commented-out code)가 없는가?

문서
[ ] Plan 문서의 FR ID가 커밋 메시지에 포함되어 있는가?
[ ] Conventional Commits 형식을 따르는가?
[ ] API 스펙이 변경된 경우 Design 문서가 업데이트되었는가?
```

---

## 4. 디렉토리 구조 빠른 참조

```
/data/ai-saas/
│
├── platform/                         # 핵심 플랫폼 코드
│   ├── services/                     # 마이크로서비스 (17개)
│   │   ├── api-gateway/              # 진입점 — 라우팅, 레이트리밋, 서킷브레이커
│   │   ├── auth-service/             # 인증 — JWT RS256, MFA TOTP, CSAP D-08
│   │   │   ├── src/
│   │   │   │   ├── handlers/         # 요청 핸들러 (route → handler)
│   │   │   │   ├── lib/              # 비즈니스 로직, 유틸
│   │   │   │   └── routes.ts         # Fastify 라우트 등록
│   │   │   ├── prisma/               # DB 스키마, 마이그레이션
│   │   │   └── package.json
│   │   ├── user-service/             # 사용자 관리, 프로필
│   │   ├── tenant-service/           # 멀티테넌시, 격리
│   │   ├── ai-service/               # AI 연동 — N2SF 등급 검사, PII 마스킹
│   │   ├── audit-service/            # 감사 로그 — SHA-256 체인, append-only
│   │   ├── compliance-service/       # CSAP 79항목 검사
│   │   ├── security-service/         # 위협 탐지
│   │   ├── security-monitor-service/ # 실시간 보안 모니터링
│   │   ├── notification-service/     # 이메일/SMS/Slack 알림
│   │   ├── file-service/             # 파일 — AES-256-GCM 암호화
│   │   ├── billing-service/          # 결제, 정산
│   │   ├── subscription-service/     # 구독 관리
│   │   ├── catalog-service/          # 서비스 카탈로그
│   │   ├── crm-service/              # 고객/연락처/계약
│   │   ├── menu-service/             # RBAC 기반 메뉴 필터링
│   │   └── saas-catalog-service/     # SaaS 카탈로그 확장
│   │
│   ├── packages/                     # 공유 패키지 (40+개)
│   │   ├── auth-sdk/                 # JWT 검증, 토큰 생성/갱신
│   │   ├── rbac/                     # 권한 체크 — hasPermission()
│   │   ├── audit-sdk/                # 감사 로그 — auditLog()
│   │   ├── crypto-util/              # AES-256 암호화/복호화
│   │   ├── rate-limit/               # Redis 기반 레이트리밋
│   │   ├── secret-manager/           # Vault 연동 시크릿 관리
│   │   ├── health/                   # 헬스체크 엔드포인트
│   │   ├── health-aggregator/        # 전체 서비스 상태 집계
│   │   ├── circuit-breaker/          # 서킷브레이커 패턴
│   │   ├── event-bus/                # 이벤트 버스 (emit/on)
│   │   ├── mesh-ready/               # Linkerd mTLS 준비 유틸
│   │   ├── structured-logger/        # 구조화 로그 (JSON)
│   │   ├── metrics-collector/        # Prometheus 메트릭
│   │   ├── trace-context/            # 분산 추적 (W3C TraceContext)
│   │   ├── pagination/               # 커서/오프셋 페이지네이션
│   │   ├── cache/                    # Redis 캐시 추상화
│   │   ├── saga/                     # Saga 패턴 (분산 트랜잭션)
│   │   └── types/                    # 공통 TypeScript 타입
│   │
│   └── apps/
│       └── portal/                   # Next.js 15 App Router 포털
│           ├── src/
│           │   ├── app/              # Next.js App Router (페이지)
│           │   ├── components/       # UI 컴포넌트
│           │   └── lib/              # 클라이언트 유틸
│           └── package.json
│
├── packages/                         # 루트 레벨 전문 패키지
│   ├── feature-flag-sdk/             # 피처 플래그 SDK
│   ├── slo-escalation/               # SLO 위반 에스컬레이션
│   ├── dora-exporter/                # DORA 4 Keys 메트릭 수집
│   ├── ml-pipeline/                  # ML 파이프라인 (모델 CI)
│   ├── audit-collector/              # 감사 이벤트 수집기
│   └── tech-debt-scanner/            # 기술 부채 스캐너
│
├── infra/                            # 인프라 설정
│   ├── k3s/                          # k3s 클러스터 설정
│   └── helm/                         # Helm 차트
│
├── docs/                             # 문서
│   ├── 01-plan/                      # Plan 문서 (MTU)
│   ├── 02-design/                    # Design 문서
│   ├── 03-impl/                      # 구현 보고서
│   └── guides/onboarding/            # 이 가이드북
│
├── .gitea/workflows/                 # CI/CD 파이프라인
│   ├── ci.yml                        # 기본 CI (빌드/테스트/린트)
│   ├── q-gate.yml                    # Q-Gate G1~G7 품질 게이트
│   ├── dora-gate.yml                 # DORA 메트릭 게이트
│   └── csap-evidence.yml             # CSAP 증적 수집
│
├── CLAUDE.md                         # 프로젝트 하네스 (필독)
├── pnpm-workspace.yaml               # 워크스페이스 정의
├── turbo.json                        # Turbo 빌드 설정
└── package.json                      # 루트 패키지
```

**자주 찾는 파일 빠른 위치**

| 찾는 것 | 위치 |
|---------|------|
| JWT 검증 로직 | `platform/packages/auth-sdk/src/` |
| RBAC 권한 검사 | `platform/packages/rbac/src/` |
| 감사 로그 함수 | `platform/packages/audit-sdk/src/` |
| AES-256 암호화 | `platform/packages/crypto-util/src/` |
| Redis 캐시 패턴 | `platform/packages/cache/src/` |
| 시크릿 관리 | `platform/packages/secret-manager/src/` |
| auth-service 라우트 | `platform/services/auth-service/src/routes.ts` |
| CI 파이프라인 | `.gitea/workflows/ci.yml` |
| Helm 차트 | `infra/helm/` 또는 `helm/` |
| Plan 문서 | `docs/01-plan/mtus/` |

---

## 5. PDCA 빠른 참조

### 5.1 FR ID 형식

| 유형 | 형식 | 예시 |
|------|------|------|
| 기능 요구사항 | `FR-{모듈}.{번호}` | `FR-2.1`, `FR-5.3` |
| 비기능 요구사항 | `NFR-{번호}` | `NFR-1`, `NFR-4` |
| 인프라 요구사항 | `INFR-{번호}` | `INFR-1`, `INFR-3` |
| AI 연동 요구사항 | `AI-REQ-{번호}` | `AI-REQ-1`, `AI-REQ-2` |
| CC 하네스 요구사항 | `CC-REQ-{번호}` | `CC-REQ-1` |

### 5.2 문서 체계 (4단계)

```
Plan 문서       → docs/01-plan/mtus/MTU-{ID}.plan.md
Design 문서     → docs/02-design/{서비스}/SVC-{ID}.design.md
구현 보고서     → docs/03-impl/{서비스}/IMPL-{ID}.md
PDCA 완료 보고서 → .bkit/state/ (자동 관리)
```

### 5.3 Q-Gate G1~G7 요약

| 게이트 | 담당 에이전트 | 통과 기준 |
|--------|-------------|---------|
| **G1** | Auditor | 모든 구현 항목에 FR ID 연결 — 추적성 확보 |
| **G2** | Auditor | Plan + Design 문서 완비 — 구현 착수 조건 |
| **G3** | Reviewer | AgentShield 102규칙 통과 + 코드 품질 기준 충족 |
| **G4** | Tester | 테스트 커버리지 80% 이상 달성 |
| **G5** | Reviewer | OWASP Top10 전 항목 통과 (취약점 없음) |
| **G6** | Auditor | CSAP 해당 Phase 100% 통제항목 충족 |
| **G7** | Auditor | `audit.jsonl` 감사 추적 완비 — 누락 없음 |

### 5.4 커밋 메시지 형식

```
feat(auth): FR-2.1 JWT RS256 발급 로직 구현
fix(rbac): FR-3.2 ADMIN 권한 누락 오류 수정
docs(audit): G7 감사 로그 추적성 보고서 추가
refactor(cache): 미사용 함수 제거 (dead code)
test(user): FR-4.1 단위 테스트 커버리지 85% 달성
```

---

## 6. 에러 코드 빠른 해결

> **우선 시도**: `kubectl describe pod <pod> -n saas-platform`으로 이벤트 확인 후 아래 해결책 적용

| # | 에러 / 증상 | 주요 원인 | 빠른 해결 |
|---|------------|---------|---------|
| 1 | `pnpm install` 후 타입 에러 | Prisma Client 미생성 | `pnpm prisma generate` |
| 2 | `Cannot find module '@public-saas/auth-sdk'` | 내부 패키지 빌드 안 됨 | `pnpm --filter @public-saas/auth-sdk build` |
| 3 | Pod `CrashLoopBackOff` | 환경 변수 누락 또는 DB 연결 실패 | `kubectl logs <pod> --previous -n saas-platform` |
| 4 | `OOMKilled` | 메모리 한도 초과 | `kubectl describe pod <pod> -n saas-platform` → resources 확인 후 limit 상향 |
| 5 | `ImagePullBackOff` | 레지스트리 인증 실패 또는 이미지 미존재 | `kubectl describe pod <pod> -n saas-platform` → 이미지 태그 확인 |
| 6 | `flux reconcile` 실패 | HelmRelease 값 오류 또는 차트 버전 불일치 | `flux logs --level=error` → 원인 파악 후 values.yaml 수정 |
| 7 | Q-Gate G4 실패 (커버리지 <80%) | 테스트 케이스 부족 | `pnpm test:coverage` → 누락 함수 확인 후 테스트 추가 |
| 8 | `verifyToken() 미호출` Reviewer 경고 | 엔드포인트에 인증 미적용 | 핸들러 첫 줄에 `const user = await verifyToken(req)` 추가 |
| 9 | `pnpm build` Turbo 캐시 무효화 | 의존 패키지 변경 후 재빌드 필요 | `pnpm clean && pnpm build` |
| 10 | Linkerd mTLS 연결 실패 | 파드 어노테이션 누락 | Deployment에 `linkerd.io/inject: enabled` 어노테이션 추가 |

### 자주 쓰는 디버깅 명령 모음

```bash
# Pod 이유 모르게 죽었을 때
kubectl get pod <pod> -n saas-platform -o yaml | grep -A 10 "lastState"

# 서비스 응답 없을 때
kubectl port-forward svc/<service> 8080:80 -n saas-platform
curl http://localhost:8080/health

# Flux 전체 오류 한번에 보기
flux get all -A | grep -v "True"

# 빌드 캐시 완전 초기화 후 재빌드
pnpm clean && turbo run build --force

# Prisma 마이그레이션 상태 확인
pnpm prisma migrate status

# 테스트 특정 파일만 실행
pnpm --filter @public-saas/auth-service test -- --testPathPattern="handlers/login"
```

---

## 7. 연락처 에스컬레이션

> **원칙**: 먼저 가이드북과 팀 위키를 검색하고, 15분 이상 해결되지 않으면 아래 담당자에게 문의합니다.

### 7.1 문제 유형별 담당

| 문제 유형 | 1차 문의 | 2차 에스컬레이션 | 비고 |
|---------|---------|--------------|------|
| **보안 취약점 발견** | 즉시 보안팀 (Slack: #보안-긴급) | 팀장 + CISO | 이메일 발송 금지 — Slack 전용 |
| **CSAP 규정 해석** | 컴플라이언스팀 (Slack: #csap-질문) | 감리팀 | 문서 링크와 함께 질문 |
| **k8s 클러스터 장애** | 인프라팀 (Slack: #인프라-알림) | 시니어 인프라 엔지니어 | 장애 발생 시각·증상·영향 범위 명시 |
| **코드 리뷰 요청** | 담당 시니어 개발자 (Slack DM) | 팀 리드 | PR 링크와 리뷰 포인트 명시 |
| **CI/CD 파이프라인 오류** | DevOps 채널 (Slack: #devops) | 인프라팀 | 파이프라인 링크와 오류 로그 첨부 |
| **DB 마이그레이션 충돌** | 백엔드 시니어 (Slack DM) | 팀 리드 | 절대 `--force` 사용 금지 — 먼저 문의 |
| **감리 지적 사항** | 컴플라이언스팀 + 팀장 | 감리팀 | 48시간 내 조치 계획 제출 필요 |
| **외부 클라우드 서비스 사용 요청** | 컴플라이언스팀 | CTO | 절대 임의 사용 금지 (CLAUDE.md 제약) |
| **온보딩 질문 (일반)** | 팀 동료 또는 멘토 | 팀 리드 | Slack: #온보딩-도움 |
| **Claude Code 오류** | Claude Code 가이드 먼저 참조 | 팀 리드 | `claude --version` 확인 후 문의 |

### 7.2 에스컬레이션 원칙

**즉시 에스컬레이션 (15분 기다리지 마십시오)**:
- 보안 취약점 발견 또는 의심
- 운영 환경(production) 영향
- 개인정보(PII) 유출 가능성

**표준 에스컬레이션 (15분 자가 해결 시도 후)**:
- 빌드/테스트 오류
- k8s 파드 이상
- Flux 동기화 실패

**비동기 처리 (다음 근무일 이내)**:
- 문서 오류/개선 제안
- 코드 리팩토링 제안
- 도구 업그레이드 요청

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 초안 작성 — 역할별 플랜, 명령어 치트시트, 보안 체크리스트, 디렉토리 구조, PDCA 참조, 에러 해결, 에스컬레이션 | Implementer (Sonnet) |
