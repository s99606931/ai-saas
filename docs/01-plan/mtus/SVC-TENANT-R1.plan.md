# Plan: tenant-service 라운드 1 고도화

> MTU ID: SVC-TENANT-R1 | 작성일: 2026-04-09

## FR-TENANT.1: 리소스 사용량 조회 API
- GET /tenants/:id/usage — 사용자 수, 스토리지 사용량, 구독 수

## FR-TENANT.2: 테넌트 정지 시 세션 무효화 연동
- PUT /tenants/:id/status에서 SUSPENDED 시 auth-service /auth/sessions/invalidate 호출

## FR-TENANT.3: 테넌트 소프트 삭제
- DELETE /tenants/:id → status=ARCHIVED + archivedAt 설정

## FR-TENANT.4: 테넌트 설정 관리
- GET /tenants/:id/config, PUT /tenants/:id/config

## FR-TENANT.5: 통합 테스트
- 리소스 사용량, 정지 시 세션 무효화, 소프트 삭제 시나리오

## 변경 이력
| 버전 | 일자 | 작성자 |
|------|------|--------|
| 1.0.0 | 2026-04-09 | PM |
