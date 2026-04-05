# 최종 프로젝트 폴더 구조

> **문서 ID**: FINAL-FOLDER-STRUCTURE-2026
> **작성일**: 2026-04-05
> **버전**: 1.0.0
> **상태**: Draft (사용자 확인 요청)
> **목적**: 플랫폼 구현 완료 후 전체 레포지토리 구조 확인

---

## 전체 최상위 구조

```
public-saas-framework/                ← 레포 루트 (포크 단위)
│
├── platform/                         ★ 플랫폼 구현체 (PRE-BUILT 서비스)
├── business-template/                ★ 비즈니스 로직 템플릿 (포크 후 이곳만 개발)
├── docs/                             ★ 문서 프레임워크 (35 MTU 기존 완료)
├── infra/                            ★ 인프라 설정 (k3s, Gitea, Helm)
├── .claude/                          CC 하네스 설정
├── .bkit/                            bkit PDCA 엔진
├── CLAUDE.md                         프로젝트 하네스 규칙
├── FORK-GUIDE.md                     → 포크 시작 가이드 (신규)
├── CHANGELOG.md                      변경 이력
└── README.md                         프로젝트 소개
```

---

## 1. platform/ — 플랫폼 구현체

```
platform/
│
├── apps/                             # 프론트엔드 애플리케이션
│   ├── admin-portal/                 # 관리자 포털 (Next.js 15)
│   │   ├── src/
│   │   │   ├── app/                  # App Router 페이지
│   │   │   │   ├── (auth)/           # 로그인, 비밀번호 재설정
│   │   │   │   ├── (platform)/       # 플랫폼 관리 (슈퍼 어드민)
│   │   │   │   │   ├── tenants/      # 테넌트 관리
│   │   │   │   │   ├── services/     # SaaS 서비스 카탈로그 관리
│   │   │   │   │   ├── users/        # 전체 사용자 관리
│   │   │   │   │   ├── billing/      # 빌링 관리
│   │   │   │   │   ├── crm/          # CRM (고객사/계약 관리)
│   │   │   │   │   ├── ai/           # AI 서비스 관리
│   │   │   │   │   ├── audit/        # 감사 로그 뷰어
│   │   │   │   │   ├── csap/         # CSAP 준수 현황
│   │   │   │   │   └── settings/     # 플랫폼 설정
│   │   │   │   └── api/              # Next.js API Routes
│   │   │   ├── components/           # 관리자 전용 컴포넌트
│   │   │   └── lib/                  # 유틸리티
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   ├── tenant-portal/                # 테넌트 포털 (Next.js 15)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/           # 테넌트 로그인/가입
│   │   │   │   ├── (dashboard)/      # 테넌트 대시보드
│   │   │   │   │   ├── [tenantId]/
│   │   │   │   │   │   ├── dashboard/ # 테넌트 홈
│   │   │   │   │   │   ├── users/    # 테넌트 내 사용자 관리
│   │   │   │   │   │   ├── menu/     # 메뉴 구성 편집기
│   │   │   │   │   │   ├── subscription/ # 구독 관리
│   │   │   │   │   │   ├── ai/       # AI 서비스 사용
│   │   │   │   │   │   ├── services/ # 비즈니스 서비스 실행
│   │   │   │   │   │   └── settings/ # 테넌트 설정 (테마 포함)
│   │   │   └── api/
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   └── docs-portal/                  # 문서 포털 (Docusaurus 3)
│       ├── docs/                     # → docs/framework/ 심볼릭 링크
│       ├── src/
│       │   └── sidebars/             # 역할별 사이드바 (CTO/Dev/감리관/보안)
│       ├── docusaurus.config.ts
│       └── package.json
│
├── services/                         # 백엔드 마이크로서비스
│   │
│   ├── auth-service/                 # MTU-P01: 인증/인가 서비스
│   │   ├── src/
│   │   │   ├── handlers/             # JWT 발급, 검증, 갱신, 블랙리스트
│   │   │   ├── middleware/           # RBAC 미들웨어
│   │   │   ├── models/               # User, Session, Role, Permission
│   │   │   └── lib/
│   │   │       ├── jwt.ts            # RS256 JWT (CSAP D-08: 15분 만료)
│   │   │       └── audit.ts          # 인증 이벤트 감사 로그
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── user-service/                 # MTU-P02: 사용자 관리
│   │   ├── src/
│   │   │   ├── handlers/             # CRUD, 역할 할당, MFA, 비밀번호
│   │   │   ├── models/               # User, UserRole, MfaConfig
│   │   │   └── lib/
│   │   │       └── password-policy.ts # CSAP D-08 비밀번호 정책
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── tenant-service/               # MTU-P03: 테넌트 관리
│   │   ├── src/
│   │   │   ├── handlers/             # 테넌트 CRUD, 격리 설정, 테마
│   │   │   ├── models/               # Tenant, TenantConfig, TenantTheme
│   │   │   └── lib/
│   │   │       └── isolation.ts      # N2SF 테넌트 격리 로직
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── api-gateway/                  # MTU-P04: API 게이트웨이
│   │   ├── src/
│   │   │   ├── routes/               # 서비스별 프록시 라우트
│   │   │   ├── plugins/              # Fastify 플러그인 (인증, Rate Limit)
│   │   │   ├── middleware/           # N2SF 데이터 등급 검증
│   │   │   └── registry/             # 비즈니스 서비스 등록 레지스트리
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── menu-service/                 # MTU-P05: 메뉴 관리
│   │   ├── src/
│   │   │   ├── handlers/             # 메뉴 CRUD, 권한 매핑, 트리 구성
│   │   │   └── models/               # MenuItem, MenuPermission
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── saas-catalog-service/         # MTU-P06: SaaS 서비스 카탈로그
│   │   ├── src/
│   │   │   ├── handlers/             # 서비스 등록, Feature Flag, 버전
│   │   │   └── models/               # Service, ServiceVersion, FeatureFlag
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── subscription-service/         # MTU-P07: 구독 관리
│   │   ├── src/
│   │   │   ├── handlers/             # 플랜 관리, 구독 CRUD, 사용량 추적
│   │   │   └── models/               # Plan, Subscription, UsageRecord
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── billing-service/              # MTU-P08: 빌링
│   │   ├── src/
│   │   │   ├── handlers/             # 청구 계산, 인보이스, 세금계산서
│   │   │   └── models/               # Invoice, Payment, TaxDocument
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── crm-service/                  # MTU-P09: CRM
│   │   ├── src/
│   │   │   ├── handlers/             # 고객사, 담당자, 계약, 파이프라인
│   │   │   └── models/               # Customer, Contact, Contract, Deal
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── ai-service/                   # MTU-P10: AI 서비스 관리
│   │   ├── src/
│   │   │   ├── gateway/              # N2SF 등급 검증 게이트웨이
│   │   │   ├── handlers/             # 모델 등록, 사용량 추적, 비용 관리
│   │   │   ├── models/               # AiModel, AiUsage, DataGradePolicy
│   │   │   └── lib/
│   │   │       ├── grade-check.ts    # C/S등급 → AI API 전송 차단 (N2SF N-05)
│   │   │       └── pii-masking.ts    # PII 마스킹 (O등급 전송 전)
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── notification-service/         # MTU-P11: 알림
│   │   ├── src/
│   │   │   ├── handlers/             # 이메일/SMS/인앱 알림
│   │   │   ├── templates/            # 알림 템플릿 (한국어)
│   │   │   └── models/               # NotificationTemplate, NotificationLog
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── file-service/                 # MTU-P12: 파일 관리
│   │   ├── src/
│   │   │   ├── handlers/             # 업로드, 다운로드, 삭제, 바이러스 스캔
│   │   │   └── lib/
│   │   │       ├── encrypt.ts        # AES-256 암호화 (CSAP D-09)
│   │   │       └── minio-client.ts   # MinIO 클라이언트 (폐쇄망 S3)
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── audit-service/                # MTU-P13: 감사 로그 (CSAP D-06)
│   │   ├── src/
│   │   │   ├── handlers/             # 로그 기록, 조회, 무결성 검증
│   │   │   └── lib/
│   │   │       ├── append-only.ts    # append-only 로그 구조
│   │   │       └── integrity.ts      # SHA-256 체인 검증
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── compliance-service/           # MTU-P14: 준수 현황
│   │   ├── src/
│   │   │   ├── handlers/             # CSAP/N2SF/ISMS-P 현황 조회
│   │   │   └── metrics/              # OpenTelemetry 메트릭 수집
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── security-monitor-service/     # MTU-P15: 보안 모니터링
│       ├── src/
│       │   ├── detectors/            # 이상 접근, 로그인 실패, IP 차단
│       │   └── handlers/             # 보안 이벤트 처리
│       ├── Dockerfile
│       └── package.json
│
├── packages/                         # 공통 패키지 (모노레포)
│   ├── ui/                           # 공통 UI 컴포넌트 (shadcn/ui 확장)
│   │   ├── src/
│   │   │   ├── atoms/                # Button, Badge, Input
│   │   │   ├── molecules/            # DataTable, FormField, StatusCard
│   │   │   ├── organisms/            # Sidebar, Header, ComplianceMatrix
│   │   │   └── public-saas/          # 공공기관 전용 컴포넌트
│   │   │       ├── CsapStatusBadge.tsx
│   │   │       ├── N2sfGradeIndicator.tsx
│   │   │       ├── AuditTrailViewer.tsx
│   │   │       └── AiAssistantPanel.tsx
│   │   └── package.json
│   │
│   ├── auth-sdk/                     # 인증 SDK (서비스 공통 사용)
│   │   ├── src/
│   │   │   ├── verify-token.ts       # JWT 검증
│   │   │   ├── rbac.ts               # RBAC 헬퍼
│   │   │   └── middleware.ts         # Fastify/Express 미들웨어
│   │   └── package.json
│   │
│   ├── audit-sdk/                    # 감사 로그 SDK (서비스 공통 사용)
│   │   ├── src/
│   │   │   └── audit-logger.ts       # CSAP D-06 준수 로거
│   │   └── package.json
│   │
│   ├── business-plugin-sdk/          # 비즈니스 서비스 플러그인 SDK ★
│   │   ├── src/
│   │   │   ├── register-service.ts   # API 게이트웨이 서비스 등록
│   │   │   ├── csap-guard.ts         # CSAP 준수 자동 체크 훅
│   │   │   ├── audit-hook.ts         # 감사 로그 자동 기록 훅
│   │   │   └── types.ts              # 플러그인 인터페이스
│   │   ├── README.md                 # SDK 사용법
│   │   └── package.json
│   │
│   └── types/                        # 공통 TypeScript 타입
│       ├── src/
│       │   ├── tenant.ts
│       │   ├── user.ts
│       │   ├── subscription.ts
│       │   └── csap.ts
│       └── package.json
│
├── prisma/                           # 공통 데이터베이스 스키마
│   ├── schema.prisma                 # 전체 모델 정의
│   └── migrations/                   # 마이그레이션 이력
│
├── styles/                           # 공통 스타일 (Tailwind v4)
│   ├── tailwind.css
│   ├── tokens/
│   │   ├── primitives.css
│   │   └── semantic.css
│   └── themes/                       # 테마 5종 (government-blue 기본)
│
├── package.json                      # 모노레포 루트 (pnpm workspaces)
├── pnpm-workspace.yaml
└── turbo.json                        # Turborepo 빌드 파이프라인
```

