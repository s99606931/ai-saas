# MTU-N160: 비용 귀속 대시보드 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: `docs/01-plan/mtus/MTU-N160-cost-attribution-dashboard.plan.md`

---

## 1. Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 패턴 | Pragmatic Balance — Prometheus 네이티브 레코딩 규칙 + Grafana 시각화 |
| 비용 모델 | 리소스 사용량 비례 + 공유 리소스 균등 분배 |
| 데이터 소스 | kube-state-metrics, cAdvisor, node-exporter |
| 비용 단위 | 시간당 원(KRW) — CPU vCore/h, Memory GB/h, Storage GB/month |
| 보안 | 네임스페이스 기반 테넌트 격리, RBAC 대시보드 접근 통제 |

---

## 2. 비용 계산 모델

### 2.1 리소스별 단가 체계

| 리소스 | 단위 | 기본 단가 (KRW) | 비고 |
|--------|------|-----------------|------|
| CPU | vCore/h | 50 | 실제 사용량 기준 |
| Memory | GB/h | 10 | 실제 사용량 기준 |
| Storage (PV) | GB/month | 100 | 프로비전 용량 기준 |
| Network (Egress) | GB | 50 | 크로스존 트래픽 기준 |

### 2.2 비용 귀속 규칙

| 구분 | 귀속 방식 |
|------|---------|
| 전용 리소스 | 해당 테넌트에 100% 귀속 |
| 공유 플랫폼 서비스 | 사용량 비례 분배 (API 호출 수 기반) |
| 인프라 오버헤드 | 전체 테넌트 균등 분배 |
| 모니터링/로깅 | 로그/메트릭 볼륨 비례 분배 |

---

## 3. 상세 설계

### 3.1 Prometheus 레코딩 규칙 체계

```
tenant_cost:cpu_hourly_krw       = CPU 사용량 * 단가
tenant_cost:memory_hourly_krw    = 메모리 사용량 * 단가
tenant_cost:storage_monthly_krw  = PV 크기 * 단가
tenant_cost:network_krw          = 네트워크 전송량 * 단가
tenant_cost:total_hourly_krw     = 합계
```

### 3.2 대시보드 구성

| 패널 | 유형 | 내용 |
|------|------|------|
| 전체 비용 현황 | Stat | 총 비용, 전월 대비 증감 |
| 테넌트별 비용 순위 | Bar Chart | 상위 10 테넌트 비용 |
| 리소스별 비용 추이 | Time Series | CPU/Memory/Storage/Network 추이 |
| 테넌트별 상세 | Table | 테넌트별 리소스 사용량 + 비용 상세 |
| 비용 효율 | Gauge | 리소스 할당 대비 실제 사용 비율 |
| 임계값 초과 | Alert List | 비용 임계값 초과 테넌트 |

---

## 4. CSAP/N2SF 매핑

| 통제항목 | 구현 내용 |
|----------|---------|
| D-06 | 비용 변동 감사 로그, 임계값 초과 이력 기록 |
| D-08 | 테넌트별 비용 데이터 RBAC 접근 통제 |
| N2SF N-05 | 비용 데이터 O등급 (AI 분석 허용) |

---

## 5. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 설계 | PM Lead |
