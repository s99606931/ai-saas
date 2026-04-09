# MTU-A6: 준수 현황 대시보드 [신규]

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-A6 |
| Phase | Phase 4 Advanced |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-7.3 |
| 의존 MTU | MTU-C1 (CSAP 체크리스트), MTU-A4 (OSCAL 매핑), MTU-I4 (OpenTelemetry) |
| 예상 세션 | 1 세션 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | CSAP 79항목·N2SF 6영역·ISMS-P 101항목 준수 현황을 수동으로 집계하면 감리 직전 수주일이 소요 — 실시간 대시보드로 상시 모니터링하여 감리 대응 준비도를 항시 파악 |
| WHO | CTO (대시보드 리뷰), 보안 담당자 (항목별 상세 확인), 감리관 (감리 준비도 점수 확인) |
| RISK | OSCAL → OTel 파이프라인 구축 복잡도 — 데이터 변환 레이어가 없으면 Grafana 연동 불가 |
| SUCCESS | CSAP 79항목 준수율 실시간 표시 + N2SF 6영역 시각화 + ISMS-P 포함 + 감리 준비도 점수 자동 계산 |
| SCOPE | 대시보드 아키텍처 설계 + Grafana 패널 명세 (실제 Grafana 대시보드 JSON 초안 포함) |

---

## 목적

CSAP, N2SF, ISMS-P 세 가지 규제 프레임워크의 준수 현황을 단일 Grafana 대시보드에서
실시간으로 시각화하고, 감리 대응 준비도 점수(0~100%)를 자동 계산합니다.

**핵심 파이프라인**: OSCAL 데이터 → OpenTelemetry → Prometheus → Grafana

---

## 산출물 파일 (2개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `13-compliance-dashboard/dashboard-architecture.md` | 아키텍처 레퍼런스형 | OSCAL→OTel→Prometheus→Grafana 파이프라인 설계 |
| `13-compliance-dashboard/grafana-dashboard-spec.md` | 구현 가이드형 | Grafana 패널 명세, 데이터소스 설정, 알림 규칙 |

---

## 대시보드 아키텍처 설계

### 전체 파이프라인

```
┌─────────────────────────────────────────────────────────────────┐
│  데이터 소스 레이어                                               │
│  ┌─────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ OSCAL SSP       │  │ audit.jsonl    │  │ T04 추적성 매트릭│  │
│  │ csap-profile.json│  │ (감사 로그)    │  │ 스 (체크리스트) │  │
│  └────────┬────────┘  └───────┬────────┘  └────────┬────────┘  │
│           │                   │                     │           │
└───────────┼───────────────────┼─────────────────────┼───────────┘
            │                   │                     │
┌───────────▼───────────────────▼─────────────────────▼───────────┐
│  수집·변환 레이어 (OpenTelemetry Collector)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  OSCAL 파서 → OTel 게이지 메트릭 변환                     │   │
│  │  audit.jsonl 파서 → OTel 카운터 변환                      │   │
│  │  체크리스트 파서 → OTel 게이지 변환                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬──────────────────────────────────┘
                                │ OTLP
┌───────────────────────────────▼──────────────────────────────────┐
│  저장·조회 레이어                                                   │
│  Prometheus (시계열) + Loki (로그)                                 │
└───────────────────────────────┬──────────────────────────────────┘
                                │ PromQL / LogQL
┌───────────────────────────────▼──────────────────────────────────┐
│  시각화 레이어                                                       │
│  Grafana (k3s 내부 배포, `monitoring` 네임스페이스)                  │
│  ├── 대시보드 1: CSAP 79항목 준수율                                  │
│  ├── 대시보드 2: N2SF 6영역 상태                                     │
│  ├── 대시보드 3: ISMS-P 101항목 현황                                 │
│  └── 대시보드 4: 감리 준비도 통합 점수                               │
└──────────────────────────────────────────────────────────────────┘
```

### OTel 메트릭 설계

| 메트릭명 | 타입 | 레이블 | 설명 |
|--------|------|--------|------|
| `csap_control_status` | Gauge | `domain`, `control_id`, `status` | CSAP 항목별 준수 상태 (0=미완, 1=완료) |
| `csap_domain_completion_ratio` | Gauge | `domain` | 분야별 완료율 (0.0~1.0) |
| `n2sf_area_status` | Gauge | `area_id`, `grade` | N2SF 영역별 상태 |
| `isms_p_control_status` | Gauge | `category`, `control_id` | ISMS-P 항목별 준수 상태 |
| `audit_events_total` | Counter | `action`, `actor`, `result` | 감사 이벤트 누적 |
| `audit_readiness_score` | Gauge | — | 감리 준비도 점수 (0~100) |

---

## Grafana 패널 명세

### 대시보드 1: CSAP 79항목 준수율

