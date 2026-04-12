# Design: MTU-N169 DORA 4 Metrics 자동화 대시보드

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## 1. Design Anchor

- Plan 참조: docs/01-plan/mtus/MTU-N169-dora-metrics.plan.md
- 아키텍처 옵션: Pragmatic Balance 선택
- 핵심 결정: Prometheus 커스텀 익스포터 + Grafana 대시보드 + CronJob 리포트

## 2. 아키텍처 개요

```
Gitea Webhook ──→ DORA Exporter (Node.js) ──→ Prometheus
                                                    │
AlertManager ──→ DORA Exporter (MTTR 계산)          │
                                                    ▼
                                              Grafana Dashboard
                                                    │
                                              CronJob Report Gen
```

## 3. 상세 설계

### 3.1 배포 빈도 (Deployment Frequency)

- Gitea webhook (push to main/prod 브랜치) 이벤트 수신
- Prometheus 카운터: `dora_deployment_total{team, service, environment}`
- 일/주/월 단위 rate 계산

### 3.2 변경 리드타임 (Lead Time for Changes)

- 첫 커밋 타임스탬프 → 프로덕션 배포 타임스탬프 차이
- Prometheus 히스토그램: `dora_lead_time_seconds{team, service}`
- Gitea API로 커밋 이력 조회, 배포 이벤트와 매칭

### 3.3 변경 실패율 (Change Failure Rate)

- 롤백 이벤트: Flux/Argo 롤백 감지 또는 `fix:` / `hotfix:` 커밋 패턴
- Prometheus 게이지: `dora_change_failure_rate{team, service}`
- 실패 배포 수 / 전체 배포 수 비율

### 3.4 서비스 복구 시간 (MTTR)

- AlertManager webhook → 장애 시작 타임스탬프 기록
- 알림 해제(resolved) → 복구 타임스탬프 기록
- Prometheus 히스토그램: `dora_mttr_seconds{team, service, severity}`

### 3.5 Prometheus 메트릭 정의

```yaml
# 커스텀 메트릭 목록
- dora_deployment_total          # Counter - 배포 횟수
- dora_lead_time_seconds         # Histogram - 리드타임
- dora_change_failure_rate       # Gauge - 변경 실패율
- dora_mttr_seconds              # Histogram - 복구 시간
- dora_team_level                # Gauge - DORA 등급 (0=Low, 1=Med, 2=High, 3=Elite)
```

### 3.6 Grafana 대시보드

- 4대 지표 Overview 패널
- 팀별/서비스별 필터 변수
- 30일/90일/1년 트렌드 그래프
- DORA 등급 게이지 (색상 코드: Elite=녹색, Low=적색)
- 벤치마크 비교선 (DORA 2024 보고서 기준)

### 3.7 리포트 자동 생성

- Kubernetes CronJob: 매주 월요일 09:00 실행
- Grafana API로 대시보드 스냅샷 조회
- Markdown/PDF 형식 리포트 생성
- 저장 경로: `/reports/dora/weekly-{date}.md`

### 3.8 DORA 등급 자동 분류

| 등급 | DF | LT | CFR | MTTR |
|------|----|----|-----|------|
| Elite | 일 다회 | < 1시간 | < 5% | < 1시간 |
| High | 일 1회~주 1회 | 1시간~1일 | 5~10% | < 24시간 |
| Medium | 주 1회~월 1회 | 1일~1주 | 10~15% | 1~7일 |
| Low | 월 1회 미만 | > 1주 | > 15% | > 7일 |

## 4. Session Guide

1. DORA 익스포터 TypeScript 구현
2. Prometheus ServiceMonitor 설정
3. Grafana 대시보드 JSON 프로비저닝
4. CronJob 리포트 생성기
5. Helm values 통합
6. E2E 테스트

## 5. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 최초 작성 | PM Lead |
