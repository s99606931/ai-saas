# MTU-N132: 운영 대시보드 통합 — Design

> 버전: 1.0 | 작성일: 2026-04-10 | 작성자: PM Lead

## Design Anchor

| 항목 | 내용 |
|------|------|
| Plan 참조 | docs/01-plan/mtus/MTU-N132.plan.md |
| 아키텍처 선택 | Pragmatic Balance — Grafana 홈 대시보드 + Recording Rules |
| 핵심 설계 결정 | 기존 33개 대시보드 재사용, 상태 집약만 신규 구현 |

## 1. 아키텍처 개요

### 1.1 통합 홈 대시보드 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                    운영 대시보드 통합 허브                          │
├─────────┬─────────┬─────────┬─────────┬─────────┬──────────────┤
│ 클러스터 │  SLO    │인시던트 │  보안   │  비용   │   배포/CI    │
│  상태   │  상태   │  상태   │  상태   │  상태   │    상태      │
│ (녹/황/적)│(녹/황/적)│(녹/황/적)│(녹/황/적)│(녹/황/적)│ (녹/황/적)   │
├─────────┴─────────┴─────────┴─────────┴─────────┴──────────────┤
│ 주요 메트릭 요약 (CPU/메모리/에러율/인시던트수/비용추이/배포횟수)       │
├────────────────────────────────────────────────────────────────┤
│ 최근 알림 피드 (Top 10 활성 알림)                                 │
├────────────────────────────────────────────────────────────────┤
│ 대시보드 네비게이션 (6개 카테고리 x 대시보드 링크)                    │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 카테고리 분류

| 카테고리 | 포함 대시보드 | 상태 메트릭 |
|---------|-------------|-----------|
| 클러스터 | optimized-overview, node-exporter-detail, capacity-planning | cluster:cpu/mem/disk 종합 |
| SLO | slo-overview, service-red-metrics, golden-signals (recording rules) | SLO 목표 대비 달성률 |
| 인시던트 | incident-management, distributed-tracing, log-explorer | 활성 인시던트 수 |
| 보안 | security-auth-events, csap-compliance-status, trivy-security-scan, falco-runtime-security, gatekeeper | 보안 이벤트 수 |
| 비용 | finops-cost-analysis, finops-dashboard, vpa-rightsizing, tenant-resource-usage | 예산 대비 사용률 |
| 배포/CI | pipeline-metrics, gitops-status, flux-drift-detection, service-topology | 배포 성공률 |

## 2. Recording Rules 설계

### 2.1 영역별 상태 집약 규칙

```yaml
# 각 영역을 0(정상)/1(경고)/2(위험) 3단계로 집약
# FR-N132.3 구현

# 클러스터 상태: CPU>90% 또는 메모리>90% → 위험
ops_hub:cluster:status
  → 0: cpu<70% AND mem<70%
  → 1: cpu>=70% OR mem>=70%
  → 2: cpu>=90% OR mem>=90%

# SLO 상태: 에러 버짓 소진율 기반
ops_hub:slo:status
  → 0: 모든 SLO 에러 버짓 > 50%
  → 1: 일부 SLO 에러 버짓 < 50%
  → 2: 일부 SLO 에러 버짓 < 10%

# 인시던트 상태: 활성 인시던트 수 기반
ops_hub:incident:status
  → 0: 활성 인시던트 0건
  → 1: P2/P3 인시던트 존재
  → 2: P1 인시던트 존재

# 보안 상태: 미처리 보안 이벤트 기반
ops_hub:security:status
  → 0: critical 이벤트 0건
  → 1: warning 이벤트 존재
  → 2: critical 이벤트 존재

# 비용 상태: 예산 대비 사용률
ops_hub:finops:status
  → 0: 예산 대비 < 80%
  → 1: 예산 대비 80~100%
  → 2: 예산 대비 > 100%

# 배포 상태: 최근 배포 성공률
ops_hub:deploy:status
  → 0: 성공률 > 95%
  → 1: 성공률 80~95%
  → 2: 성공률 < 80%
```

## 3. 대시보드 JSON 설계

### 3.1 홈 대시보드 패널 구성

| 패널 ID | 유형 | 내용 | gridPos |
|---------|------|------|---------|
| 1~6 | stat | 6개 영역 상태 신호등 | 상단 행 (w:4 x 6) |
| 7~12 | gauge/stat | 주요 메트릭 (CPU, 에러율, 인시던트수, 비용, 배포수, DORA) | 두번째 행 |
| 13 | table | 최근 활성 알림 Top 10 | 세번째 행 (w:24) |
| 14~19 | text/links | 카테고리별 대시보드 링크 | 하단 네비게이션 |

### 3.2 신호등 색상 매핑

```
ops_hub:{area}:status == 0 → 녹색 (정상)
ops_hub:{area}:status == 1 → 황색 (경고)
ops_hub:{area}:status == 2 → 적색 (위험)
```

## 4. 네비게이션 스크립트 설계

```bash
# scripts/generate-ops-hub.sh
# 기능: infra/monitoring/dashboards/ 내 모든 대시보드를 탐색하여
#       카테고리별 목록 생성 + 홈 대시보드의 링크 패널 자동 갱신
# 입력: infra/monitoring/dashboards/*.json, *.yaml
# 출력: 콘솔 요약 + 유효성 검증 결과
```

## 5. 검증 테스트 설계

```bash
# scripts/test-ops-hub.sh
# T1: 홈 대시보드 JSON 유효성 (jq 파싱)
# T2: Recording Rules YAML 구문 검증 (yq)
# T3: 모든 드릴다운 대시보드 파일 존재 확인
# T4: 6개 영역 상태 메트릭 정의 확인
# T5: 패널 ID 중복 없음 확인
```

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초기 설계 | PM Lead |
