# Design: L-03 -- localStorage accessToken -> HttpOnly 쿠키 전환

> 작성일: 2026-04-10 | 버전: 1.0

## 1. 쿠키 설정 규격 (FR-L03.1)

```
Set-Cookie: accessToken={jwt}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
Set-Cookie: refreshToken={jwt}; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=604800
```

- HttpOnly: JavaScript 접근 차단 (XSS 방어)
- Secure: HTTPS 전용 (개발 환경에서는 NODE_ENV=production 시만)
- SameSite=Strict: CSRF 1차 방어
- Path 제한: refreshToken은 /auth/refresh에서만 전송

## 2. 인증 흐름 변경

```
Before: 클라이언트 -> fetch(Authorization: Bearer {localStorage.token}) -> API
After:  클라이언트 -> fetch(credentials: 'include') -> Cookie 자동 전송 -> API
```

## 3. api-gateway 토큰 추출 우선순위

```
1. Authorization: Bearer {token} (기존 호환)
2. Cookie: accessToken={token} (신규)
3. 둘 다 없으면 -> 401
```

## 4. 하위 호환성
- 응답 바디의 accessToken/refreshToken 필드는 유지 (모바일/API 클라이언트)
- 쿠키 설정은 추가 (기존 동작 변경 없음)
