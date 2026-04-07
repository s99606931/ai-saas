# 공공기관 SaaS 플랫폼 — API 라우트 맵
# Design Ref: DESIGN-MTU-P04 (API 게이트웨이)
# Plan SC: FR-P04.10 (OpenAPI 문서화)
# 생성일: 2026-04-07
# CSAP: D-12 시스템 개발 보안 — API 문서화

## OpenAPI / Swagger UI

- 개발 환경: http://localhost:3000/api/docs (자동 활성화)
- 운영 환경: ENABLE_SWAGGER=true 설정 시 활성화

## API 게이트웨이 라우팅 규칙

모든 API 요청은 API 게이트웨이(port 3000)를 경유합니다.

```
/api/v1/{serviceId}/* -> {서비스 내부 URL}/{경로}
/api/v1/plugins/{pluginId}/* -> 동적 서비스 라우팅
```

## 서비스별 엔드포인트 목록

### 1. auth-service (port 3001) — 인증 필요: 아니오

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| POST | /auth/login | /api/v1/auth/login | 로그인 |
| POST | /auth/logout | /api/v1/auth/logout | 로그아웃 |
| POST | /auth/refresh | /api/v1/auth/refresh | 토큰 갱신 |
| GET | /auth/verify | /api/v1/auth/verify | 토큰 검증 |
| POST | /auth/mfa/setup | /api/v1/auth/mfa/setup | MFA 설정 |
| POST | /auth/mfa/verify | /api/v1/auth/mfa/verify | MFA 검증 |
| DELETE | /auth/mfa | /api/v1/auth/mfa | MFA 비활성화 |
| POST | /auth/sessions/invalidate | /api/v1/auth/sessions/invalidate | 전체 세션 무효화 |

### 2. user-service (port 3002) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /users | /api/v1/users/ | 사용자 목록 |
| GET | /users/:id | /api/v1/users/:id | 사용자 상세 |
| POST | /users | /api/v1/users/ | 사용자 생성 |
| PUT | /users/:id | /api/v1/users/:id | 사용자 수정 |
| DELETE | /users/:id | /api/v1/users/:id | 사용자 비활성화 |
| PUT | /users/:id/reactivate | /api/v1/users/:id/reactivate | 사용자 재활성화 |
| PUT | /users/:id/role | /api/v1/users/:id/role | 역할 변경 |
| PUT | /users/:id/password | /api/v1/users/:id/password | 비밀번호 변경 |
| POST | /users/password-reset/request | /api/v1/users/password-reset/request | 비밀번호 재설정 요청 |
| POST | /users/password-reset/confirm | /api/v1/users/password-reset/confirm | 비밀번호 재설정 확인 |

### 3. tenant-service (port 3003) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /tenants | /api/v1/tenants/ | 테넌트 목록 |
| GET | /tenants/:id | /api/v1/tenants/:id | 테넌트 상세 |
| POST | /tenants | /api/v1/tenants/ | 테넌트 생성 |
| PUT | /tenants/:id | /api/v1/tenants/:id | 테넌트 수정 |
| PUT | /tenants/:id/status | /api/v1/tenants/:id/status | 테넌트 상태 변경 |

### 4. menu-service (port 3004) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /menu/tree | /api/v1/menus/tree | 메뉴 트리 조회 |
| GET | /menu/filtered | /api/v1/menus/filtered | 역할별 메뉴 조회 |
| POST | /menu | /api/v1/menus/ | 메뉴 생성 |
| PUT | /menu/:id | /api/v1/menus/:id | 메뉴 수정 |
| DELETE | /menu/:id | /api/v1/menus/:id | 메뉴 삭제 |
| PUT | /menu/:id/order | /api/v1/menus/:id/order | 메뉴 순서 변경 |

### 5. catalog-service (port 3005) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /catalog/services | /api/v1/services/services | 서비스 목록 |
| GET | /catalog/services/:id | /api/v1/services/services/:id | 서비스 상세 |
| POST | /catalog/services | /api/v1/services/services | 서비스 등록 |
| PUT | /catalog/services/:id | /api/v1/services/services/:id | 서비스 수정 |
| DELETE | /catalog/services/:id | /api/v1/services/services/:id | 서비스 삭제 |
| PUT | /catalog/services/:id/version | /api/v1/services/services/:id/version | 서비스 버전 업데이트 |
| GET | /catalog/services/:id/flags | /api/v1/services/services/:id/flags | 기능 플래그 목록 |
| PUT | /catalog/services/:id/flags/:key | /api/v1/services/services/:id/flags/:key | 기능 플래그 토글 |

