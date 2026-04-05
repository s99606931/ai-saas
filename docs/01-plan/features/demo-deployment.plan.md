# Plan: 데모 배포 + E2E 테스트 패키지

> **버전**: 1.0.0 | **작성일**: 2026-04-06
> **작성자**: PM Agent (bkit PM Team)
> **PDCA 단계**: Plan
> **연관 로드맵**: docs/roadmap/next-roadmap.md

---

## Executive Summary (4-Perspective)

| 관점 | 내용 |
|------|------|
| **비즈니스** | 58개 MTU 완료된 플랫폼을 실제 데모로 전환 — 공공기관 담당자가 브라우저에서 즉시 테스트 가능 |
| **사용자** | 데모 테넌트 로그인 → 전체 기능(관리자/테넌트) 탐색 → E2E 시나리오 직접 실행 |
| **기술** | Next.js 포털 API Routes + Prisma 직접 연결, Playwright E2E 자동화 |
| **리스크** | 하드코딩 정적 데이터 → 실DB 연동 시 스키마 불일치 가능 → Prisma migrate로 사전 검증 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 포털 UI가 하드코딩 정적 데이터로 구현되어 있어 실DB 연동 화면 테스트 불가능 |
| **WHO** | 공공기관 담당자(발주처), 개발팀 내부 QA, 감리관 시연 |
| **RISK** | 서비스 간 API 연동 미완성 시 포털 직접 Prisma 접근으로 대체 |
| **SUCCESS** | `docker compose up` → DB 시드 → 브라우저에서 실DB 데이터 확인 가능 |
| **SCOPE** | 포털 API Routes (읽기 전용 데모) + 시드 데이터 + Playwright E2E + 테스트 가이드 |

---

## MTU 구성 (4개 병렬)

### MTU-DEP1: 포털 DB 연동

| 항목 | 내용 |
|------|------|
| **목표** | Next.js 포털의 하드코딩 데이터를 실DB API Routes로 교체 |
| **의존성** | Prisma schema (기존 완료) |
| **산출물** | `platform/apps/portal/src/app/api/` (dashboard, tenants, users, compliance) |
| **검증 기준** | 대시보드 로드 시 DB 실데이터 표시 (테넌트 수, 사용자 수 등) |
| **FR ID** | FR-DEP1.1 ~ FR-DEP1.6 |

**기능 요구사항**:
- FR-DEP1.1: `/api/dashboard/stats` — 테넌트/사용자/구독 집계
- FR-DEP1.2: `/api/tenants` — 테넌트 목록 (페이지네이션)
- FR-DEP1.3: `/api/users` — 사용자 목록 (테넌트 필터)
- FR-DEP1.4: `/api/compliance/csap` — CSAP 79항목 준수 현황
- FR-DEP1.5: `/api/subscriptions` — 구독/서비스 현황
- FR-DEP1.6: 포털 환경변수 `.env.local` 설정 가이드

### MTU-DEMO1: 데모 테넌트 + 시드 데이터

| 항목 | 내용 |
|------|------|
| **목표** | 전체 기능 테스트 가능한 데모 테넌트 + 풍부한 시드 데이터 |
| **의존성** | Prisma schema (기존 완료) |
| **산출물** | `prisma/seed/index.ts` + `prisma/seed/demo-data.ts` |
| **검증 기준** | `pnpm prisma db seed` 실행 후 데모 계정으로 로그인 가능 |
| **FR ID** | FR-DEMO1.1 ~ FR-DEMO1.8 |

**기능 요구사항**:
- FR-DEMO1.1: 데모 테넌트 2개 (행안부 데모, 국토부 데모)
- FR-DEMO1.2: 역할별 사용자 5종 (SUPER_ADMIN, TENANT_ADMIN, USER, VIEWER, AUDITOR)
- FR-DEMO1.3: SaaS 서비스 카탈로그 5종 (문서관리, AI분석, 데이터포털, 보안감사, ERP연동)
- FR-DEMO1.4: 구독 데이터 (각 테넌트 3개 서비스 구독)
- FR-DEMO1.5: 감사 로그 100건+ (로그인, 조회, 수정 이력)
- FR-DEMO1.6: 준수 현황 데이터 (CSAP 79항목 상태값)
- FR-DEMO1.7: 알림 이력 20건+
- FR-DEMO1.8: 메뉴 구성 (관리자/테넌트 각 10개+)

### MTU-E2E1: Playwright E2E 테스트

| 항목 | 내용 |
|------|------|
| **목표** | 핵심 사용자 플로우 Playwright 자동화 테스트 |
| **의존성** | MTU-DEP1 + MTU-DEMO1 완료 |
| **산출물** | `e2e/admin-portal/*.spec.ts` + `e2e/tenant-portal/*.spec.ts` + `playwright.config.ts` |
| **검증 기준** | `pnpm e2e` 실행 시 핵심 시나리오 95%+ 통과 |
| **FR ID** | FR-E2E1.1 ~ FR-E2E1.8 |

**기능 요구사항**:
- FR-E2E1.1: 로그인 플로우 (SUPER_ADMIN, TENANT_ADMIN, USER 각 역할)
- FR-E2E1.2: 관리자 대시보드 로드 + 데이터 표시 검증
- FR-E2E1.3: 테넌트 관리 CRUD (목록 조회, 상세 조회)
- FR-E2E1.4: 사용자 관리 (목록, 역할 확인)
- FR-E2E1.5: CSAP 준수 현황 대시보드 표시
- FR-E2E1.6: 테넌트 포털 서비스 허브 조회
- FR-E2E1.7: 테넌트 포털 마켓플레이스 조회
- FR-E2E1.8: 로그아웃 플로우

### MTU-Q1: API 게이트웨이 품질 보완

| 항목 | 내용 |
|------|------|
| **목표** | MTU-P04 (81.8%) → 90%+ 달성 |
| **의존성** | 없음 (독립 작업) |
| **산출물** | `platform/services/api-gateway/src/` 개선 |
| **검증 기준** | 매치율 90%+ (deferred 2건 구현 완료) |

---

## 우선순위 & 병렬 실행

```
[즉시 병렬 실행]
Stream A: MTU-DEP1 + MTU-DEMO1 (구현팀 1)
Stream B: MTU-E2E1 (구현팀 2)
Stream C: MTU-Q1 (구현팀 3)

[순차 실행]
Stream A+B 완료 → E2E 통합 실행 → 테스트 가이드 생성
```

---

## NFR (비기능 요구사항)

| ID | 요건 |
|----|------|
| NFR-1 | 시드 데이터: CSAP D-09 — 비밀번호 bcrypt 해시 필수 |
| NFR-2 | API Routes: CSAP D-08 — 인증 미들웨어 (데모용 간소화 허용) |
| NFR-3 | E2E: Playwright + @playwright/test 사용 |
| NFR-4 | 테스트 가이드: 비개발자도 이해 가능한 단계별 안내 |

---

## 성공 기준 (Q-Gate)

| Gate | 기준 | 담당 |
|------|------|------|
| G1 | FR-DEP1.1~1.6 전수 구현 | Implementer |
| G2 | 데모 시드 실행 성공 + 5종 사용자 계정 유효 | Tester |
| G3 | Playwright E2E 95%+ 통과 | Tester |
| G4 | DEMO-TEST-GUIDE.md 완비 | Implementer |
| G5 | 감사 로그 audit.jsonl 기록 | Auditor |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
