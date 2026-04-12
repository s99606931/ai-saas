# Plan: L-03 -- localStorage accessToken -> HttpOnly 쿠키 전환

> 작성일: 2026-04-10 | 버전: 1.0

## 기능 요구사항

### FR-L03.1: auth-service 쿠키 설정
- POST /auth/login 응답에 Set-Cookie 헤더 추가
  - accessToken: HttpOnly, Secure, SameSite=Strict, Path=/
  - refreshToken: HttpOnly, Secure, SameSite=Strict, Path=/auth/refresh
- POST /auth/logout 시 쿠키 만료 설정

### FR-L03.2: portal audit.ts localStorage 제거
- getAccessToken()에서 localStorage.getItem 제거
- fetch 호출에 credentials: 'include' 추가
- 서버 컴포넌트에서는 쿠키에서 직접 읽기 (next/headers)

### FR-L03.3: api-gateway 쿠키 기반 토큰 추출
- 요청 헤더에 Authorization이 없으면 쿠키에서 accessToken 추출
- 기존 헤더 기반 인증도 유지 (하위 호환성)

## 변경 파일
- `platform/services/auth-service/src/handlers/login.handler.ts` (수정)
- `platform/apps/portal/src/lib/audit.ts` (수정)
- `platform/services/api-gateway/src/index.ts` (수정)
