# MTU-N161: 자동 용량 권고 엔진 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: `docs/01-plan/mtus/MTU-N161-capacity-recommendation-engine.plan.md`

---

## 1. Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 패턴 | Pragmatic Balance — VPA recommender 활용 + Prometheus 기반 자동 분석 |
| 핵심 기술 | VPA Recommender API, HPA Metrics Server, Prometheus Recording Rules |
| 권고 모드 | Off (읽기 전용) — 자동 적용하지 않고 권고만 생성 |
| 분석 주기 | 실시간 메트릭 + 일간 권고 보고서 + 주간 종합 분석 |

---

## 2. 용량 권고 알고리즘

### 2.1 CPU 권고 로직

```
requests_recommended = P95(실제 사용량, 7일) * 1.15 (안전 마진 15%)
limits_recommended   = P99(실제 사용량, 7일) * 1.3  (버스트 마진 30%)
savings_potential     = (현재 requests - requests_recommended) * cpu_price
```

### 2.2 메모리 권고 로직

```
requests_recommended = max(P95(실제 사용량, 7일), OOM 직전 최대값) * 1.2
limits_recommended   = requests_recommended * 1.5
savings_potential     = (현재 requests - requests_recommended) * memory_price
```

### 2.3 HPA 최적화 권고

```
minReplicas_recommended = ceil(트래픽 최저점 처리량 / 단일 파드 처리량)
maxReplicas_recommended = ceil(트래픽 피크 처리량 / 단일 파드 처리량 * 0.8)
targetUtilization       = 70% (기본) — 워크로드 특성에 따라 조정
```

---

## 3. 상세 설계

### 3.1 메트릭 수집 체계

| 메트릭 소스 | 수집 대상 | 사용 용도 |
|------------|---------|---------|
| VPA Recommender | CPU/메모리 권장값 | 기준 권고 |
| cAdvisor | 실제 CPU/메모리 사용량 | P95/P99 계산 |
| kube-state-metrics | 현재 requests/limits | 현재 설정 비교 |
| HPA | 현재 HPA 설정, 실제 레플리카 | HPA 최적화 |

### 3.2 권고 결과 등급

| 등급 | 조건 | 조치 |
|------|------|------|
| CRITICAL | 현재 requests가 P95의 200% 이상 | 즉시 축소 권장 |
| HIGH | 현재 requests가 P95의 150% 이상 | 일주일 내 축소 권장 |
| MEDIUM | 현재 requests가 P95의 120% 이상 | 다음 정기 검토 시 |
| LOW | 현재 requests가 실제 사용량 미만 | 즉시 증설 필수 |
| OK | 차이 20% 이내 | 조치 불필요 |

---

## 4. CSAP/N2SF 매핑

| 통제항목 | 구현 내용 |
|----------|---------|
| D-06 | 용량 변경 권고 이력 감사 로그 |
| D-08 | 권고 대시보드 RBAC 접근 통제 |

---

## 5. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Lead |
