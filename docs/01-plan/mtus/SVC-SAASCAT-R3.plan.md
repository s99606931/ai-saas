# Plan: SVC-SAASCAT-R3 -- SaaS 카탈로그 서비스 신규 구현

> 작성일: 2026-04-09 | 버전: 1.0 | 작성자: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | SaaS 마켓플레이스 카탈로그 관리 -- 공공기관 SaaS 등록/승인/검색 |
| 기술 | Fastify + Zod 검증 + 테넌트 격리 + CRUD + 검색 API |
| 보안 | CSAP D-08 접근 통제, D-06 감사 로그, D-12 입력 검증 |
| 운영 | 헬스체크, readiness 프로브, X-Response-Time, OTel 분산 추적 |

## Context Anchor

- **WHY**: 17번째 서비스로 존재하나 구현 미완. SaaS 마켓플레이스 핵심 기능.
- **WHO**: SaaS 제공자(등록), 테넌트 관리자(구독 검토), 시스템 관리자(승인)
- **RISK**: 미구현 서비스 방치 -> 테스트 커버리지 0, CSAP 감리 지적
- **SUCCESS**: FR-SCAT.1~SCAT.7 전체 구현 + 50건+ 테스트 PASS
- **SCOPE**: SaaS 항목 CRUD, 카테고리 관리, 검색/필터, 승인 워크플로, 감사 로그

---

## 기능 요구사항

### FR-SCAT.1: SaaS 카탈로그 항목 CRUD

- POST /saas-catalog -- 신규 SaaS 항목 등록
  - 필수: name, description, category, provider, version
  - 선택: tags, pricing, documentation_url, csap_grade
  - 초기 상태: DRAFT
- GET /saas-catalog -- 목록 조회 (페이지네이션)
  - 쿼리: page, limit, category, status, search
- GET /saas-catalog/:id -- 상세 조회
- PUT /saas-catalog/:id -- 수정 (DRAFT/REJECTED 상태만)
- DELETE /saas-catalog/:id -- 삭제 (DRAFT 상태만, 소프트 삭제)

### FR-SCAT.2: 카테고리 관리

- GET /saas-catalog/categories -- 카테고리 목록
- 기본 카테고리: 업무관리, 문서관리, 보안, AI/ML, 인프라, 데이터, 협업, 기타

### FR-SCAT.3: 검색 및 필터링

- 이름/설명 키워드 검색 (LIKE)
- 카테고리별 필터
- CSAP 등급별 필터 (중등급/상등급)
- 상태별 필터 (DRAFT/PENDING/APPROVED/REJECTED/DEPRECATED)
- 정렬: name, createdAt, updatedAt (asc/desc)

### FR-SCAT.4: 승인 워크플로

- POST /saas-catalog/:id/submit -- DRAFT -> PENDING
- POST /saas-catalog/:id/approve -- PENDING -> APPROVED (관리자만)
- POST /saas-catalog/:id/reject -- PENDING -> REJECTED (관리자만, 사유 필수)
- POST /saas-catalog/:id/deprecate -- APPROVED -> DEPRECATED (관리자만)

### FR-SCAT.5: 통계 API

- GET /saas-catalog/stats -- 상태별/카테고리별 항목 수 통계

### FR-SCAT.6: CSAP 준수

- D-08-05: 테넌트 격리 (X-Tenant-Id 헤더 필수)
- D-06: 모든 상태 변경 감사 로그 기록
- D-12: Zod 스키마 입력 검증

### FR-SCAT.7: 관측성

- 헬스체크, readiness 프로브
- X-Response-Time 헤더
- OpenTelemetry 분산 추적
- Rate Limiting

---

## 비기능 요구사항

- NFR-1: 응답 시간 < 200ms (목록 조회)
- NFR-2: 페이지네이션 기본 20, 최대 100
- NFR-3: 소프트 삭제 (deletedAt 필드)

## CSAP 매핑

| CSAP | FR | 설명 |
|------|-----|------|
| D-08-05 | FR-SCAT.6 | 테넌트 격리 |
| D-06 | FR-SCAT.6 | 감사 로그 |
| D-12 | FR-SCAT.6 | 입력 검증 |
| D-10 | FR-SCAT.7 | Rate Limiting |

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 |
|-------|--------|--------|
| FR-SCAT.1 | catalog.handler.ts | catalog-crud.test.ts |
| FR-SCAT.2 | categories.handler.ts | catalog-categories.test.ts |
| FR-SCAT.3 | catalog.handler.ts (검색) | catalog-search.test.ts |
| FR-SCAT.4 | workflow.handler.ts | catalog-workflow.test.ts |
| FR-SCAT.5 | stats.handler.ts | catalog-stats.test.ts |
| FR-SCAT.6 | 전체 | catalog-csap.test.ts |
| FR-SCAT.7 | index.ts | 통합 테스트 |
