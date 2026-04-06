# MTU-ECO3 — 비즈니스 플러그인 샘플 앱 2종 설계

> **문서 ID**: MTU-ECO3-DESIGN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ECO3.1~FR-ECO3.8
> **참조**: docs/01-plan/features/mtu-eco3-plugin-samples.plan.md

---

## 1. 아키텍처 선택

**선택안**: Pragmatic Balance
- Hono 기반 마이크로서비스 (기존 플랫폼 패턴 준수)
- ServiceManifest 인터페이스 준수 (FORK-GUIDE.md 기반)
- CSAP D-08 RBAC + D-12 Zod 입력 검증 기본 적용

## 2. 산출물 설계

### 2.1 전자결재 플러그인 (FR-ECO3.1~ECO3.4)

```
platform/plugins/electronic-approval/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # 플러그인 진입점 + Hono 앱
│   ├── manifest.ts                 # ServiceManifest 정의
│   ├── routes.ts                   # 라우트 등록
│   ├── handlers/
│   │   ├── draft.handler.ts        # 기안 작성 CRUD (FR-ECO3.1)
│   │   ├── approval-line.handler.ts # 결재선 설정 (FR-ECO3.2)
│   │   ├── approval.handler.ts     # 결재 처리 (FR-ECO3.3)
│   │   └── document.handler.ts     # 문서 조회 (FR-ECO3.4)
│   ├── lib/
│   │   ├── approval-engine.ts      # 결재 엔진 (직렬/병렬)
│   │   └── document-status.ts      # 상태 머신 (기안/진행/승인/반려/보류)
│   └── schemas/
│       ├── draft.schema.ts         # Zod 검증 스키마
│       └── approval.schema.ts      # Zod 검증 스키마
└── README.md                       # 플러그인 사용법

API 엔드포인트:
  POST   /api/v1/drafts              # 기안 작성
  GET    /api/v1/drafts              # 기안 목록
  GET    /api/v1/drafts/:id          # 기안 상세
  PUT    /api/v1/drafts/:id          # 기안 수정
  DELETE /api/v1/drafts/:id          # 기안 삭제
  POST   /api/v1/drafts/:id/lines   # 결재선 설정
  POST   /api/v1/drafts/:id/approve # 승인
  POST   /api/v1/drafts/:id/reject  # 반려
  POST   /api/v1/drafts/:id/hold    # 보류
  GET    /api/v1/documents           # 문서 목록 (상태별 필터)
```

### 2.2 공공데이터 연동 플러그인 (FR-ECO3.5~ECO3.8)

```
platform/plugins/public-data-integration/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # 플러그인 진입점
│   ├── manifest.ts                 # ServiceManifest 정의
│   ├── routes.ts                   # 라우트 등록
│   ├── handlers/
│   │   ├── dataset.handler.ts      # 데이터셋 검색/목록 (FR-ECO3.6)
│   │   └── data.handler.ts         # 데이터 조회/변환 (FR-ECO3.8)
│   ├── lib/
│   │   ├── data-portal-client.ts   # 공공데이터포털 API 클라이언트 (FR-ECO3.5)
│   │   ├── cache.ts                # Redis 캐싱 미들웨어 (FR-ECO3.7)
│   │   └── transformer.ts          # XML->JSON, CSV->JSON 변환 (FR-ECO3.8)
│   └── schemas/
│       └── dataset.schema.ts       # Zod 검증 스키마
└── README.md                       # 플러그인 사용법

API 엔드포인트:
  GET    /api/v1/datasets            # 데이터셋 검색
  GET    /api/v1/datasets/:id        # 데이터셋 상세
  GET    /api/v1/datasets/:id/data   # 데이터 조회 (캐시)
  POST   /api/v1/datasets/transform  # 데이터 변환
```

### 2.3 플러그인 개발 가이드 (공통)

```
docs/framework/05-ecosystem/plugin-development-guide.md
├── 1. 플러그인 아키텍처 개요
│   ├── ServiceManifest 인터페이스
│   ├── Hono 기반 라우팅
│   └── 공통 미들웨어 (인증/로깅/검증)
├── 2. 플러그인 생성 절차
│   ├── 디렉토리 구조 템플릿
│   ├── manifest.ts 작성법
│   └── 라우트 등록 방법
├── 3. 보안 준수 사항
│   ├── CSAP D-08 RBAC 적용 필수
│   ├── CSAP D-12 Zod 입력 검증 필수
│   └── 감사 로그 기록 필수
├── 4. 테스트 가이드
└── 5. 배포 및 등록
```

## 3. 추적성 매트릭스

| FR ID | 설계 섹션 | 산출물 | 검증 |
|-------|---------|--------|------|
| FR-ECO3.1 | 2.1 | draft.handler.ts | CRUD 5개 엔드포인트 |
| FR-ECO3.2 | 2.1 | approval-line.handler.ts | 결재선 API |
| FR-ECO3.3 | 2.1 | approval.handler.ts | 승인/반려/보류 API |
| FR-ECO3.4 | 2.1 | document.handler.ts | 상태별 필터 API |
| FR-ECO3.5 | 2.2 | data-portal-client.ts | API 클라이언트 |
| FR-ECO3.6 | 2.2 | dataset.handler.ts | 검색 API |
| FR-ECO3.7 | 2.2 | cache.ts | Redis 캐싱 |
| FR-ECO3.8 | 2.2 | transformer.ts | XML/CSV 변환 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
