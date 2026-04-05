# MTU-P17: 테넌트 포털 — Design 문서

> **문서 ID**: DESIGN-MTU-P17 | **복잡도**: HIGH | **작성일**: 2026-04-05
> **Plan 참조**: PLAN-MTU-P17 | **의존**: MTU-P05~P08, MTU-U1-P

## 1. Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 테넌트 셀프서비스 포털 (구독, 서비스 실행, 마켓플레이스) |
| 기술 | Next.js 15, MTU-U1-P 테넌트 컴포넌트 활용 |
| 보안 | 테넌트 격리, RBAC (TENANT_ADMIN, USER) |
| 운영 | 서비스 구독/해지, 사용량 확인, AI 대화 |

## 2. 페이지 구조

| 경로 | 설명 |
|------|------|
| /tenant/dashboard | 테넌트 대시보드 |
| /tenant/services | 구독 서비스 허브 |
| /tenant/marketplace | 서비스 마켓플레이스 |
| /tenant/users | 사용자 관리 |
| /tenant/settings | 테넌트 설정 |
| /tenant/ai | AI 대화 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
