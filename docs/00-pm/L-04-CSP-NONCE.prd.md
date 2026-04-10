# PRD: L-04 -- CSP unsafe-inline 제거, nonce 기반 전환

> 작성일: 2026-04-10 | 버전: 1.0

## WHY
next.config.ts의 CSP에 'unsafe-inline'이 포함되어 인라인 스크립트 실행 허용.
XSS 공격 시 공격자의 인라인 스크립트도 실행 가능 (OWASP A07:2021).
CSAP D-12 시스템 개발 보안 CSP 강화 요구.

## SUCCESS
- FR-L04.1: middleware.ts에서 crypto nonce 생성
- FR-L04.2: CSP script-src에서 unsafe-inline -> nonce 전환
- FR-L04.3: style-src unsafe-inline은 유지 (CSS-in-JS 필수)
- FR-L04.4: Next.js Script 컴포넌트에 nonce 전달
