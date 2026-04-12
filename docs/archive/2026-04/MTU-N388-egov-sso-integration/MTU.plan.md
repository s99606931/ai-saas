# MTU-N388: 행안부 전자정부 통합 SSO 연동

## 1. Executive Summary
| 관점 | 내용 |
|------|------|
| 비즈니스 | 행안부 전자정부 SSO 연계로 공무원 단일 인증 |
| 기술 | TypeScript strict, SAML/OIDC 어댑터 |
| 보안 | CSAP D-08, D-09 |
| 운영 | 멀티테넌시 |

## 2. Context Anchor
- **WHY**: 공무원 복수 시스템 로그인 피로 해소
- **WHO**: 공무원, 인증 관리자
- **RISK**: SAML assertion 위조 - 서명 검증 필수
- **SUCCESS**: SSO 1회 로그인으로 SaaS 접근
- **SCOPE**: SAML 요청 → 응답 검증 → 세션 생성

## 3. 기능 요구사항
- FR-N388.1 SAML AuthnRequest 생성
- FR-N388.2 Assertion 파싱
- FR-N388.3 서명 검증 로직
- FR-N388.4 세션 발급
- FR-N388.5 감사 로그

## 4. CSAP 매핑
D-08, D-09

## 5. 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초안 작성 | PM Agent |
