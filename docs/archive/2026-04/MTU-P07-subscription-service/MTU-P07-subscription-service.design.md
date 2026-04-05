# MTU-P07: 구독 관리 서비스 -- Design 문서

> **문서 ID**: DESIGN-MTU-P07 | **버전**: 1.0.0 | **작성일**: 2026-04-05

## 아키텍처

```
API Gateway (/api/v1/subscription) → subscription-service (port 3006)
                                          ↓
                                      PostgreSQL (Plan, PlanService, Subscription 모델)
```

## API 설계

| Method | Path | FR | 설명 |
|--------|------|-----|------|
| GET | /subscription/plans | FR-P07.1 | 플랜 목록 조회 |
| POST | /subscription/plans | FR-P07.1 | 플랜 생성 |
| PUT | /subscription/plans/:id | FR-P07.1 | 플랜 수정 |
| POST | /subscription/subscribe | FR-P07.2 | 구독 생성 |
| GET | /subscription/tenants/:tenantId | FR-P07.2 | 테넌트 구독 조회 |
| PUT | /subscription/:id/upgrade | FR-P07.4 | 업그레이드 |
| PUT | /subscription/:id/downgrade | FR-P07.4 | 다운그레이드 |
| POST | /subscription/:id/cancel | FR-P07.2 | 구독 취소 |
| GET | /subscription/:id/usage | FR-P07.3 | 사용량 조회 |

## 데이터 모델

- `Plan`: id, name, slug, price, currency, interval, maxUsers, maxStorage, isActive
- `PlanService`: planId, serviceId (N:M 연결)
- `Subscription`: id, tenantId, planId, status, currentPeriodStart/End, canceledAt

## 보안 매핑

| CSAP | 구현 |
|------|------|
| D-08 | 테넌트별 구독 격리 |
| D-06 | 구독 상태 변경 감사 로그 |
