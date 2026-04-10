# SVC-E2E-R6 Plan -- 나머지 10개 서비스 E2E 통합 테스트 확산

> Plan SC: FR-E2E-R6.1~FR-E2E-R6.10
> Design Ref: SVC-E2E-R4 DESIGN (패턴 재사용)
> CSAP: D-06 감사 로그, D-08 접근 통제, D-08-05 테넌트 격리, D-12 입력 검증

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-09 | 초기 작성 | PM (Claude) |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 사업 | Round 4~5에서 7개 서비스 E2E 완료, 나머지 10개 서비스 E2E 확산으로 전체 커버리지 달성 |
| 기술 | Fastify inject 기반 E2E 패턴 표준화, 서비스별 핵심 비즈니스 플로우 4~6건 |
| 보안 | CSAP D-08 접근 통제, D-08-05 테넌트 격리, D-12 입력 검증 E2E 검증 |
| 품질 | 전체 17개 서비스 E2E 100% 커버리지, 누적 테스트 1,300+ 목표 |

## Context Anchor

- **WHY**: Round 4~5에서 7개 핵심 서비스 E2E만 완료. 나머지 10개 서비스가 E2E 미적용 상태
- **WHO**: 프레임워크 품질 관리자, CSAP 감리관
- **RISK**: E2E 미적용 서비스에서 회귀 버그 발생 시 감리 결함 지적
- **SUCCESS**: 10개 서비스 모두 E2E 테스트 작성 + 통과
- **SCOPE**: ai, billing, catalog, crm, file, menu, security, security-monitor, subscription, saas-catalog

## 요구사항

| FR ID | 서비스 | 테스트 항목 | CSAP |
|-------|--------|------------|------|
| FR-E2E-R6.1 | ai-service | 모델 CRUD, 채팅 데이터등급, PII 마스킹, 비용 계산 | D-08, N-05 |
| FR-E2E-R6.2 | billing-service | 인보이스 생성/결제/조회, 연체, 대시보드 | D-06, D-08-05 |
| FR-E2E-R6.3 | catalog-service | 서비스 CRUD, 검색, 버전 관리, 피처플래그 | D-08-05, D-12 |
| FR-E2E-R6.4 | crm-service | 고객 CRUD, 담당자, 계약 관리, 파이프라인 | D-08, D-06 |
| FR-E2E-R6.5 | file-service | 업로드/다운로드, 메타데이터, 삭제, 용량 | D-08-05, D-09 |
| FR-E2E-R6.6 | menu-service | 트리 조회, 역할 필터, 검색, 정렬, 통계 | D-08, D-12 |
| FR-E2E-R6.7 | security-service | 로그인 실패 탐지, 이상 탐지, IP 차단, 알림 | D-06, D-08 |
| FR-E2E-R6.8 | security-monitor-service | 실패 추이, 이벤트 통계, 알림 확인, 대시보드 | D-06, D-08 |
| FR-E2E-R6.9 | subscription-service | 플랜 CRUD, 구독/업그레이드/해지, 만료 임박 | D-06, D-08-05 |
| FR-E2E-R6.10 | saas-catalog-service | CRUD, 검색, 승인 워크플로, 카테고리, 통계 | D-08-05, D-12 |

## 기술 패턴

- Fastify + inject() 기반 (외부 의존성 없음)
- `@public-saas/observability` responseTimePlugin 적용
- 서비스별 `tests/integration/{svc}-e2e-r6.test.ts` 생성
- vitest 실행 환경
