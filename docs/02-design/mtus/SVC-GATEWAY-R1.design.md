# Design: api-gateway 라운드 1 고도화

> MTU ID: SVC-GATEWAY-R1
> 버전: 1.0.0 | 작성일: 2026-04-09

---

## 1. FR-GW.1: IP 접근 제어 미들웨어

### 설계
- 신규 파일: `src/middleware/ip-filter.middleware.ts`
- 환경 변수: `IP_BLACKLIST` (쉼표 구분 IP 목록), `IP_WHITELIST` (관리자 전용)
- 화이트리스트 우선: 화이트리스트에 있으면 블랙리스트 무시
- 블랙리스트 IP → 403 응답 + 감사 로그

## 2. FR-GW.2: 요청 크기 제한

### 설계
- Fastify `bodyLimit` 옵션 활용 (기본 10MB = 10485760 바이트)
- 파일 서비스 전용 50MB 허용
- 413 Payload Too Large 응답

## 3. FR-GW.3: Circuit Breaker 모니터링

### 설계
- GET /admin/circuits 엔드포인트 추가
- SUPER_ADMIN 권한 필요
- POST /admin/circuits/:serviceId/reset — CB 수동 리셋

## 4. FR-GW.4: 보안 응답 헤더

### 설계
- 신규 파일: `src/plugins/security-headers.ts`
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security: max-age=31536000; includeSubDomains
- X-XSS-Protection: 0 (현대 브라우저는 CSP 사용)
- Content-Security-Policy: default-src 'self'
- Referrer-Policy: strict-origin-when-cross-origin

## 5. FR-GW.5: 느린 요청 감지

### 설계
- audit-logger.ts 수정: 응답 시간 5초 초과 시 SLOW_REQUEST 레벨 로그
- 환경 변수: `SLOW_REQUEST_THRESHOLD_MS` (기본 5000)

## 6. 파일 변경 목록

| 작업 | 파일 | FR |
|------|------|-----|
| 신규 | src/middleware/ip-filter.middleware.ts | FR-GW.1 |
| 신규 | src/plugins/security-headers.ts | FR-GW.4 |
| 수정 | src/index.ts | FR-GW.1~5 |
| 수정 | src/plugins/audit-logger.ts | FR-GW.5 |
| 신규 | tests/integration/gateway-security.test.ts | FR-GW.6 |