### 6. subscription-service (port 3006) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /subscription/plans | /api/v1/subscriptions/plans | 플랜 목록 |
| POST | /subscription/plans | /api/v1/subscriptions/plans | 플랜 생성 |
| PUT | /subscription/plans/:id | /api/v1/subscriptions/plans/:id | 플랜 수정 |
| POST | /subscription/subscribe | /api/v1/subscriptions/subscribe | 구독 시작 |
| GET | /subscription/tenants/:tenantId | /api/v1/subscriptions/tenants/:tenantId | 테넌트 구독 조회 |
| PUT | /subscription/:id/upgrade | /api/v1/subscriptions/:id/upgrade | 구독 업그레이드 |
| PUT | /subscription/:id/downgrade | /api/v1/subscriptions/:id/downgrade | 구독 다운그레이드 |
| POST | /subscription/:id/cancel | /api/v1/subscriptions/:id/cancel | 구독 취소 |

### 7. billing-service (port 3007) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /billing/invoices | /api/v1/billing/invoices | 인보이스 목록 |
| GET | /billing/invoices/:id | /api/v1/billing/invoices/:id | 인보이스 상세 |
| POST | /billing/invoices/generate | /api/v1/billing/invoices/generate | 인보이스 자동 생성 |
| POST | /billing/invoices/:id/pay | /api/v1/billing/invoices/:id/pay | 인보이스 결제 |
| GET | /billing/payments | /api/v1/billing/payments | 결제 내역 |
| POST | /billing/invoices/:id/tax-invoice | /api/v1/billing/invoices/:id/tax-invoice | 세금계산서 발행 |
| GET | /billing/dashboard | /api/v1/billing/dashboard | 빌링 대시보드 |

### 8. crm-service (port 3008) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /crm/customers | /api/v1/crm/customers | 고객 목록 |
| GET | /crm/customers/:id | /api/v1/crm/customers/:id | 고객 상세 |
| POST | /crm/customers | /api/v1/crm/customers | 고객 등록 |
| PUT | /crm/customers/:id | /api/v1/crm/customers/:id | 고객 수정 |
| GET | /crm/customers/:id/contacts | /api/v1/crm/customers/:id/contacts | 담당자 목록 |
| POST | /crm/customers/:id/contacts | /api/v1/crm/customers/:id/contacts | 담당자 등록 |
| GET | /crm/contracts | /api/v1/crm/contracts | 계약 목록 |
| POST | /crm/contracts | /api/v1/crm/contracts | 계약 생성 |
| PUT | /crm/contracts/:id | /api/v1/crm/contracts/:id | 계약 수정 |
| GET | /crm/pipeline | /api/v1/crm/pipeline | 영업 파이프라인 |

### 9. ai-service (port 3009) — 인증 필요: 예, N2SF 등급 검증

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /ai/models | /api/v1/ai/models | AI 모델 목록 |
| POST | /ai/models | /api/v1/ai/models | AI 모델 등록 |
| PUT | /ai/models/:id | /api/v1/ai/models/:id | AI 모델 수정 |
| POST | /ai/chat | /api/v1/ai/chat | AI 채팅 (O등급만) |
| GET | /ai/usage | /api/v1/ai/usage | AI 사용량 조회 |
| GET | /ai/cost | /api/v1/ai/cost | AI 비용 조회 |

### 10. notification-service (port 3010) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| POST | /notification/send | /api/v1/notifications/send | 알림 전송 |
| POST | /notification/send-template | /api/v1/notifications/send-template | 템플릿 기반 전송 |
| GET | /notification/user/:userId | /api/v1/notifications/user/:userId | 사용자 알림 조회 |
| PUT | /notification/:id/read | /api/v1/notifications/:id/read | 읽음 처리 |
| GET | /notification/history | /api/v1/notifications/history | 알림 이력 |
| POST | /notification/templates | /api/v1/notifications/templates | 알림 템플릿 생성 |
| GET | /notification/templates | /api/v1/notifications/templates | 알림 템플릿 목록 |
| GET | /notification/templates/:id | /api/v1/notifications/templates/:id | 알림 템플릿 상세 |
| PUT | /notification/templates/:id | /api/v1/notifications/templates/:id | 알림 템플릿 수정 |
| DELETE | /notification/templates/:id | /api/v1/notifications/templates/:id | 알림 템플릿 삭제 |

