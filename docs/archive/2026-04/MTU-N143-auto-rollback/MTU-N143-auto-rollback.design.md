# MTU-N143: 자동 롤백 메커니즘 — Design

> **문서 ID**: MTU-N143.design
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead (claude-opus-4-6)
> **Plan 참조**: MTU-N143.plan

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 아키텍처 | Argo Rollouts AnalysisTemplate 티어별 분리, Prometheus 메트릭 기반 자동 판정 |
| 메트릭 | 에러율 + P95 지연 + 가용성 3중 검증, 실패 시 자동 롤백 트리거 |
| 알림 | 롤백 발생 시 Critical/Warning 차등 알림, 배포 상태 대시보드 연동 |
| 거버넌스 | 롤백 정책 변경 절차, 롤백 이력 보존, 사후 분석(포스트모템) 연결 |

## Design Anchor

| 항목 | 결정 |
|------|------|
| WHY | 배포 장애 자동 감지/복구로 MTTR 최소화, 수동 롤백 의존도 제거 |
| WHAT | 3개 티어별 AnalysisTemplate + 배포 후 자동 검증 + 롤백 알림/기록 |
| HOW | Argo Rollouts AnalysisRun → Prometheus 쿼리 → 임계값 위반 시 자동 abort |

## SS1. 티어별 AnalysisTemplate 설계

### Critical 티어 (가장 엄격)
- 에러율: > 0.5% 시 실패
- P95 지연: > 기준의 2배 시 실패
- 가용성: < 99.9% 시 실패
- 평가: 30초 간격, 10회 측정, 2회 실패 시 즉시 롤백

### High 티어 (표준)
- 에러율: > 1.0% 시 실패
- P95 지연: > 기준의 2배 시 실패
- 가용성: < 99.5% 시 실패
- 평가: 30초 간격, 10회 측정, 3회 실패 시 롤백

### Standard 티어 (관대)
- 에러율: > 2.0% 시 실패
- P95 지연: > 기준의 3배 시 실패
- 가용성: < 99.0% 시 실패
- 평가: 60초 간격, 5회 측정, 3회 실패 시 롤백

## SS2. 배포 후 자동 검증 흐름

```
배포 시작 → Canary 5% 트래픽
  → AnalysisRun 시작 (에러율 + 지연 + 가용성)
  → 5분 관찰
  → 통과 시: 트래픽 25% → 50% → 100%
  → 실패 시: 즉시 abort → 트래픽 100% stable → 알림 발송
```

## SS3. 롤백 알림 체계

| 이벤트 | 심각도 | 알림 대상 | 후속 조치 |
|--------|--------|----------|----------|
| Critical 서비스 롤백 | critical | SRE + 서비스 오너 + 경영진 | 즉시 포스트모템 |
| High 서비스 롤백 | warning | SRE + 서비스 오너 | 24시간 내 원인 분석 |
| Standard 서비스 롤백 | info | SRE 팀 | 주간 리뷰 시 분석 |

## SS4. 롤백 이력 Recording Rules

```yaml
# 롤백 발생 횟수 추적
deployment:rollback:total  # 서비스별 롤백 누적
deployment:rollback:rate   # 서비스별 롤백 빈도 (7일 윈도우)
deployment:success:rate    # 배포 성공률 (전체/서비스별)
```

## SS5. 기존 설정과의 통합

| 기존 파일 | 역할 | 이번 MTU에서의 조치 |
|----------|------|-------------------|
| slo-rollback-analysis.yaml | SLO 기반 롤백 분석 | 통합 참조 (유지) |
| analysis-templates.yaml | 개별 분석 템플릿 | 통합 참조 (유지) |
| canary-api-gateway.yaml | Flagger 카나리 | 통합 참조 (유지) |
| **신규** tiered-analysis-templates.yaml | 티어별 통합 분석 | 신규 생성 |
| **신규** deployment-rollback-rules.yaml | 롤백 감지/알림/기록 | 신규 생성 |

---

## Session Guide

| 단계 | 산출물 | 검증 |
|------|--------|------|
| 1 | 롤백 정책 문서 | 3개 티어 + 절차 + 거버넌스 |
| 2 | 티어별 AnalysisTemplate | YAML 문법 + 임계값 정확성 |
| 3 | 배포 후 검증/알림/기록 규칙 | PrometheusRule 형식 준수 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
