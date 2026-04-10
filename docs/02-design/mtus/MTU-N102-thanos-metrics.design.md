# MTU-N102: Thanos 장기 메트릭 -- Design

> **MTU ID**: MTU-N102
> **Plan 참조**: docs/01-plan/mtus/MTU-N102-thanos-metrics.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 내용 |
|------|------|
| 목표 | Prometheus 메트릭 장기 보존 + 연합 쿼리 + 비용 최적화 |
| 제약 | MinIO 객체 스토리지 활용, 외부 클라우드 금지 |
| 검증 | 30일+ 메트릭 쿼리, 다운샘플링 동작 확인 |

## 아키텍처

```
[Prometheus] --sidecar--> [Thanos Sidecar] --upload--> [MinIO]
                                                          |
[Grafana] --> [Thanos Query] --> [Thanos Store GW] -------+
                   |
             [Query Frontend] -- 캐시
                   |
             [Thanos Compactor] -- 다운샘플링/컴팩션
```

### 다운샘플링 정책

| 보존 기간 | 해상도 | 스토리지 추정 |
|----------|--------|-------------|
| 0~7일 | 원본 (15초) | ~500MB/일 |
| 7~30일 | 5분 | ~50MB/일 |
| 30~365일 | 1시간 | ~5MB/일 |

## 산출물

| # | 파일 | 설명 |
|---|------|------|
| 1 | infra/thanos/install.yaml | Helm values |
| 2 | infra/thanos/objstore-config.yaml | MinIO 연결 설정 |
| 3 | infra/thanos/compactor-config.yaml | 컴팩터 설정 |
| 4 | infra/thanos/query-frontend.yaml | 쿼리 프론트엔드 |
| 5 | tests/e2e/test-thanos-metrics.sh | E2E 테스트 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Agent |