### 11. file-service (port 3011) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| POST | /file/upload | /api/v1/files/upload | 파일 업로드 (AES-256 암호화) |
| GET | /file/:id | /api/v1/files/:id | 파일 다운로드 |
| GET | /file/list | /api/v1/files/list | 파일 목록 |
| DELETE | /file/:id | /api/v1/files/:id | 파일 삭제 |
| GET | /file/:id/meta | /api/v1/files/:id/meta | 파일 메타데이터 |

### 12. audit-service (port 3012) — 인증 필요: 예, 권한: audit:read

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| POST | /audit/logs | /api/v1/audit/logs | 감사 로그 기록 |
| GET | /audit/logs | /api/v1/audit/logs | 감사 로그 조회 |
| POST | /audit/verify | /api/v1/audit/verify | 무결성 검증 (SHA-256 체인) |
| GET | /audit/export | /api/v1/audit/export | 감사 로그 내보내기 |
| GET | /audit/stats | /api/v1/audit/stats | 감사 통계 |
| GET | /audit/retention | /api/v1/audit/retention | 보존 정책 현황 |
| POST | /audit/retention/cleanup | /api/v1/audit/retention/cleanup | 보존 기간 초과 정리 |

### 13. compliance-service (port 3013) — 인증 필요: 예

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /compliance/csap | /api/v1/compliance/csap | CSAP 준수 현황 |
| GET | /compliance/n2sf | /api/v1/compliance/n2sf | N2SF 준수 현황 |
| GET | /compliance/readiness | /api/v1/compliance/readiness | 인증 준비도 |
| GET | /compliance/metrics | /api/v1/compliance/metrics | 준수 메트릭 |

### 14. security-service (port 3014) — 인증 필요: 예, 권한: security:read

| Method | 경로 | 게이트웨이 경로 | 설명 |
|--------|------|---------------|------|
| GET | /security/login-failures | /api/v1/security/login-failures | 로그인 실패 내역 |
| GET | /security/anomalies | /api/v1/security/anomalies | 이상 탐지 |
| GET | /security/ip-blocklist | /api/v1/security/ip-blocklist | IP 차단 목록 |
| POST | /security/ip-blocklist | /api/v1/security/ip-blocklist | IP 차단 추가 |
| DELETE | /security/ip-blocklist/:ip | /api/v1/security/ip-blocklist/:ip | IP 차단 해제 |
| GET | /security/alerts | /api/v1/security/alerts | 보안 경고 |

### 15. security-monitor-service (port 3015) — 모니터링 전용

| Method | 경로 | 설명 |
|--------|------|------|
| GET | /security/login-failures | 로그인 실패 모니터링 |
| GET | /security/anomalies | 이상 행위 탐지 |
| GET | /security/ip-blocklist | IP 차단 목록 |
| POST | /security/ip-blocklist | IP 차단 추가 |
| DELETE | /security/ip-blocklist/:ip | IP 차단 해제 |
| GET | /security/alerts | 보안 경고 |

## 공통 엔드포인트

모든 서비스는 헬스체크 엔드포인트를 제공합니다:

| Method | 경로 | 설명 |
|--------|------|------|
| GET | /health | 서비스 상태 확인 |

## 인증 흐름 (CSAP D-08)

1. POST /api/v1/auth/login -> JWT access token (15분) + refresh token (7일)
2. 이후 요청: Authorization: Bearer {access_token}
3. 토큰 만료 시: POST /api/v1/auth/refresh
4. 로그아웃: POST /api/v1/auth/logout -> 토큰 블랙리스트 등록

## 총계

- 전체 서비스: 15개 (+ API Gateway)
- 전체 엔드포인트: 108개
- 인증 불필요: auth-service (8개)
- 권한 필수: audit (audit:read), security (security:read)
- N2SF 등급 검증: ai-service (O등급만 허용)
