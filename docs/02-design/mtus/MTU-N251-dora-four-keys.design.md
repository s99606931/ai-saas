# MTU-N251: DORA Four Keys 완전 자동화 설계서

> **문서 ID**: MTU-N251.design
> **작성일**: 2026-04-11
> **작성자**: PM Lead (AI)
> **버전**: 1.0.0
> **Plan 참조**: MTU-N251.plan.md

---

## 1. Executive Summary

기존 DORA Recording Rules (MTU-N126)를 대폭 강화하여, Gitea 이벤트 기반의 정밀한 Four Keys 메트릭을 수집하고, 통합 대시보드와 CI/CD 게이트를 제공합니다.

## 2. 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. Gitea Plugin | Gitea 내장 플러그인으로 메트릭 노출 | 저지연 | Gitea 버전 종속 |
| B. Webhook Exporter | Gitea webhook → 경량 Exporter → Prometheus | 독립적, 확장 가능 | 추가 컴포넌트 |
| **C. Recording Rules 강화** | 기존 K8s 메트릭 + Gitea API 폴링 조합 | 추가 인프라 최소 | API 부하, 정밀도 중간 |

**선택: B + C 하이브리드** (Pragmatic Balance)
- Recording Rules v2로 기존 규칙 고도화 (C)
- DORA 이벤트 기록 스크립트로 CI/CD 파이프라인에서 메트릭 push (B 간소화)
- Grafana 대시보드로 Four Keys 통합 시각화

## 3. 상세 설계

### 3.1 DORA 이벤트 기록 스크립트 (FR-N251.1)

CI/CD 파이프라인에서 호출하여 배포 이벤트를 Prometheus Pushgateway로 전송합니다.

```
파이프라인 → scripts/dora-event-push.sh → Pushgateway → Prometheus
```

**수집 이벤트**:
- `dora_deployment_total` (배포 발생)
- `dora_deployment_duration_seconds` (빌드~배포 소요시간)
- `dora_deployment_failure_total` (실패 배포)
- `dora_incident_created_total` (인시던트 생성)
- `dora_incident_resolved_total` (인시던트 해결)
- `dora_incident_duration_seconds` (인시던트 지속시간)

### 3.2 Recording Rules v2 (FR-N251.2, 3)

기존 `dora-metrics-rules.yaml`을 대체하는 v2 규칙:

**배포 빈도**:
- `dora:deployment_frequency:hourly` — 시간당 배포 횟수
- `dora:deployment_frequency:daily` — 일간 배포 횟수 (push 기반)
- `dora:deployment_frequency:weekly` — 주간 배포 횟수
- `dora:deployment_frequency:monthly` — 월간 배포 횟수
- `dora:deployment_frequency:by_team` — 팀별 배포 횟수

**변경 리드타임**:
- `dora:lead_time:p50` — 중앙값 리드타임
- `dora:lead_time:p90` — 90번째 백분위
- `dora:lead_time:p99` — 99번째 백분위

### 3.3 MTTR 계산 (FR-N251.4)

- `dora:mttr:avg` — 평균 복구 시간
- `dora:mttr:p50` — 중앙값 복구 시간
- `dora:mttr:p90` — 90번째 백분위 복구 시간

### 3.4 변경 실패율 (FR-N251.5)

```
CFR = (failed_deployments + rollbacks + hotfixes) / total_deployments * 100
```

- `dora:change_failure_rate:ratio` — 종합 CFR%
- `dora:change_failure_rate:by_team` — 팀별 CFR%

### 3.5 DORA 등급 판정 (FR-N251.6)

Google DORA 연구 기준:

| 등급 | DF | LT | CFR | MTTR |
|------|----|----|-----|------|
| Elite | 주 수회+ | <1시간 | <5% | <1시간 |
| High | 주 1회~월 1회 | 1일~1주 | 5~15% | <1일 |
| Medium | 월 1회~반기 1회 | 1주~1월 | 15~30% | 1일~1주 |
| Low | 반기 미만 | >1월 | >30% | >1주 |

Recording Rule:
- `dora:grade:deployment_frequency` — DF 등급 (1=Elite, 2=High, 3=Medium, 4=Low)
- `dora:grade:lead_time` — LT 등급
- `dora:grade:change_failure_rate` — CFR 등급
- `dora:grade:mttr` — MTTR 등급
- `dora:grade:overall` — 종합 등급 (4개 평균)

### 3.6 Grafana 대시보드 (FR-N251.7)

**패널 구성**:
1. Four Keys 종합 뷰 (스탯 패널 4개 + 종합 등급)
2. 배포 빈도 추세 (Bar Chart, 일별)
3. 리드타임 분포 (Heatmap, P50/P90/P99)
4. 변경 실패율 추세 (Line + Threshold)
5. MTTR 추세 (Line + SLO 목표선)
6. DORA 등급 게이지 (Gauge, 4단계)
7. 팀별 비교 (Table)
8. 30일 트렌드 (Sparkline)

### 3.7 CI/CD DORA 게이트 (FR-N251.8)

`.gitea/workflows/dora-gate.yml`:
- 배포 전 DORA 메트릭 조회
- CFR > 30% → 배포 차단 (DORA Low 등급)
- CFR > 15% → 경고 후 수동 승인 요구
- 감사 로그 기록

### 3.8 DORA 보고서 v2 (FR-N251.9)

기존 `generate-dora-report.sh`를 확장하여:
- Four Keys 요약 테이블
- 등급 변화 추이 (이전 주 대비)
- 개선 권고사항 자동 생성
- CSAP D-06 증빙 형식 준수

---

## 4. 산출물 목록

| # | 파일 경로 | 설명 |
|---|----------|------|
| 1 | `infra/monitoring/dora-metrics-rules-v2.yaml` | Recording Rules v2 |
| 2 | `infra/monitoring/dashboards/dora-four-keys.json` | Grafana 대시보드 |
| 3 | `infra/monitoring/dora-alerting-rules-v2.yaml` | DORA 알림 규칙 v2 |
| 4 | `.gitea/workflows/dora-gate.yml` | CI/CD DORA 게이트 |
| 5 | `scripts/dora-event-push.sh` | DORA 이벤트 Push 스크립트 |
| 6 | `scripts/generate-dora-report-v2.sh` | DORA 보고서 v2 |
| 7 | `scripts/verify-dora-four-keys.sh` | 검증 스크립트 |

---

## 5. Session Guide

```
구현 순서:
1. Recording Rules v2 (핵심 메트릭 정의)
2. DORA 이벤트 Push 스크립트 (CI/CD 연동 기반)
3. 알림 규칙 v2 (등급 기반 경고)
4. Grafana 대시보드 (시각화)
5. CI/CD DORA 게이트 (배포 차단 로직)
6. 보고서 v2 (감리 증빙)
7. 검증 스크립트
```

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead (AI) |