---

## 2. business-template/ — 비즈니스 로직 템플릿 (포크 후 개발 대상)

```
business-template/
│
├── my-business-service/              ★ 이 디렉토리만 개발하면 됨
│   ├── src/
│   │   ├── handlers/                 # 비즈니스 API 핸들러
│   │   │   └── example.handler.ts    # 예시 핸들러 (CSAP 패턴 포함)
│   │   ├── models/                   # 비즈니스 도메인 모델
│   │   │   └── example.model.ts      # 예시 모델 (Zod 검증 포함)
│   │   ├── services/                 # 비즈니스 도메인 서비스
│   │   └── index.ts                  # SDK 등록 진입점
│   │
│   ├── docs/                         # 비즈니스 서비스 감리 산출물
│   │   ├── plan.md                   # 자동 생성 템플릿 (FR-ID 포함)
│   │   ├── design.md                 # 자동 생성 템플릿
│   │   └── test-plan.md              # T05 시험계획서 템플릿
│   │
│   ├── Dockerfile                    # k3s 배포용
│   ├── service-manifest.yaml         # API 게이트웨이 등록 설정
│   └── package.json
│
└── FORK-GUIDE.md                     # 포크 시작 체크리스트
```

---

## 3. docs/ — 문서 프레임워크 (기존 35 MTU 완료)

