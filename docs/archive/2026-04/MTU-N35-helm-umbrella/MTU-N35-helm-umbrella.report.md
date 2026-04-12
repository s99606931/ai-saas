# Report: MTU-N35 Helm Umbrella Chart

| 항목 | 내용 |
|------|------|
| 문서 ID | REPORT-N35-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| 작성자 | PM Lead (Opus 4.6) |
| matchRate | 100% (7/7 FR) |

---

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 단일 명령 전체 스택 배포 | 100% |
| 기술 | Umbrella + 공통 라이브러리 + 환경별 values | 100% |
| 보안 | CSAP D-07/D-12 배포 표준화 | 100% |
| 운영 | 기존 kustomize와 병행 운영 | 100% |

## 성공 기준 달성 현황

| FR ID | 설명 | 상태 | 증적 |
|-------|------|------|------|
| FR-N35.1 | Umbrella Chart.yaml 구조 | PASS | 20개 하위 차트 의존성 |
| FR-N35.2 | 공통 라이브러리 차트 | PASS | common/templates/_helpers.tpl |
| FR-N35.3 | 마이크로서비스 하위 차트 16개 | PASS | charts/ 16 service dirs |
| FR-N35.4 | 인프라 하위 차트 3개 | PASS | postgres, redis, minio |
| FR-N35.5 | 환경별 values 파일 | PASS | values.yaml, values-dev.yaml, values-stg.yaml |
| FR-N35.6 | helm lint 통과 | PASS | 0 failures (1 INFO) |
| FR-N35.7 | Umbrella Chart 사용 가이드 | PASS | docs/07-infra/helm-umbrella-guide.md |

## 주요 성과

### 차트 구조
- Umbrella Chart + 19 하위 차트 + 1 라이브러리 차트 = 21개 차트
- 각 하위 차트: Chart.yaml + values.yaml + templates/ (4파일)
- 총 생성 파일: 약 100개

### 렌더링 검증
- helm template: 19 Deployment + 19 Service + 19 ServiceAccount = 57 리소스
- dev 환경: 16 서비스 (3개 비활성)
- stg 환경: 19 서비스 (전체)

### 공통 패턴
- 라벨링: `app.kubernetes.io/part-of: saas-platform` 통일
- 리소스: 환경별 3단계 (32Mi/64Mi/128Mi)
- 헬스체크: `/health` 표준 경로

## 생성된 파일

### 핵심 파일
- infra/helm/saas-platform/Chart.yaml
- infra/helm/saas-platform/values.yaml
- infra/helm/saas-platform/values-dev.yaml
- infra/helm/saas-platform/values-stg.yaml
- infra/helm/saas-platform/charts/common/ (라이브러리)
- infra/helm/saas-platform/charts/{19 services}/ (하위 차트)

### 문서
- docs/00-pm/MTU-N35-helm-umbrella.prd.md
- docs/01-plan/mtus/MTU-N35-helm-umbrella.plan.md
- docs/02-design/mtus/MTU-N35-helm-umbrella.design.md
- docs/04-report/MTU-N35-helm-umbrella.report.md
- docs/07-infra/helm-umbrella-guide.md

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 완료 보고서 작성 | PM Lead |
