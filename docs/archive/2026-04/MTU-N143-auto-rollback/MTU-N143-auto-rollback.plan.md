# MTU-N143: 자동 롤백 메커니즘 — Plan

> **문서 ID**: MTU-N143.plan
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead (claude-opus-4-6)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 배포 후 에러율 급증 시 자동 롤백으로 서비스 가용성 보장, 공공기관 무중단 요건 충족 |
| 기술 | 티어별 롤백 임계값 표준화, Argo Rollouts AnalysisRun + Prometheus 메트릭 기반 |
| 운영 | 수동 개입 없는 자동 롤백 → MTTR 단축, 운영 부담 감소 |
| 규제 | CSAP D-10 부하분산 + D-06 침해사고 관리 + D-12 시스템 개발 보안 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 기존 Argo Rollouts/Flagger 설정이 개별적으로 존재하나 통합 롤백 정책 부재 |
| WHO | SRE 팀, DevOps 엔지니어, 플랫폼 운영자 |
| RISK | 배포 후 에러율 증가 미감지 시 전체 테넌트 서비스 장애 |
| SUCCESS | 전 서비스 자동 롤백 정책 표준화 + 롤백 알림 규칙 + 배포 후 검증 자동화 |
| SCOPE | 롤백 정책 문서, 티어별 AnalysisTemplate, 배포 후 검증 PrometheusRule, 롤백 알림 |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 기준 |
|-------|---------|---------|----------|
| FR-N143.1 | 자동 롤백 정책 표준 문서 | P0 | 티어별 임계값 + 절차 정의 |
| FR-N143.2 | 티어별 롤백 AnalysisTemplate | P0 | Critical/High/Standard 각 1개 |
| FR-N143.3 | 배포 후 검증 PrometheusRule | P0 | 에러율/지연시간 급증 감지 |
| FR-N143.4 | 롤백 발생 시 알림 규칙 | P1 | Alertmanager 라우팅 + Slack 연동 |
| FR-N143.5 | 롤백 이력 기록 Recording Rules | P1 | 롤백 발생 횟수/서비스별 추적 |

## 티어별 롤백 기준 (설계 입력)

| 티어 | 에러율 임계값 | 지연 임계값 | 평가 윈도우 | 실패 한계 | 롤백 대기 |
|------|------------|-----------|-----------|---------|---------|
| Critical | > 0.5% | P95 > 2x 기준값 | 5분 | 2회 | 즉시 |
| High | > 1.0% | P95 > 2x 기준값 | 5분 | 3회 | 30초 |
| Standard | > 2.0% | P95 > 3x 기준값 | 5분 | 5회 | 60초 |

## 추적성 매트릭스

| FR ID | 산출물 | CSAP | 비고 |
|-------|--------|------|------|
| FR-N143.1 | infra/argo-rollouts/rollback-policy.md | D-10, D-12 | 정책 문서 |
| FR-N143.2 | infra/argo-rollouts/tiered-analysis-templates.yaml | D-10 | 분석 템플릿 |
| FR-N143.3 | infra/monitoring/deployment-rollback-rules.yaml | D-06 | 감지 규칙 |
| FR-N143.4 | infra/monitoring/deployment-rollback-rules.yaml | D-06 | 알림 규칙 |
| FR-N143.5 | infra/monitoring/deployment-rollback-rules.yaml | D-06 | 기록 규칙 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
