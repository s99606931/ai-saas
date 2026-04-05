# MTU-P11: 알림 서비스 -- Design 문서

> **문서 ID**: DESIGN-MTU-P11 | **버전**: 1.0.0 | **작성일**: 2026-04-05

## 아키텍처

```
API Gateway (/api/v1/notification) → notification-service (port 3010)
                                          ↓
                                      PostgreSQL (Notification 모델)
                                          ↓
                                      이메일/인앱 발송
```

## API 설계

| Method | Path | FR | 설명 |
|--------|------|-----|------|
| GET | /notification/templates | FR-P11.1 | 템플릿 목록 |
| POST | /notification/templates | FR-P11.1 | 템플릿 생성 |
| PUT | /notification/templates/:id | FR-P11.1 | 템플릿 수정 |
| POST | /notification/send | FR-P11.2 | 알림 발송 |
| GET | /notification/user/:userId | FR-P11.3 | 사용자 알림 조회 |
| PUT | /notification/:id/read | FR-P11.3 | 읽음 처리 |
| GET | /notification/history | FR-P11.5 | 발송 이력 |

## 데이터 모델

- `Notification`: id, tenantId?, userId?, channel, subject, body, status, sentAt

## 보안 매핑

| CSAP | 구현 |
|------|------|
| D-06 | 발송 이력 감사 로그 |
