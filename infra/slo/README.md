# SLI/SLO 표준 정의서 -- 공공기관 SaaS 플랫폼

> **Design Ref**: MTU-N142 Design SS1
> **Plan SC**: FR-N142.1, FR-N142.5
> **CSAP**: D-06(침해사고 관리 -- SLO 위반 자동 탐지)
> **버전**: 1.0.0 | **최종 갱신**: 2026-04-10

---

## 1. 개요

본 문서는 공공기관 SaaS 플랫폼 전체 마이크로서비스의 SLI(Service Level Indicator) 및
SLO(Service Level Objective)를 표준화하는 정의서입니다.

모든 SLO는 [Sloth](https://sloth.dev) CRD(PrometheusServiceLevel)로 정의하며,
Sloth가 Prometheus recording rules + alerting rules를 자동 생성합니다.

## 2. 3대 SLI 유형

| SLI 유형 | 정의 | Prometheus 메트릭 | 적용 범위 |
|----------|------|-------------------|----------|
| **가용성** (Availability) | HTTP 5xx 비율 기반 성공률 | `http_requests_total{code=~"5.."}` | 전체 13개 서비스 |
| **지연시간** (Latency) | P95 응답시간이 임계값 초과하는 비율 | `http_request_duration_seconds_bucket{le="임계값"}` | 전체 13개 서비스 |
| **처리량** (Throughput) | 초당 요청 처리량이 최소 기준 미만인 비율 | `http_requests_total` rate | Critical/High 티어 (7개) |

## 3. 서비스 티어 분류

### Critical (가용성 99.9%+, 에러 버짓 소진 시 기능 동결)

| 서비스 | 가용성 SLO | 지연 SLO (P95) | CSAP 매핑 | 비고 |
|--------|-----------|---------------|----------|------|
| api-gateway | 99.9% | < 500ms | D-06 | 전체 트래픽 진입점 |
| auth-service | 99.95% | < 300ms | D-08 | 접근 통제 핵심 |
| audit-service | 99.99% | < 200ms | D-06 | 감사 로그 유실 불가 |

### High (가용성 99.9%, 에러 버짓 소진 시 주의 강화)

| 서비스 | 가용성 SLO | 지연 SLO (P95) | CSAP 매핑 | 비고 |
|--------|-----------|---------------|----------|------|
| tenant-service | 99.9% | < 500ms | - | 멀티테넌시 핵심 |
| user-service | 99.9% | < 500ms | D-08 | 사용자 관리 |
| subscription-service | 99.9% | < 500ms | - | 구독 관리 |
| ai-gateway | 99.5% | < 2000ms | - | 외부 LLM 의존 |

### Standard (가용성 99.5%, 에러 버짓 소진 시 알림)

| 서비스 | 가용성 SLO | 지연 SLO (P95) | CSAP 매핑 | 비고 |
|--------|-----------|---------------|----------|------|
| menu-service | 99.5% | < 500ms | - | UI 메뉴 구성 |
| catalog-service | 99.5% | < 500ms | - | SaaS 카탈로그 |
| billing-service | 99.5% | < 1000ms | - | 과금 처리 |
| crm-service | 99.5% | < 1000ms | - | 고객 관계 관리 |
| notification-service | 99.5% | < 1000ms | D-06 | 보안 알림 포함 |
| file-service | 99.5% | < 2000ms | - | 파일 업/다운로드 |

## 4. 에러 버짓 정책

### 30일 롤링 윈도우 에러 버짓

| 가용성 목표 | 30일 에러 버짓 | 월간 허용 다운타임 |
|------------|--------------|-----------------|
| 99.99% | 0.01% | 약 4.3분 |
| 99.95% | 0.05% | 약 21.6분 |
| 99.9% | 0.1% | 약 43.2분 |
| 99.5% | 0.5% | 약 3.6시간 |

### 에러 버짓 소진 대응 정책

| 잔여율 | 조치 | 알림 대상 |
|--------|------|----------|
| < 50% | 경고 알림 발송, 에러 추이 모니터링 강화 | SRE 팀 (Slack) |
| < 25% | 긴급 알림, 원인 분석 착수 | SRE 팀 + 서비스 오너 |
| 0% (소진) | Critical 티어: 신규 배포 동결 + 안정성 작업 전환 | 전체 팀 |

## 5. SLO 거버넌스

### 목표 변경 절차

1. SRE 팀이 변경 제안서 작성 (사유 + 데이터 근거)
2. 해당 서비스 오너 합의
3. PM 승인
4. 이 문서 + Sloth CRD 동시 업데이트
5. 변경 이력에 기록

### 리뷰 주기

- **분기별**: 전체 SLO 달성률 리뷰 + 목표 적정성 평가
- **월간**: 에러 버짓 소진 현황 보고
- **수시**: 신규 서비스 추가 시 SLO 정의 필수

## 6. 파일 구조

```
infra/slo/
  README.md                      # 본 문서 (SLI 표준 정의)
  sli-catalog.yaml               # 전체 SLI/SLO 카탈로그
  api-gateway-slo.yaml           # Critical
  auth-service-slo.yaml          # Critical
  audit-service-slo.yaml         # Critical
  tenant-service-slo.yaml        # High
  user-service-slo.yaml          # High (신규)
  subscription-service-slo.yaml  # High (신규)
  ai-gateway-slo.yaml            # High
  menu-service-slo.yaml          # Standard (신규)
  catalog-service-slo.yaml       # Standard (신규)
  billing-service-slo.yaml       # Standard (신규)
  crm-service-slo.yaml           # Standard (신규)
  notification-service-slo.yaml  # Standard (신규)
  file-service-slo.yaml          # Standard (신규)
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성. 13개 서비스 SLI/SLO 표준 정의 | PM Lead |
