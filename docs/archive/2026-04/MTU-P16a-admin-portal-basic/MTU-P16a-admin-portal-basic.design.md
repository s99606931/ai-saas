# MTU-P16a: 관리자 포털 기본 기능 — Design 문서

> **문서 ID**: DESIGN-MTU-P16a | **복잡도**: HIGH | **작성일**: 2026-04-05
> **Plan 참조**: PLAN-MTU-P16a | **의존**: MTU-P01~P08, MTU-U1-P

## 1. Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | P01~P08 서비스를 웹 포털에서 운영 |
| 기술 | Next.js 15 App Router, MTU-U1-P 컴포넌트 활용 |
| 보안 | RBAC (SUPER_ADMIN, TENANT_ADMIN만 접근) |
| 운영 | 테넌트/사용자/구독/빌링/메뉴/카탈로그 관리 |

## 2. 페이지 구조

| 경로 | 서비스 | 설명 |
|------|--------|------|
| /admin/dashboard | - | 관리자 대시보드 |
| /admin/tenants | P03 | 테넌트 목록/등록/상세 |
| /admin/users | P02 | 사용자 목록/역할 관리 |
| /admin/subscriptions | P07 | 구독 관리 |
| /admin/billing | P08 | 빌링 대시보드 |
| /admin/catalog | P06 | 서비스 카탈로그 |
| /admin/menus | P05 | 메뉴 관리 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
