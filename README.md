# 공공기관 SaaS 프레임워크 (Public SaaS Framework)

> 공공기관 클라우드 전환을 위한 CSAP/ISMS-P 인증 지원 SaaS 프레임워크
> A CSAP/ISMS-P certified SaaS framework for Korean public institutions

---

## 프로젝트 소개

공공기관 SaaS 프레임워크는 공공기관의 클라우드 전환 사업에서 **CSAP 표준등급 79항목** 및 **ISMS-P 101항목** 인증을 효율적으로 취득할 수 있도록 설계된 오픈소스 플랫폼입니다.

### 주요 특징

- **CSAP 인증 지원**: 79개 통제항목 증적 자동 매핑 + OSCAL v1.1.3 호환
- **ISMS-P 대응**: 101항목 체크리스트 + CSAP 45항목 증적 재활용
- **멀티테넌시**: 기관별 격리된 테넌트 + RBAC 기반 접근 통제
- **마이크로서비스**: 17개 서비스 (인증, 사용자, 테넌트, AI, 감사, 준수, 보안 등)
- **AI 연동**: LM Studio 기반 로컬 LLM + N2SF 데이터 등급 자동 분류
- **감리 대응**: 행안부 감리기준 산출물 7종(T01~T07) 완비
- **보안 내재화**: OWASP Top 10, 시큐어코딩, 감사 로그 1년 보존

### 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 15, TypeScript, Tailwind CSS |
| 백엔드 | Hono (경량 HTTP), TypeScript |
| 데이터베이스 | PostgreSQL 16, Prisma ORM |
| 캐시/큐 | Redis 7 |
| 파일 저장소 | MinIO (S3 호환) |
| 컨테이너 | Docker, k3s (경량 Kubernetes) |
| CI/CD | Gitea Actions |
| AI/LLM | LM Studio (OpenAI 호환 API) |
| 인증/보안 | JWT RS256, AES-256, TLS 1.3 |

---

## 빠른 시작 (5분)

### 사전 요구사항

- Docker 24.0+ (또는 Docker Desktop)
- Node.js 20 LTS
- pnpm 9.x

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/your-org/public-saas-framework.git
cd public-saas-framework

# 2. 환경 변수 설정
cp docs/env.example .env
# .env 파일을 편집하여 필수 값 설정

# 3. 의존성 설치
pnpm install

# 4. 인프라 기동 (PostgreSQL + Redis + MinIO)
docker compose up -d

# 5. 데이터베이스 마이그레이션 + 시드 데이터
pnpm prisma migrate deploy
pnpm prisma db seed

# 6. 포털 실행
pnpm --filter @public-saas/portal dev
```

브라우저에서 `http://localhost:4000` 접속

### 데모 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|---------|
| 시스템 관리자 | admin@example.com | (환경 변수 참조) |
| 기관 관리자 | tenant-admin@example.com | (환경 변수 참조) |

---

## 프로젝트 구조

```
public-saas-framework/
├── platform/
│   ├── apps/
│   │   ├── portal/              # 사용자 포털 (Next.js)
│   │   └── admin/               # 관리자 포털 (Next.js)
│   ├── services/                # 마이크로서비스 (Hono)
│   │   ├── auth-service/        # 인증/인가
│   │   ├── user-service/        # 사용자 관리
│   │   ├── tenant-service/      # 테넌트 관리
│   │   ├── notification-service/# 알림 서비스
│   │   ├── ai-service/          # AI/LLM 연동
│   │   └── ...                  # 기타 서비스
│   ├── packages/                # 공유 패키지
│   │   └── shared/              # 공통 유틸리티
│   └── plugins/                 # 비즈니스 플러그인
│       ├── electronic-approval/ # 전자결재 샘플
│       └── public-data-integration/ # 공공데이터 연동 샘플
├── docs/                        # 프레임워크 문서
│   ├── framework/               # 인증/보안 프레임워크
│   │   ├── 01-security-policy/  # 보안 정책
│   │   ├── 02-csap/             # CSAP 인증
│   │   └── 03-isms-p/           # ISMS-P 인증
│   └── roadmap/                 # 로드맵
├── docker-compose.yml           # 전체 서비스 Docker Compose
├── FORK-GUIDE.md                # 포크 가이드
├── CONTRIBUTING.md              # 기여 가이드
└── LICENSE                      # MIT 라이선스
```

---

## 인증 지원 현황

### CSAP 표준등급 (79항목)

| 영역 | 항목 수 | 프레임워크 지원 | 비고 |
|------|--------|-------------|------|
| D-01 정보보호 정책 | 4 | 템플릿 + 가이드 | |
| D-06 침해사고 관리 | 5 | 구현(audit.jsonl) | 감사 로그 1년 보존 |
| D-08 접근 통제 | 12 | 구현(RBAC + MFA) | user-service, auth-service |
| D-09 암호화 | 4 | 구현(AES-256, TLS 1.3) | crypto 모듈 |
| D-12 개발 보안 | 10 | 구현 + 가이드 | 시큐어코딩, OWASP Top 10 |
| 기타 | 44 | 가이드 + 템플릿 | |

### ISMS-P (101항목)

- CSAP 재활용 가능: 45항목 (45%)
- 프레임워크 자동 증적: 61항목 (60.4%)
- 신규 증적 필요: 56항목 (조직별 작성 필요)

---

## 문서

| 문서 | 설명 |
|------|------|
| [FORK-GUIDE.md](FORK-GUIDE.md) | 포크 후 10일 이내 서비스 착수 가이드 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 기여 가이드 |
| [CSAP 증적 매핑](docs/framework/02-csap/standard-grade/evidence-mapping.md) | 79항목 증적 매핑 |
| [ISMS-P 체크리스트](docs/framework/03-isms-p/checklist-101.md) | 101항목 체크리스트 |
| [아키텍처 문서](docs/02-design/) | 시스템 설계 문서 |

---

## 기여

기여를 환영합니다. 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참조하세요.

---

## 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE)로 배포됩니다.

---

## Overview (English)

**Public SaaS Framework** is an open-source platform designed for Korean public institutions transitioning to cloud services. It provides built-in support for **CSAP (Cloud Security Assurance Program)** standard-grade certification (79 control items) and **ISMS-P** certification (101 items).

### Key Features

- **CSAP Certification Support**: Automated evidence mapping for 79 control items + OSCAL v1.1.3 compatibility
- **ISMS-P Compliance**: 101-item checklist with 45% evidence reuse from CSAP
- **Multi-tenancy**: Isolated tenants with RBAC-based access control
- **Microservices**: 15 services (auth, user, tenant, notification, AI, etc.)
- **AI Integration**: Local LLM via LM Studio + N2SF data classification
- **Audit Compliance**: 7 audit deliverables (T01-T07) per Korean government standards
- **Security by Design**: OWASP Top 10, secure coding, 1-year audit log retention

### Quick Start

```bash
git clone https://github.com/your-org/public-saas-framework.git
cd public-saas-framework
cp docs/env.example .env
pnpm install
docker compose up -d
pnpm prisma migrate deploy && pnpm prisma db seed
pnpm --filter @public-saas/portal dev
```

Visit `http://localhost:4000` in your browser.

### License

This project is licensed under the [MIT License](LICENSE).

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
