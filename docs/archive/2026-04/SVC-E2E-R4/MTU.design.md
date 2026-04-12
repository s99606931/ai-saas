# Design: SVC-E2E-R4 -- 서비스 간 E2E 통합 테스트 설계

> 작성일: 2026-04-09 | 버전: 1.0 | 작성자: PM Lead
> Plan: docs/01-plan/mtus/SVC-E2E-R4.plan.md

---

## Design Anchor

- **결정**: 각 서비스 Fastify inject 기반 통합 테스트 (실제 네트워크 없이)
- **구조**: platform/tests/e2e/ 또는 각 서비스 tests/integration/ 내 추가
- **패턴**: 기존 서비스 테스트 패턴 재활용, 서비스 간 인터페이스 검증 강화

## 테스트 배치

- api-gateway: Gateway 보안 + 라우팅 + Circuit Breaker 심화 테스트
- auth-service: MFA 완전 플로우 + 세션 관리 심화
- 각 서비스: X-Response-Time 헤더 + 보안 헤더 검증
- 크로스서비스: 테넌트 ID 전파 패턴 검증