| 패널 | 시각화 유형 | PromQL | 설명 |
|------|-----------|--------|------|
| 전체 준수율 | Stat (대형) | `sum(csap_control_status==1) / 79 * 100` | 79항목 중 완료 비율 |
| 분야별 완료율 | Bar Chart | `csap_domain_completion_ratio * 100` | D-01~D-13 분야별 막대 |
| 미완료 항목 목록 | Table | `csap_control_status == 0` | 즉시 조치 필요 항목 |
| 완료 추이 | Time Series | `sum(csap_control_status) over time` | 시간별 완료 항목 수 증가 |

### 대시보드 2: N2SF 6영역 상태

| 패널 | 시각화 유형 | 설명 |
|------|-----------|------|
| 6영역 현황 | Pie Chart | N-01~N-06 영역별 완료·진행·미착수 비율 |
| 등급별 분포 | Bar Chart | C/S/O 등급 데이터 항목 분류 현황 |
| AI 게이트웨이 차단 현황 | Stat | C/S등급 차단 건수 (audit.jsonl 기반) |

### 대시보드 3: ISMS-P 101항목 현황

| 패널 | 시각화 유형 | 설명 |
|------|-----------|------|
| 전체 준수율 | Gauge | 0~100% 게이지 형태 |
| 카테고리별 현황 | Heatmap | 관리체계(16)·보호대책(64)·생명주기(21) 분류 |
| CSAP 교차 항목 | Table | ISMS-P ↔ CSAP 중복 항목 목록 |

### 대시보드 4: 감리 준비도 통합 점수

```
감리 준비도 점수 = 
  (CSAP 완료율 × 0.40) +
  (N2SF 매핑 완료율 × 0.20) +
  (ISMS-P 완료율 × 0.15) +
  (T01~T07 산출물 완비율 × 0.15) +
  (테스트 커버리지 × 0.10)
  
× 100 = 0~100점
```

| 점수 구간 | 상태 | 색상 | 권고 |
|---------|------|------|------|
| 90~100 | 감리 준비 완료 | 녹색 | 감리 일정 확정 가능 |
| 70~89 | 준비 중 | 노란색 | 미완료 항목 집중 보완 |
| 50~69 | 준비 부족 | 주황색 | 2주 이상 추가 작업 필요 |
| 0~49 | 미준비 | 빨간색 | 감리 일정 재조정 권고 |

---

## Grafana 알림 규칙

| 알림 조건 | 심각도 | 알림 채널 |
|---------|--------|---------|
| CSAP 완료율 < 80% (감리 D-7일) | CRITICAL | Gitea 이슈 자동 생성 |
| N2SF C/S등급 차단 실패 감지 | CRITICAL | 즉시 보안 담당자 알림 |
| 감리 준비도 점수 < 70 | HIGH | 주간 리포트 자동 발송 |
| ISMS-P 신규 미완료 항목 발견 | MEDIUM | Gitea 이슈 생성 |

---

## k3s 배포 구성

```yaml
# k3s Namespace 및 서비스 구성
Namespace: monitoring

Deployments:
  - otel-collector     # OTel Collector (데이터 수집·변환)
  - prometheus         # Prometheus (메트릭 저장)
  - loki               # Loki (로그 저장)
  - grafana            # Grafana (시각화)

Services:
  - otel-collector: ClusterIP :4317 (OTLP gRPC)
  - prometheus:    ClusterIP :9090
  - grafana:       ClusterIP :3000
  - grafana-ingress: IngressRoute (compliance.internal)

ConfigMaps:
  - otel-config.yaml     # OTel 파이프라인 설정
  - prometheus-rules.yml # 알림 규칙
  - grafana-dashboards/  # 대시보드 JSON (ConfigMap으로 자동 로드)
```

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-7.3 | 준수 현황 대시보드 | CSAP·N2SF·ISMS-P 실시간 시각화 + 감리 준비도 점수 자동 계산 |

---

## 합격 기준

1. CSAP 79항목 준수율 실시간 표시: `csap_control_status` 메트릭 → Grafana 패널 연동, 분야별(D-01~D-13) 세분화 표시
2. N2SF 6영역 상태 시각화: N-01~N-06 영역별 완료·진행·미착수 파이차트 + AI 차단 현황 Stat 패널
3. ISMS-P 준수 현황 포함: 101항목 준수율 게이지 + 카테고리별 히트맵 (관리체계·보호대책·생명주기)
4. 감리 준비도 점수 자동 계산: 가중합 공식 적용 (CSAP 40%·N2SF 20%·ISMS-P 15%·산출물 15%·테스트 10%), 0~100점 Stat 패널 표시

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — OSCAL→OTel→Grafana 파이프라인 설계 포함 신규 모듈 | Claude Code |
