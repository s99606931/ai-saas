# PRD: L-01 -- Rate Limit 미들웨어 공유 패키지화

> 작성일: 2026-04-10 | 버전: 1.0

## WHY
8개 서비스(file, menu, notification, catalog, compliance, security-monitor, user, auth)에
동일한 Rate Limiting 미들웨어가 복사되어 있음. 유지보수 비용 증가, 버그 수정 시
8곳 동시 수정 필요. Dead code 정책 위반(중복 코드).

## WHO
- 개발팀: 단일 패키지 수정으로 전 서비스 반영
- 운영팀: 통일된 Rate Limiting 정책 적용
- 감리: 코드 중복 제거 — 코드 품질 G3 게이트

## RISK
- 기존 서비스 동작 변경 없이 패키지 교체 필요 (회귀 위험)
- auth-service는 별도 Redis 클라이언트 사용 (인터페이스 차이)

## SUCCESS
- FR-L01.1: @public-saas/rate-limit 패키지 생성
- FR-L01.2: 7개 서비스 중복 코드 제거 → 패키지 import 교체
- FR-L01.3: auth-service는 기존 인터페이스 유지 (호환 어댑터)
- FR-L01.4: 기존 테스트 전체 통과

## SCOPE
- IN: 패키지 생성, 7개 서비스 중복 제거
- OUT: auth-service 완전 전환 (별도 Redis 클라이언트 의존)
