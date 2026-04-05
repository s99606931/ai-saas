# MTU-P16b: 관리자 포털 완전체 — Design 문서

> **문서 ID**: DESIGN-MTU-P16b | **복잡도**: HIGH | **작성일**: 2026-04-05
> **Plan 참조**: PLAN-MTU-P16b | **의존**: MTU-P16a, MTU-P09~P15

## 1. Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | P09~P15 서비스 통합으로 전체 관리 기능 완비 |
| 기술 | Next.js 15, MTU-P16a 확장 |
| 보안 | CRM/AI/보안 모니터링 RBAC |
| 운영 | CSAP/N2SF 준수 현황, 감사 로그, 보안 알림 |

## 2. 추가 페이지 구조

| 경로 | 서비스 | 설명 |
|------|--------|------|
| /admin/crm | P09 | CRM 대시보드 |
| /admin/ai | P10 | AI 서비스 관리 |
| /admin/notifications | P11 | 알림 관리 |
| /admin/files | P12 | 파일 관리 |
| /admin/audit | P13 | 감사 로그 |
| /admin/compliance | P14 | CSAP/N2SF 준수 |
| /admin/security | P15 | 보안 모니터링 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
