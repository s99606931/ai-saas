# SVC-TENANT-R14 Plan -- 멀티테넌트 데이터 격리 강화

> Round 14: Row-Level Security + 테넌트별 암호화 + 격리 검증
> 버전: 1.0.0 | 작성일: 2026-04-09 | 작성자: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 멀티테넌시 데이터 격리 강화로 SaaS 고객 신뢰도 확보 |
| 기술 | @public-saas/tenant-isolation 패키지: RLS, 테넌트별 암호화, 격리 검증 |
| 보안 | CSAP D-08 접근 통제 + D-09 암호화: 테넌트 간 데이터 완전 격리 |
| 운영 | 자동 격리 검증으로 테넌트 간 데이터 유출 사전 차단 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 멀티테넌시 환경에서 테넌트 간 데이터 유출은 치명적 보안 사고 |
| WHO | SaaS 운영팀, 보안 관리자, 테넌트 관리자 |
| RISK | RLS 정책 미적용 시 테넌트 간 데이터 접근 가능, 암호화 키 혼용 |
| SUCCESS | RLS 자동 적용, 테넌트별 AES-256 암호화, 격리 검증 100% 통과 |
| SCOPE | tenant-isolation 패키지 생성, RLS 미들웨어, 암호화 유틸, 격리 테스터 |

## 기능 요구사항

### FR-TENANT.1: @public-saas/tenant-isolation 패키지 생성

**모듈 구조**:
- `TenantContext`: 요청별 테넌트 컨텍스트 관리 (AsyncLocalStorage)
- `RowLevelSecurity`: RLS 정책 자동 적용 미들웨어
- `TenantEncryption`: 테넌트별 AES-256 암호화/복호화
- `IsolationValidator`: 테넌트 격리 검증 유틸리티
- `tenantIsolationPlugin`: Fastify 플러그인 (전체 통합)

### FR-TENANT.2: 테넌트 컨텍스트 관리

- AsyncLocalStorage 기반 요청별 테넌트 ID 자동 전파
- X-Tenant-Id 헤더 또는 JWT 클레임에서 테넌트 ID 추출
- 테넌트 컨텍스트 없는 데이터 접근 차단
- SUPER_ADMIN은 테넌트 전환 가능

### FR-TENANT.3: Row-Level Security 자동 적용

- 쿼리 래퍼: SELECT/UPDATE/DELETE에 `WHERE tenant_id = ?` 자동 추가
- INSERT 시 tenant_id 자동 주입
- RLS 우회 시도 감사 로그 기록 (CSAP D-06)
- 테넌트 컨텍스트 없는 쿼리 차단

### FR-TENANT.4: 테넌트별 암호화

- AES-256-GCM 암호화 (CSAP D-09)
- 테넌트별 고유 암호화 키 파생 (HKDF)
- 암호화 필드: 민감 데이터 (PII, 금융 정보 등)
- 키 로테이션 지원 (버전 관리)

### FR-TENANT.5: 격리 검증

- 교차 테넌트 접근 시도 탐지
- 격리 상태 자동 검증 (health check 통합)
- 위반 시 요청 차단 + 감사 로그 기록

## 검증 기준

- AsyncLocalStorage 기반 테넌트 컨텍스트 정상 전파
- RLS 래퍼가 모든 쿼리에 tenant_id 조건 자동 추가
- 테넌트별 암호화/복호화 왕복 검증
- 교차 테넌트 접근 차단 확인
- 전체 테스트 PASS

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
