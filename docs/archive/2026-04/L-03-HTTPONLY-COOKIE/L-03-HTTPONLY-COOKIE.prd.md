# PRD: L-03 -- localStorage accessToken -> HttpOnly 쿠키 전환

> 작성일: 2026-04-10 | 버전: 1.0

## WHY
portal의 감사 로그 유틸리티(audit.ts)에서 localStorage에 accessToken을
저장하여 사용. XSS 취약점 발생 시 토큰 탈취 가능 (OWASP A07:2021).
CSAP D-08-04 세션 관리 요건 위반 가능성.

## WHO
- 사용자: 토큰 보안 강화 (XSS 공격 시 토큰 보호)
- 감리: CSAP D-08-04 세션 관리 준수

## RISK
- HttpOnly 쿠키는 JavaScript에서 접근 불가 -> 기존 감사 로그의
  Authorization 헤더 직접 설정 불가
- CSRF 공격 벡터 추가 (SameSite + Double Submit으로 방어)

## SUCCESS
- FR-L03.1: auth-service 로그인 응답에 Set-Cookie 헤더 추가
- FR-L03.2: portal audit.ts에서 localStorage 제거, credentials: 'include' 사용
- FR-L03.3: api-gateway에서 쿠키 기반 토큰 추출 지원 추가

## SCOPE
- IN: auth-service 쿠키 설정, portal audit.ts 수정, api-gateway 쿠키 파싱
- OUT: 전체 인증 아키텍처 재설계 (점진적 전환)
