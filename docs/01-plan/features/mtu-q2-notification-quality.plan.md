# MTU-Q2: 알림 서비스 품질 보완 -- Plan 문서

> **문서 ID**: PLAN-MTU-Q2
> **참조 MTU**: MTU-P11 (알림 서비스)
> **버전**: 1.0.0
> **작성일**: 2026-04-06
> **목표**: 매치율 80% -> 90%+ (미구현 FR 3건 보완)
> **작성자**: PM Agent

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **비즈니스** | 알림 템플릿 관리, 웹훅 발송, 경량 이벤트 트리거로 알림 기능 완성도 향상 |
| **기술** | 알림 템플릿 CRUD, 웹훅 HTTP 발송, 인메모리 이벤트 버스 |
| **보안** | CSAP D-06 감사 추적, 웹훅 URL 검증 (SSRF 방지) |
| **감리** | FR-P11.1, FR-P11.3, FR-P11.4 보완으로 전체 FR 90%+ 달성 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 알림 서비스 매치율 80%로 품질 기준 미달. 템플릿/이벤트 트리거 미구현 |
| **WHO** | 플랫폼 운영자 (템플릿 관리), 테넌트 관리자 (웹훅 설정) |
| **RISK** | R1: 이벤트 트리거 미구현 -> 알림 자동화 불가, R2: 템플릿 없이 운영 비효율 |
| **SUCCESS** | 4/5 FR PASS (FR-P11.4 BullMQ는 경량 대체), 매치율 90%+ |
| **SCOPE** | FR-P11.1 템플릿, FR-P11.3 웹훅 채널 추가, FR-P11.4 경량 이벤트 트리거 |

---

## 보완 대상 FR

| FR ID | 요구사항 | 현재 상태 | 보완 내용 |
|-------|---------|----------|---------|
| FR-P11.1 | 알림 템플릿 CRUD | PARTIAL | NotificationTemplate 핸들러 추가 (DB 저장) |
| FR-P11.3 | 인앱 알림 (WebSocket) | PARTIAL | 웹훅 HTTP 발송 채널 추가 + SSE 폴링 기반 인앱 |
| FR-P11.4 | 이벤트 구독 트리거 | DEFER | 인메모리 EventEmitter 기반 경량 이벤트 버스 (BullMQ 대체) |

---

## 산출물

| 번호 | 산출물 | 경로 |
|------|--------|------|
| 1 | 템플릿 핸들러 | platform/services/notification-service/src/handlers/template.handler.ts |
| 2 | 웹훅 발송기 | platform/services/notification-service/src/lib/webhook-sender.ts |
| 3 | 이벤트 버스 | platform/services/notification-service/src/lib/event-bus.ts |
| 4 | 라우트 업데이트 | platform/services/notification-service/src/routes.ts |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 품질 보완 Plan 작성 | PM Agent |
