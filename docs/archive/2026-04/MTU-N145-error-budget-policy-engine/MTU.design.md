# MTU-N145: 에러 버짓 자동 정책 엔진 — Design

> **문서 ID**: MTU-N145.design
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead (claude-opus-4-6)
> **Plan 참조**: MTU-N145.plan

---

## Executive Summary

| 관점 | 설계 결정 |
|------|----------|
| 아키텍처 | Prometheus Recording Rules로 에러 버짓 잔여율 계산 → 정책 단계 메트릭 노출 |
| 알림 전략 | 4단계 정책 (GREEN/YELLOW/ORANGE/RED), 단계 전환 시 알림 발송 |
| 배포 게이트 | RED 단계 진입 시 Critical 서비스 배포 동결 권고 알림 |
| 거버넌스 | 동결 해제 조건 명시, 수동 오버라이드 절차 포함 |

## SS1. 에러 버짓 잔여율 계산

```
error_budget_remaining = 1 - (actual_error_rate / allowed_error_rate)
```

- `actual_error_rate`: 30일 윈도우 실제 에러율 (`slo:sli_error:ratio_rate30d`)
- `allowed_error_rate`: SLO 목표에서 도출 (예: 99.9% → 0.001)
- `error_budget_remaining`: 0~1 범위 (0 = 소진, 1 = 미사용)

## SS2. 정책 단계 메트릭

```yaml
# 4단계 숫자 매핑 (대시보드 표시용)
error_budget:policy:level
  0 = GREEN  (잔여 > 50%)
  1 = YELLOW (25~50%)
  2 = ORANGE (10~25%)
  3 = RED    (< 10%)
```

## SS3. 배포 동결 시나리오

```
에러 버짓 < 10% 감지
  → error_budget:policy:level = 3 (RED)
  → 알림: "배포 동결 권고 — {서비스명}"
  → Critical 서비스: 포스트모템 시작 + 안정성 작업 전환
  → Standard 서비스: 경고만 발송

에러 버짓 회복 > 25%
  → error_budget:policy:level → 1 (YELLOW)
  → 알림: "배포 동결 해제 — {서비스명}"
  → 정상 배포 재개
```

---

## Session Guide

| 단계 | 산출물 | 검증 |
|------|--------|------|
| 1 | 에러 버짓 정책 RecordingRules | 4단계 메트릭 정확성 |
| 2 | 단계 전환 알림 규칙 | 진입/해제 알림 동작 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
