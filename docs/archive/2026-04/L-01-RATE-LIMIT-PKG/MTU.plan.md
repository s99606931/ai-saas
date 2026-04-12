# Plan: L-01 -- Rate Limit 미들웨어 공유 패키지화

> 작성일: 2026-04-10 | 버전: 1.0

## 기능 요구사항

### FR-L01.1: @public-saas/rate-limit 패키지 생성
- platform/packages/rate-limit/ 디렉토리 생성
- createRateLimiter 함수 export (기존과 동일 시그니처)
- RedisLike 인터페이스 export (외부 Redis 클라이언트 주입 가능)

### FR-L01.2: 7개 서비스 중복 코드 제거
- file-service, menu-service, notification-service, catalog-service,
  compliance-service, security-monitor-service, user-service
- 각 서비스의 src/middleware/rate-limit.middleware.ts 삭제
- routes.ts에서 import 경로를 @public-saas/rate-limit로 변경

### FR-L01.3: auth-service 호환
- auth-service는 별도 Redis 세션 클라이언트 사용
- 기존 rateLimitMiddleware 유지 (별도 인터페이스)
- 향후 전환 시 RedisLike 어댑터 사용 가능

### FR-L01.4: 테스트 통과
- 기존 934건+ 테스트 전체 통과
- 패키지 단위 테스트 추가

## 변경 파일
- `platform/packages/rate-limit/package.json` (신규)
- `platform/packages/rate-limit/tsconfig.json` (신규)
- `platform/packages/rate-limit/src/index.ts` (신규)
- 7개 서비스의 `src/middleware/rate-limit.middleware.ts` (삭제)
- 7개 서비스의 `src/routes.ts` (import 경로 변경)
- 7개 서비스의 `package.json` (의존성 추가)
