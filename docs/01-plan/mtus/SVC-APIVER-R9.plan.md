# SVC-APIVER-R9 Plan -- API 버전 관리 (v1/v2 라우팅)

> Plan SC: FR-APIVER.1~FR-APIVER.4
> CSAP: D-12 시스템 개발 보안
> Phase: Round 9

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-09 | 초기 작성 | PM (Claude) |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 사업 | API 하위 호환성 보장, 점진적 업그레이드 지원 |
| 기술 | @public-saas/api-version 공유 패키지, URL 기반 버전 라우팅 |
| 보안 | 구 버전 API 모니터링, 자동 감사 로그 |
| 품질 | 버전 네고시에이션, deprecated 경고 헤더 |

## Context Anchor

- **WHY**: 서비스 고도화 중 API 스펙 변경 필요 시 기존 클라이언트 호환성 유지
- **WHO**: API 소비자, 프론트엔드 개발자, 모바일 앱
- **RISK**: 버전 없는 API 변경 시 기존 클라이언트 장애
- **SUCCESS**: 버전 관리 패키지 생성 + 테스트 통과
- **SCOPE**: api-gateway에서 버전 라우팅 + 서비스별 버전 핸들러 지원

## 요구사항

| FR ID | 내용 | CSAP |
|-------|------|------|
| FR-APIVER.1 | @public-saas/api-version 공유 패키지 생성 | D-12 |
| FR-APIVER.2 | URL 기반 버전 라우팅 (/v1/..., /v2/...) | D-12 |
| FR-APIVER.3 | Deprecated 버전 경고 헤더 (Sunset, Deprecation) | D-12 |
| FR-APIVER.4 | 버전별 라우트 등록 헬퍼 | D-12 |
