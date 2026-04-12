# SVC-HTTPSEC-R38 Plan: HTTP Security Headers

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## WHY
OWASP Top 10 및 CSAP D-12 부합 위해 CORS, CSP, HSTS, X-Frame-Options 등 표준 보안 헤더를 단일 유틸로 관리.

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-HS.1 | CORS 정책 평가 (origin, methods, headers, credentials) | P0 |
| FR-HS.2 | CSP (Content-Security-Policy) 헤더 생성 | P0 |
| FR-HS.3 | HSTS (Strict-Transport-Security) 설정 | P0 |
| FR-HS.4 | X-Frame-Options / X-Content-Type-Options / Referrer-Policy | P0 |
| FR-HS.5 | Preflight OPTIONS 응답 처리 | P0 |
| FR-HS.6 | 헤더 세트 일괄 적용 API | P1 |

## CSAP/N2SF
- CSAP D-12: 개발보안 (XSS, Clickjacking, MIME sniffing 방지)
- OWASP A05:2021 보안 구성 오류
