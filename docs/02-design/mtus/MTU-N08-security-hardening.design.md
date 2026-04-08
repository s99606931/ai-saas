# Design: MTU-N08 보안 강화 심화

> 작성일: 2026-04-08 | 작성자: PM Lead | 버전: 1.0
> Plan: docs/01-plan/mtus/MTU-N08-security-hardening.plan.md

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-08/D-10/D-12 통제항목 보안 갭 제거 |
| 기술 | OWASP Top 10 기반 6개 범주 취약점 코드 수정 |
| 보안 | 테넌트 격리 5개 서비스 보강, 감사 로그 2개 핸들러 추가 |
| 운영 | 기존 테스트 회귀 0건 |

## 아키텍처 옵션 분석

### Option A: 서비스 레벨 개별 수정 (Pragmatic Balance) -- 선택

서비스별 핸들러에서 JWT 클레임 기반 테넌트 격리 + 감사 로그 보강을 직접 구현.

- **장점**: 즉시 적용, 서비스별 독립 배포 가능, 기존 코드 최소 변경
- **단점**: 각 서비스별 유사 패턴 반복
- **위험**: 낮음 (검증된 패턴 재활용)

### Option B: 공통 미들웨어 추출

테넌트 격리 로직을 `@public-saas/auth-sdk`에 공통 미들웨어로 추출.

- **장점**: DRY 원칙, 한 곳에서 관리
- **단점**: 기존 SDK 변경 → 전체 서비스 재빌드 필요
- **위험**: 중간 (의존성 파급)

### Option C: API 게이트웨이 레벨 일괄 적용

게이트웨이에서 모든 테넌트 격리를 처리.

- **장점**: 서비스 코드 변경 없음
- **단점**: 서비스 직접 접근 시 무방비, 세밀한 비즈니스 로직 적용 불가
- **위험**: 높음 (내부 네트워크 접근 시 우회 가능)

**선택: Option A** - 이미 user-service, file-service, notification-service에서 검증된 패턴을 나머지 서비스에 적용.

## Session Guide

이 설계를 구현할 때 다음 순서를 따라주세요:

1. CRM 서비스 (crm.handler.ts) 테넌트 격리 추가
2. Billing 서비스 (billing.handler.ts) 테넌트 격리 추가
3. Subscription 서비스 (subscription.handler.ts) 테넌트 격리 강화
4. Menu 서비스 (menu.handler.ts) JWT 기반 테넌트 격리 강화
5. Catalog 서비스 (catalog.handler.ts) 감사 로그 보강
6. 전체 테스트 실행하여 회귀 확인

## Design Anchor

### 테넌트 격리 패턴 (CSAP D-08-05)

```typescript
// 표준 패턴: JWT 클레임 기반 테넌트 격리
const jwtTenantId = request.headers['x-user-tenant-id'] as string | undefined;
const jwtRole = request.headers['x-user-role'] as string | undefined;

// SUPER_ADMIN만 교차 테넌트 접근 허용
if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId && resource.tenantId !== jwtTenantId) {
  reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' } });
  return;
}
```

### 수정 대상 서비스별 상세

| 서비스 | 핸들러 | 수정 내용 |
|--------|--------|----------|
| crm-service | listCustomers | JWT 기반 테넌트 필터 추가 |
| crm-service | getCustomer | 테넌트 격리 검사 추가 |
| crm-service | updateCustomer | 사전 테넌트 확인 + 격리 검사 |
| billing-service | listInvoices | 구독→테넌트 기반 필터 추가 |
| billing-service | getInvoice | 구독→테넌트 격리 검사 |
| billing-service | payInvoice | 결제 전 테넌트 소유 확인 |
| subscription-service | getTenantSubscription | 파라미터 vs JWT 테넌트 검증 |
| subscription-service | upgrade/downgrade/cancel | 구독 소유 테넌트 확인 |
| menu-service | getMenuTree | 쿼리→JWT 기반 강제 격리 |
| menu-service | getFilteredMenu | 쿼리→JWT 기반 강제 격리 |
| menu-service | deleteMenu | 테넌트 소유 확인 |
| catalog-service | deleteService | 감사 로그 추가 |
| catalog-service | updateService | 감사 로그 추가 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-08 | 최초 작성 | PM Lead |
