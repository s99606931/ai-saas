# 준수 현황 대시보드 아키텍처

> MTU-A6 | FR-7.3 | 적용 기준일: 2026-04-05
> 참조: MTU-C1 (CSAP 체크리스트), MTU-A4 (OSCAL), MTU-I4 (OpenTelemetry)

---

## 1. 전체 파이프라인

```
데이터 소스 레이어
  OSCAL SSP (csap-profile.json) + audit.jsonl + T04 추적성 매트릭스
      |
      v
수집/변환 레이어 (OpenTelemetry Collector)
  OSCAL 파서 -> OTel Gauge 메트릭
  audit.jsonl 파서 -> OTel Counter 메트릭
  체크리스트 파서 -> OTel Gauge 메트릭
      |  OTLP
      v
저장/조회 레이어
  Prometheus (시계열) + Loki (로그)
      |  PromQL / LogQL
      v
시각화 레이어
  Grafana (k3s monitoring 네임스페이스)
  - 대시보드 1: CSAP 79항목 준수율
  - 대시보드 2: N2SF 6영역 상태
  - 대시보드 3: ISMS-P 101항목 현황
  - 대시보드 4: 감리 준비도 통합 점수
```

---

## 2. OTel 메트릭 설계

| 메트릭명 | 타입 | 레이블 | 설명 |
|--------|------|--------|------|
| `csap_control_status` | Gauge | `domain`, `control_id`, `status` | 항목별 상태 (0=미완, 1=완료) |
| `csap_domain_completion_ratio` | Gauge | `domain` | 분야별 완료율 (0.0~1.0) |
| `n2sf_area_status` | Gauge | `area_id`, `grade` | N2SF 영역별 상태 |
| `isms_p_control_status` | Gauge | `category`, `control_id` | ISMS-P 항목별 상태 |
| `audit_events_total` | Counter | `action`, `actor`, `result` | 감사 이벤트 누적 |
| `audit_readiness_score` | Gauge | -- | 감리 준비도 (0~100) |

---

## 3. 감리 준비도 점수

```
감리 준비도 점수 =
  (CSAP 완료율 x 0.40) +
  (N2SF 매핑 완료율 x 0.20) +
  (ISMS-P 완료율 x 0.15) +
  (T01~T07 산출물 완비율 x 0.15) +
  (테스트 커버리지 x 0.10)

= 0~100점
```

| 점수 구간 | 상태 | 색상 | 권고 |
|---------|------|------|------|
| 90~100 | 감리 준비 완료 | 녹색 | 감리 일정 확정 가능 |
| 70~89 | 준비 중 | 노란색 | 미완료 항목 집중 보완 |
| 50~69 | 준비 부족 | 주황색 | 2주 이상 추가 작업 필요 |
| 0~49 | 미준비 | 빨간색 | 감리 일정 재조정 권고 |

---

## 4. k3s 배포 구성

```yaml
Namespace: monitoring

Deployments:
  - otel-collector: OTel Collector (데이터 수집/변환)
  - prometheus: Prometheus (메트릭 저장)
  - loki: Loki (로그 저장)
  - grafana: Grafana (시각화)

Services:
  - otel-collector: ClusterIP :4317 (OTLP gRPC)
  - prometheus: ClusterIP :9090
  - grafana: ClusterIP :3000

Ingress:
  - compliance.internal -> grafana:3000
```

---

## 5. Grafana 알림 규칙

| 조건 | 심각도 | 채널 |
|------|--------|------|
| CSAP 완료율 < 80% (감리 D-7) | CRITICAL | Gitea 이슈 |
| N2SF C/S등급 차단 실패 | CRITICAL | 즉시 알림 |
| 감리 준비도 < 70 | HIGH | 주간 리포트 |
| ISMS-P 미완료 항목 신규 발견 | MEDIUM | Gitea 이슈 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A6 Do — 대시보드 아키텍처 작성 | Implementer Agent |
