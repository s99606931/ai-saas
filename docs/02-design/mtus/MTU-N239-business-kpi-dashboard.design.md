# MTU-N239: 비즈니스 KPI 대시보드 -- Design

> **버전**: 1.0 | **작성일**: 2026-04-10

## KPI 메트릭 정의

| KPI | 메트릭 | 산출 방식 | 목표 |
|-----|--------|---------|------|
| 테넌트 수 | saas_tenants_active_total | gauge | 증가 추세 |
| 월간 활성 사용자 (MAU) | saas_mau_total | 30일 고유 사용자 | 증가 추세 |
| 일간 활성 사용자 (DAU) | saas_dau_total | 24시간 고유 사용자 | 증가 추세 |
| 플랫폼 가용성 | saas_availability_ratio | 1 - (다운타임/전체시간) | >= 99.9% |
| API 성공률 | saas_api_success_ratio | 2xx / 전체 요청 | >= 99.5% |
| 평균 응답 시간 | saas_api_latency_p95 | histogram p95 | < 500ms |
| 에러 예산 소진율 | saas_error_budget_consumed | SLO 기반 | < 80% |
| 배포 빈도 | saas_deployment_frequency | 주간 배포 횟수 | >= 3/주 |
| 배포 실패율 | saas_deployment_failure_ratio | 실패/전체 | < 5% |
| MTTR | saas_mttr_seconds | 평균 복구 시간 | < 1시간 |
