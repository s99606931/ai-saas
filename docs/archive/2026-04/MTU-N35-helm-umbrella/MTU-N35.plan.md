# Plan: MTU-N35 Helm Umbrella Chart

| 항목 | 내용 |
|------|------|
| 문서 ID | PLAN-N35-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| 작성자 | PM Lead (Opus 4.6) |
| PRD 참조 | PRD-N35-001 |
| 복잡도 | HIGH |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 단일 명령 전체 스택 배포로 운영 효율성 향상 |
| 기술 | Umbrella Chart + 공통 라이브러리 + 환경별 values |
| 보안 | CSAP D-07/D-12 배포 표준화 |
| 운영 | kustomize -> Helm 마이그레이션 경로 제공 |

## 기능 요구사항

| FR ID | 설명 | 우선순위 | 수용 기준 |
|-------|------|---------|---------|
| FR-N35.1 | Umbrella Chart.yaml 구조 | MUST | 하위 차트 의존성 정의 |
| FR-N35.2 | 공통 라이브러리 차트 | MUST | _helpers.tpl 공유 |
| FR-N35.3 | 마이크로서비스 하위 차트 14개 | MUST | 각 서비스별 templates/ |
| FR-N35.4 | 인프라 하위 차트 (postgres, redis, minio) | SHOULD | 외부 의존 서비스 |
| FR-N35.5 | 환경별 values 파일 | MUST | values-dev.yaml, values-stg.yaml |
| FR-N35.6 | helm lint 통과 | MUST | 0 failures |
| FR-N35.7 | Umbrella Chart 사용 가이드 | MUST | docs/07-infra/helm-umbrella-guide.md |

## 하위 차트 목록

### 마이크로서비스 (14개)
1. api-gateway (기존 차트 재사용)
2. auth-service
3. user-service
4. tenant-service
5. menu-service
6. saas-catalog-service
7. subscription-service
8. billing-service
9. crm-service
10. ai-service
11. notification-service
12. file-service
13. audit-service
14. compliance-service
15. security-monitor-service
16. portal

### 인프라 (3개)
17. postgres
18. redis
19. minio

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
