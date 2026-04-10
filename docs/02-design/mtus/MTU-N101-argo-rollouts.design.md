# MTU-N101: Argo Rollouts -- Design

> **MTU ID**: MTU-N101
> **Plan 참조**: docs/01-plan/mtus/MTU-N101-argo-rollouts.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | Blue/Green + A/B 배포 전략 + 메트릭 기반 자동 롤백 |
| 제약 | Traefik IngressRoute 연동, Flagger와 공존 |
| 검증 | Blue/Green 전환, A/B 트래픽 분리, 자동 롤백 |

## 아키텍처

```
[Argo Rollouts Controller]
        |
   [Rollout CR]
    /        \
[Blue RS]  [Green RS]   -- Blue/Green
    \        /
   [Active Service] [Preview Service]
        |
   [Traefik IngressRoute]
        |
   [AnalysisRun] --> [Prometheus] -- 메트릭 검증
```

### 배포 전략 매트릭스

| 전략 | 사용 시나리오 | 트래픽 전환 | 롤백 시간 |
|------|------------|-----------|----------|
| Blue/Green | 주요 버전 업그레이드 | 즉시 전환 | < 10초 |
| A/B Test | 기능 실험 | Header 기반 | 즉시 |
| Canary | 점진적 릴리스 | 가중치 기반 | 자동 |

### AnalysisTemplate

| 템플릿 | 메트릭 | 임계값 | 간격 |
|--------|--------|--------|------|
| success-rate | http_request_success_rate | >= 99% | 30초 |
| latency-p99 | http_request_duration_p99 | <= 500ms | 30초 |
| error-rate | http_5xx_rate | <= 1% | 30초 |

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | infra/argo-rollouts/install.yaml | Helm values |
| 2 | infra/argo-rollouts/blue-green-rollout.yaml | B/G 전략 |
| 3 | infra/argo-rollouts/ab-test-rollout.yaml | A/B 전략 |
| 4 | infra/argo-rollouts/analysis-templates.yaml | 분석 템플릿 |
| 5 | tests/e2e/test-argo-rollouts.sh | E2E 테스트 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
