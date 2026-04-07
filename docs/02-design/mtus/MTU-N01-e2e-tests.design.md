# MTU-N01: E2E 통합 테스트 스위트 — Design 문서

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead
> **Plan 참조**: docs/01-plan/mtus/MTU-N01-e2e-tests.plan.md

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 비즈니스 | Vitest E2E 테스트로 CSAP D-12 통합시험 요건 100% 충족 |
| 기술 | Supertest 패턴 (Fastify inject) + Mock 서비스, 외부 의존 없음 |
| 보안 | JWT 토큰 Mocking + 테넌트 격리 + RBAC 검증 시나리오 |
| 운영 | pnpm test 통합, CI 파이프라인 자동 실행 |

---

## 1. 아키텍처 옵션 분석

### Option A: 실 서비스 기동 (Full Stack E2E)
- 장점: 실제 환경과 동일
- 단점: Docker Compose 필수, 테스트 시간 장시간, CI 리소스 과다

### Option B: Mock 서비스 기반 (Pragmatic E2E) [선택]
- 장점: 외부 의존 없음, 빠른 실행, CI 친화적
- 단점: 실 환경과 약간의 차이

### Option C: Contract Testing (Pact)
- 장점: 서비스 간 계약 보장
- 단점: 설정 복잡, 별도 Pact Broker 필요

**결정: Option B (Pragmatic Balance)** -- Mock 서비스로 핵심 통합 시나리오를 검증하되, 실 서비스 간 API 계약(스키마)을 정밀하게 검증.

---

## 2. 상세 설계

### 2.1 디렉토리 구조

```
platform/tests/e2e/
  helpers/
    mock-auth.ts        -- JWT 토큰 생성/검증 Mock
    mock-services.ts    -- 서비스 응답 Mock 팩토리
    test-client.ts      -- API 호출 헬퍼 (fetch wrapper)
  scenarios/
    auth-flow.e2e.test.ts          -- FR-N01.1
    tenant-lifecycle.e2e.test.ts   -- FR-N01.2
    user-management.e2e.test.ts    -- FR-N01.3
    gateway-routing.e2e.test.ts    -- FR-N01.4
    audit-trail.e2e.test.ts        -- FR-N01.5
    tenant-isolation.e2e.test.ts   -- FR-N01.8
    security-events.e2e.test.ts    -- FR-N01.9
    ai-data-grade.e2e.test.ts      -- FR-N01.11
  vitest.config.ts                 -- E2E 전용 vitest 설정
  package.json                     -- E2E 테스트 패키지
```

### 2.2 테스트 전략

#### 인증 Mock 설계 (mock-auth.ts)
```typescript
// JWT 토큰 생성 (jose 라이브러리 사용)
// 역할: SUPER_ADMIN, TENANT_ADMIN, USER, VIEWER
// 테넌트: tenantA, tenantB (격리 테스트용)
```

#### 서비스 Mock 설계 (mock-services.ts)
```typescript
// HTTP Mock (MSW 또는 직접 fetch mock)
// 각 서비스 /health 응답 Mock
// 각 서비스 핵심 API 응답 Mock
```

#### E2E 시나리오 목록

| 시나리오 | 검증 항목 | CSAP |
|---------|----------|------|
| 1. 인증 흐름 | 로그인 -> 토큰 발급 -> API 접근 -> 로그아웃 | D-08 |
| 2. 테넌트 수명주기 | 테넌트 생성 -> 사용자 할당 -> 구독 -> 비활성화 | D-08 |
| 3. 사용자 관리 | CRUD + 역할 변경 + 비밀번호 재설정 | D-08 |
| 4. 게이트웨이 라우팅 | 각 서비스 프록시 + 인증 검사 + Rate Limiting | D-10 |
| 5. 감사 추적 | 민감 작업 -> 감사 로그 기록 확인 | D-06 |
| 6. 테넌트 격리 | A 테넌트 데이터에 B 테넌트 접근 차단 확인 | D-08, N-03 |
| 7. 보안 이벤트 | 로그인 실패 반복 -> 보안 이벤트 발생 확인 | D-06, D-08 |
| 8. AI 데이터 등급 | C/S 등급 -> 차단, O 등급 -> 허용 | N-05 |

### 2.3 Session Guide

1. E2E 테스트 디렉토리 및 설정 파일 생성
2. 헬퍼 모듈 구현 (mock-auth, mock-services, test-client)
3. P1 시나리오 구현 (1, 2, 3, 4, 5, 6, 7, 8)
4. vitest 설정 및 패키지 등록
5. 전체 테스트 실행 확인

### 2.4 Design Anchor

- 모든 E2E 테스트는 `describe` 블록에 FR ID 표기
- 모든 테스트 파일 상단에 `// Design Ref: MTU-N01` + `// Plan SC: FR-N01.{번호}`
- 서비스 간 HTTP 호출은 Mock으로 처리 (실제 네트워크 I/O 없음)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
