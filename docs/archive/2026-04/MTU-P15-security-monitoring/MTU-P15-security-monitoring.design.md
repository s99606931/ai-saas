# MTU-P15: 보안 모니터링 — Design 문서

> **문서 ID**: DESIGN-MTU-P15 | **복잡도**: MED | **작성일**: 2026-04-05
> **Plan 참조**: PLAN-MTU-P15 | **CSAP**: D-06, D-10

## 1. Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 이상 접근 탐지, 로그인 실패 알림, 보안 이벤트 모니터링 |
| 기술 | Fastify 5, AuditLog 분석 기반 이상 탐지 |
| 보안 | IP 차단 목록, 로그인 실패 임계값 (5회/5분) |
| 운영 | 보안 이벤트 알림 연동 (notification-service) |

## 2. API 엔드포인트

| 메서드 | 경로 | FR | 설명 |
|--------|------|-----|------|
| GET | /security/login-failures | FR-P15.1 | 로그인 실패 패턴 탐지 |
| GET | /security/anomalies | FR-P15.2 | 이상 접근 패턴 탐지 |
| GET | /security/ip-blocklist | FR-P15.3 | IP 차단 목록 조회 |
| POST | /security/ip-blocklist | FR-P15.3 | IP 차단 등록 |
| DELETE | /security/ip-blocklist/:ip | FR-P15.3 | IP 차단 해제 |
| GET | /security/alerts | FR-P15.4 | 보안 이벤트 알림 목록 |

## 3. Design Anchor

- 로그인 실패 임계값: 5회/5분 → 자동 알림
- 이상 접근: 동시 다중 IP 로그인, 비정상 시간대 접근, 단시간 대량 요청
- IP 차단: In-memory Map + 영속 저장 (향후 Redis 전환 가능)
- 보안 알림: severity (low/medium/high/critical)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
