# MTU-N196: 리소스 LimitRange 준수 모니터링 -- Design

> 버전: 1.0.0 | 작성일: 2026-04-10 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/MTU-N196-limitrange-compliance.plan.md

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | Pragmatic Balance -- kube-state-metrics LimitRange 메트릭 활용 |
| 메트릭 소스 | kube_limitrange, kube_pod_container_resource_requests/limits |
| 알림 채널 | Alertmanager 표준 경로 |
| 대시보드 | Grafana JSON 프로비저닝 |

## 상세 설계

### 1. Recording Rules (FR-N196.1, FR-N196.3, FR-N196.4)

```yaml
limitrange:namespace_count -- LimitRange 설정된 네임스페이스 수
limitrange:missing_namespaces -- LimitRange 미설정 네임스페이스 수
limitrange:containers_without_requests -- 리소스 요청 미설정 컨테이너 수
limitrange:containers_without_limits -- 리소스 제한 미설정 컨테이너 수
limitrange:compliance_score -- LimitRange 준수 점수
```

### 2. Alerting Rules (FR-N196.2, FR-N196.3)

| 알림명 | 조건 | 심각도 | for |
|--------|------|--------|-----|
| LimitRangeMissing | 테넌트 NS에 LimitRange 미설정 | warning | 10m |
| ContainerWithoutResourceRequests | 리소스 요청 미설정 컨테이너 | warning | 5m |
| ContainerWithoutResourceLimits | 리소스 제한 미설정 컨테이너 | warning | 5m |
| LimitRangeComplianceLow | 준수 점수 < 80% | critical | 15m |

### 3. CSAP 매핑

| CSAP | 항목 | 구현 |
|------|------|------|
| D-08 | 접근 통제 | 테넌트별 리소스 격리 LimitRange 적용 확인 |
| D-10 | 서비스 가용성 | 리소스 제한으로 noisy neighbor 방지 |
| D-12 | 개발 보안 | E2E 테스트 검증 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초안 작성 | PM Lead |
