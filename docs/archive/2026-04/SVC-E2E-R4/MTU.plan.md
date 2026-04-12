# Plan: SVC-E2E-R4 -- 서비스 간 E2E 통합 테스트 + 보안 강화

> 작성일: 2026-04-09 | 버전: 1.0 | 작성자: PM Lead

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 서비스 간 통합 동작 검증으로 프로덕션 안정성 확보 |
| 기술 | API Gateway 기반 인증 플로우, Circuit Breaker, 서비스 헬스 |
| 보안 | CSAP D-08 MFA 검증, API 키 순환, RBAC 세분화 |
| 운영 | Circuit Breaker 동작 검증, 서비스 장애 시 복원력 |

## Context Anchor

- **WHY**: 개별 서비스 테스트는 1,200건 통과하나 서비스 간 통합 검증 부재
- **WHO**: SRE 운영팀, 보안 감사관, QA 팀
- **RISK**: 서비스 간 인터페이스 불일치, Circuit Breaker 미동작, 인증 우회
- **SUCCESS**: FR-E2E.1~E2E.5 전체 구현 + 50건+ 테스트 PASS

---

## 기능 요구사항

### FR-E2E.1: API Gateway 인증 플로우 E2E

- api-gateway -> auth-service 인증 토큰 검증 시뮬레이션
- JWT 토큰 생성 -> API Gateway 라우팅 -> 하위 서비스 접근
- 만료 토큰, 잘못된 토큰, 미인증 요청 처리

### FR-E2E.2: Circuit Breaker 통합 검증

- 서비스 다운 시 Circuit Breaker OPEN 상태 전환
- Half-Open 상태에서 복구 시도
- Circuit Breaker 상태 모니터링 API 검증

### FR-E2E.3: 보안 헤더 + CORS 검증

- 모든 서비스 보안 응답 헤더 확인
- X-Response-Time 포함 확인 (Round 3-A 결과)
- CORS 정책 준수 확인

### FR-E2E.4: 서비스 헬스 체인 검증

- api-gateway /health/services 엔드포인트 전체 서비스 상태
- 개별 서비스 /health, /ready 엔드포인트

### FR-E2E.5: 테넌트 격리 크로스서비스 검증

- 여러 서비스에 걸친 테넌트 격리 검증
- X-Tenant-Id 전파 확인