```
docs/
├── framework/                        ★ 납품 프레임워크 문서 (완료)
│   ├── 00-getting-started/
│   ├── 01-dev-standards/
│   ├── 02-csap/                      # CSAP 79항목 (표준/간편등급)
│   ├── 03-n2sf/                      # N2SF 6영역
│   ├── 04-isms-p/                    # ISMS-P 101항목
│   ├── 05-audit-docs/                # 행안부 감리 문서
│   ├── 06-audit-compliance/          # T01~T07 템플릿
│   ├── 07-infra/                     # k3s, Gitea, Flux, Harbor
│   ├── 08-ai-integration/            # AI 게이트웨이, MCP
│   ├── 09-cc-harness/                # Claude Code 하네스
│   ├── 10-oscal/                     # OSCAL 매핑
│   ├── 11-documentation-portal/      # Docusaurus 설정
│   ├── 12-compliance-dashboard/      # Grafana 대시보드
│   ├── 13-multitenancy/              # 멀티테넌시 아키텍처
│   ├── 14-framework-upgrade/         # 업그레이드 전략
│   └── 99-references/                # 규정·용어
│
├── roadmap/                          # 로드맵
│   ├── master-roadmap.md             # 기존 35 MTU 로드맵
│   ├── saas-platform-roadmap.md      # ★ 신규 플랫폼 로드맵 (본 문서)
│   ├── final-folder-structure.md     # ★ 본 문서
│   └── final-menu-structure.md       # ★ 메뉴 구조 문서
│
├── 00-pm/                            # PRD, 시장조사
├── archive/2026-04/                  # 완료 MTU 아카이브
└── pm-reports/                       # PM 세션 보고서
```

---

## 4. infra/ — 인프라 설정

```
infra/
├── k3s/                              # k3s 클러스터 (MTU-I1 기반)
│   ├── namespaces.yaml               # 서비스별 네임스페이스 + N2SF 격리
│   └── network-policies/             # 네임스페이스 간 통신 정책
│
├── helm/                             # Helm 차트 (서비스별)
│   ├── platform/                     # 플랫폼 서비스 차트
│   ├── business/                     # 비즈니스 서비스 차트 템플릿
│   └── monitoring/                   # Prometheus + Grafana + Loki
│
├── gitea/                            # Gitea CI/CD (MTU-I2 기반)
│   └── workflows/                    # 빌드·테스트·스캔·배포 파이프라인
│
└── flux/                             # Flux GitOps (MTU-I3 기반)
    └── clusters/                     # 클러스터별 kustomization
```

---

## 5. .claude/ — CC 하네스 (기존 유지)

```
.claude/
├── agents/                           # implementer, reviewer, auditor, tester, refactorer
├── hooks/                            # pre/post 훅
├── rules/                            # csap-compliance, deadcode-policy, harness-constraints
└── agent-memory/                     # 에이전트 학습 기억
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최종 폴더 구조 초안 작성 (사용자 확인 요청) | PM Agent |
