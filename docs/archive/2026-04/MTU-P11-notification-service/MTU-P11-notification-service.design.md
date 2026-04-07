# MTU-P11: 알림 서비스 -- Design 문서 (v2.0 품질 강화)

> **문서 ID**: DESIGN-MTU-P11
> **Plan 참조**: PLAN-MTU-P11
> **버전**: 2.0.0
> **작성일**: 2026-04-07
> **복잡도**: MED
> **아키텍처**: Option B -- Pragmatic Balance
> **작성자**: PM Agent

---

## Design Anchor

| Plan FR | 설계 결정 | 근거 |
|---------|---------|------|
| FR-P11.1 | 인메모리 템플릿 저장소 + Mustache 변수 치환 | 단일 인스턴스 경량 구현, DB 전환 용이 |
| FR-P11.2 | 멀티채널 발송 (email/in-app/sms/webhook) | 공공기관 다양한 알림 요구 대응 |
| FR-P11.3 | REST API + RBAC | 본인/관리자 알림 조회 제한 (CSAP D-08-05) |
| FR-P11.4 | EventEmitter 기반 이벤트 버스 | BullMQ 대체 경량 구현, 인터페이스 호환 |
| FR-P11.5 | Prisma 기반 이력 저장 + Zod 필터 검증 | channel/status enum 안전 검증 |

---

## 1. 서비스 아키텍처

```
notification-service/ (Fastify 5, 포트: 3010)
├── src/
│   ├── index.ts                           # 서비스 진입점 + 이벤트 핸들러 등록
│   ├── handlers/
│   │   ├── notification.handler.ts        # 알림 발송/조회/이력 (FR-P11.2/3/5)
│   │   └── template.handler.ts            # 템플릿 CRUD + Mustache (FR-P11.1)
│   ├── lib/
│   │   ├── audit.ts                       # audit-sdk 연동 (CSAP D-06)
│   │   ├── event-bus.ts                   # 이벤트 버스 (FR-P11.4)
│   │   ├── prisma.ts                      # DB 클라이언트
│   │   └── webhook-sender.ts             # 웹훅 HTTP 발송
│   └── routes.ts                          # 라우트 등록
├── package.json
└── tsconfig.json
```

---

## 2. API 설계

| Method | Path | FR | 설명 | 권한 |
|--------|------|-----|------|------|
| POST | /notification/send | FR-P11.2 | 직접 알림 발송 | 인증 필요 |
| POST | /notification/send-template | FR-P11.1 | 템플릿 기반 발송 | 인증 필요 |
| GET | /notification/user/:userId | FR-P11.3 | 사용자 알림 조회 | 본인/관리자 |
| PUT | /notification/:id/read | FR-P11.3 | 읽음 처리 | 본인/관리자 |
| GET | /notification/history | FR-P11.5 | 발송 이력 조회 | 인증 필요 |
| POST | /notification/templates | FR-P11.1 | 템플릿 생성 | 인증 필요 |
| GET | /notification/templates | FR-P11.1 | 템플릿 목록 | 인증 필요 |
| GET | /notification/templates/:id | FR-P11.1 | 템플릿 상세 | 인증 필요 |
| PUT | /notification/templates/:id | FR-P11.1 | 템플릿 수정 | 인증 필요 |
| DELETE | /notification/templates/:id | FR-P11.1 | 템플릿 삭제 | 인증 필요 |

---

## 3. 데이터 모델

### Notification (Prisma)
- id, tenantId?, userId?, channel, subject, body, status, sentAt, createdAt

### NotificationTemplate (인메모리)
- id, name, channel, subject, body, isActive, createdAt, updatedAt

---

## 4. 이벤트 버스 설계 (FR-P11.4)

```
NotificationEventBus (EventEmitter 래퍼)
├── 이벤트 타입: user.created, user.deactivated, subscription.created,
│   subscription.expiry_warning, security.login_failure,
│   security.account_locked, compliance.check_completed
├── 기본 핸들러: user.created -> 환영 알림
│                security.account_locked -> 보안 알림
│                subscription.expiry_warning -> 만료 알림
└── 확장: BullMQ 교체 시 동일 인터페이스 유지
```

---

## 5. 보안 매핑

| CSAP ID | 항목 | 구현 방법 |
|---------|------|---------|
| D-06 | 감사 로그 | audit-sdk createAuditLogger + createStandardTransport |
| D-08-05 | 접근 통제 | getUserNotifications: 본인/관리자 RBAC |
| D-08 | 내부 인증 | INTERNAL_SERVICE_KEY 헤더 검증 (심층 방어) |
| D-12 | 입력 검증 | Zod 스키마 전체 적용 (발송, 템플릿, 이력 조회) |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
| 2.0.0 | 2026-04-07 | 품질 강화: 전체 구현 반영, 이벤트 버스/템플릿/보안 설계 보완 | PM Agent |
