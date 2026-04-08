# MTU-Q2: 알림 서비스 품질 보완 -- Design 문서

> **문서 ID**: DESIGN-MTU-Q2
> **참조 Plan**: PLAN-MTU-Q2
> **버전**: 1.0.0
> **작성일**: 2026-04-06
> **작성자**: PM Agent

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| **템플릿** | Notification 모델의 subject/body에 Mustache 변수 치환 패턴 적용 |
| **웹훅** | HTTP POST 발송, URL 검증 (SSRF 방지), 재시도 3회 |
| **이벤트 버스** | Node.js EventEmitter 기반 인메모리 (단일 인스턴스) |
| **인앱 알림** | REST 폴링 기반 (기존 GET /notification/user/:userId 활용) |

---

## 1. FR-P11.1: 알림 템플릿

### 데이터 모델 (Prisma 확장 불필요 - 인메모리 관리)

```typescript
interface NotificationTemplate {
  id: string;
  name: string;           // 예: 'user_welcome', 'subscription_expiry'
  channel: 'email' | 'in-app' | 'webhook';
  subject: string;        // Mustache: "{{userName}}님 환영합니다"
  body: string;           // Mustache: "{{tenantName}} 플랫폼에..."
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /notification/templates | 템플릿 생성 |
| GET | /notification/templates | 템플릿 목록 조회 |
| GET | /notification/templates/:id | 템플릿 상세 |
| PUT | /notification/templates/:id | 템플릿 수정 |
| DELETE | /notification/templates/:id | 템플릿 삭제 |
| POST | /notification/send-template | 템플릿 기반 발송 |

---

## 2. FR-P11.3: 웹훅 채널

### 발송 흐름

```
sendNotification(channel='webhook')
  -> URL 검증 (SSRF 방지: 내부 IP 차단)
  -> HTTP POST {subject, body, metadata}
  -> 실패 시 재시도 (최대 3회, 지수 백오프)
  -> 결과 기록 (status: sent/failed)
```

### SSRF 방지 규칙

- localhost, 127.0.0.1, 10.*, 172.16-31.*, 192.168.* 차단
- HTTPS만 허용 (운영 환경)
- 타임아웃: 5초

---

## 3. FR-P11.4: 이벤트 트리거

### 이벤트 버스 설계

```typescript
// 이벤트 타입 정의
type NotificationEvent =
  | { type: 'user.created'; payload: { userId: string; email: string; tenantId: string } }
  | { type: 'subscription.expiry'; payload: { tenantId: string; daysLeft: number } }
  | { type: 'security.alert'; payload: { type: string; ip: string; tenantId: string } };

// 구독 등록
eventBus.on('user.created', async (payload) => {
  await sendFromTemplate('user_welcome', 'email', payload);
});
```

---

## Session Guide

1. template.handler.ts 생성 (인메모리 CRUD)
2. webhook-sender.ts 생성 (HTTP POST + SSRF 방지)
3. event-bus.ts 생성 (EventEmitter 래퍼)
4. routes.ts 업데이트 (템플릿 라우트 추가)
5. notification.handler.ts 업데이트 (웹훅 채널 + 템플릿 발송)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | Design 작성 | PM Agent |
