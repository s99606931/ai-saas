# MTU-N126: DORA 메트릭 추적 시스템 -- 설계 문서

> 작성일: 2026-04-10

## Design Anchor

| 항목 | 내용 |
|------|------|
| 패턴 | 셸 스크립트 + Prometheus Recording Rule + Git 히스토리 분석 |
| 의존성 | Gitea API, Prometheus ALERTS 메트릭, CI/CD 파이프라인 메트릭 |
| 산출물 | 분석 스크립트, Recording Rule, E2E 테스트 |

## 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|---------|------|------|
| DORA 보고서 스크립트 | `scripts/generate-dora-report.sh` | 4대 메트릭 계산 + 보고서 생성 |
| Recording Rule | `infra/monitoring/dora-metrics-rules.yaml` | 배포/장애 메트릭 사전 계산 |
| E2E 테스트 | `scripts/test-dora-metrics.sh` | 검증 |

## 아키텍처 결정

### Option A: Git 히스토리 기반 (Pragmatic Balance -- 선택)
- Git 로그에서 배포 이벤트 추출
- Prometheus Recording Rule로 장애 메트릭 계산
- 셸 스크립트로 통합 보고서 생성

### 메트릭 수집 방법

| 메트릭 | 데이터 소스 | 계산 방법 |
|--------|-----------|----------|
| 배포 빈도 (DF) | Git 태그/배포 커밋 | 기간 내 배포 횟수 / 일수 |
| 변경 리드 타임 (CLT) | Git 커밋~태그 시간차 | 평균 커밋-배포 시간차 |
| 변경 실패율 (CFR) | Rollback 이벤트 / 전체 배포 | 롤백 비율 |
| MTTR | ALERTS 메트릭 duration | 평균 장애 지속 시간 |

## Session Guide

1. Plan 검토 (FR-N126.1~5)
2. Recording Rule 구현 (dora-metrics-rules.yaml)
3. 분석 스크립트 구현 (generate-dora-report.sh)
4. E2E 테스트 구현 및 실행 (test-dora-metrics.sh)
