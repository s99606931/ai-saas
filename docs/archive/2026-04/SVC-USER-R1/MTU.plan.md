# Plan: SVC-USER-R1 -- 사용자 서비스 고도화 라운드 1

> 작성일: 2026-04-09 | 버전: 1.0 | 작성자: PM Lead
> PRD: docs/00-pm/SVC-USER-R1.prd.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 사용자 관리 운영 효율성 향상 + CSAP D-08 완전 준수 |
| 기술 | 검색 API, Rate Limiting, HMAC 서비스 인증, 비밀번호 이력 |
| 보안 | D-08-07 비밀번호 재사용 방지, D-08-10 비활성 계정 관리 |
| 운영 | 비활성 계정 자동 감지, 관리자 현황 API |

## Context Anchor

- **WHY**: CSAP D-08 접근 통제 완전 준수 + 운영 관리 기능 부재 해소
- **WHO**: 테넌트 관리자, 시스템 관리자, 보안 감사관
- **RISK**: 비활성 계정 방치 → CSAP 지적, 서비스 간 무인증 → 내부 위장 공격
- **SUCCESS**: FR-USR.1~FR-USR.6 전체 구현 + 테스트 70건+ PASS
- **SCOPE**: 검색, 비활성 감지, Rate Limiting, HMAC 인증, 비밀번호 이력, 프로필 확장

---

## 기능 요구사항

### FR-USR.1: 사용자 검색 및 필터링

- 이름, 이메일 부분 일치 검색 (`LIKE %keyword%`)
- 역할별 필터링 (role=TENANT_ADMIN|USER|VIEWER|AUDITOR)
- 상태 필터링 (active|inactive|locked)
- 정렬 옵션 (name|email|createdAt|lastLoginAt, asc|desc)
- 기존 페이지네이션 유지
- CSAP D-08-05: 테넌트 격리 유지

### FR-USR.2: 비활성 계정 감지 API

- `GET /users/inactive` -- 기간 내 미로그인 사용자 목록
- 기본 90일 (환경 변수 `INACTIVE_THRESHOLD_DAYS`)
- 테넌트별 비활성 사용자 수 통계
- CSAP D-08-10: 계정 비활성화 관리

### FR-USR.3: Rate Limiting

- Redis 기반 고정 윈도우 알고리즘 (auth-service 패턴 재사용)
- 엔드포인트별 제한:
  - GET /users: 100 req/60s
  - POST /users: 10 req/60s
  - PUT /users/:id: 30 req/60s
  - DELETE /users/:id: 5 req/300s
  - 비밀번호 변경: 5 req/300s
  - 비밀번호 재설정 요청: 5 req/300s
- X-RateLimit-Limit/Remaining/Reset 헤더

### FR-USR.4: 서비스 간 HMAC 인증

- auth-service /sessions/invalidate 호출 시 HMAC-SHA256 토큰 첨부
- SERVICE_AUTH_SECRET 환경 변수 기반
- 기존 password.handler.ts, password-reset.handler.ts 보안 강화
- 토큰 형식: `{serviceName}:{timestamp}:{hmac}` (auth-service 호환)

### FR-USR.5: 비밀번호 이력 관리

- 최근 N개 비밀번호 해시 저장 (기본 5개, `PASSWORD_HISTORY_COUNT`)
- 비밀번호 변경 시 이력 비교 → 재사용 차단
- 비밀번호 재설정 시에도 이력 비교 적용
- CSAP D-08-07: 비밀번호 재사용 방지

### FR-USR.6: 사용자 프로필 메타데이터

- updateUserSchema에 department, position, phone 필드 추가
- PII 필드(phone): 감사 로그에 마스킹 기록
- 프로필 조회 시 추가 필드 반환

---

## 추적성 매트릭스

| FR ID | CSAP | 산출물 | 테스트 |
|-------|------|--------|--------|
| FR-USR.1 | D-08-05 | user.handler.ts | TC-USR-01~08 |
| FR-USR.2 | D-08-10 | inactive.handler.ts | TC-USR-09~14 |
| FR-USR.3 | D-10 | rate-limit.middleware.ts | TC-USR-15~20 |
| FR-USR.4 | D-08 | service-auth.ts | TC-USR-21~26 |
| FR-USR.5 | D-08-07 | password-history.ts | TC-USR-27~34 |
| FR-USR.6 | D-08-05 | user.handler.ts | TC-USR-35~40 |
