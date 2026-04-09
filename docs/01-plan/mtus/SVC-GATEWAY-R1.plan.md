# Plan: api-gateway 라운드 1 고도화

> MTU ID: SVC-GATEWAY-R1
> 버전: 1.0.0 | 작성일: 2026-04-09
> PRD 참조: docs/00-pm/SVC-GATEWAY-R1.prd.md

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-10 네트워크 보안 강화, DoS 방어, 운영 안정성 |
| 기술 | IP 접근 제어, 페이로드 제한, CB 모니터링, 보안 헤더, 느린 요청 감지 |
| 보안 | IP 블랙리스트, 보안 응답 헤더, 요청 크기 제한 |
| 운영 | Circuit Breaker 상태 대시보드, 느린 요청 로깅 |

## 기능 요구사항

### FR-GW.1: IP 접근 제어

| 항목 | 내용 |
|------|------|
| ID | FR-GW.1 |
| 설명 | IP 기반 블랙리스트/화이트리스트 미들웨어 |
| CSAP | D-10 네트워크 보안 |

### FR-GW.2: 요청 페이로드 크기 제한

| 항목 | 내용 |
|------|------|
| ID | FR-GW.2 |
| 설명 | Content-Length 기반 요청 크기 제한 (기본 10MB) |
| CSAP | D-10 DoS 방어 |

### FR-GW.3: Circuit Breaker 모니터링 엔드포인트

| 항목 | 내용 |
|------|------|
| ID | FR-GW.3 |
| 설명 | GET /admin/circuits — 모든 서비스 CB 상태 조회 |
| CSAP | D-07 가용성 |

### FR-GW.4: 보안 응답 헤더

| 항목 | 내용 |
|------|------|
| ID | FR-GW.4 |
| 설명 | X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security 등 |
| CSAP | D-10 네트워크 보안 |

### FR-GW.5: 느린 요청 감지

| 항목 | 내용 |
|------|------|
| ID | FR-GW.5 |
| 설명 | 응답 5초 초과 시 SLOW_REQUEST 로그 기록 |
| CSAP | D-06 감사 로그 |

### FR-GW.6: 통합 테스트 강화

| 항목 | 내용 |
|------|------|
| ID | FR-GW.6 |
| 설명 | IP 접근 제어, 크기 제한, 보안 헤더 테스트 |
| CSAP | D-12 시스템 개발 보안 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM (Claude Opus) |
