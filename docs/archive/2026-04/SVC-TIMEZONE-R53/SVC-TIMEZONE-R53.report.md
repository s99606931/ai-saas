# SVC-TIMEZONE-R53 Report — KST Timezone

> **라운드**: R53
> **작성일**: 2026-04-11
> **matchRate**: 100%

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | KST 일관 표기 | 감사·청구·리포트에서 공통 사용 가능 |
| 기술 | 의존성 0 경량 패키지 | Node 내장 Date만 사용 |
| 보안 | 시각 조작 방지 | pure functions, 입력 검증 |
| 감리 | 행안부 표준 시각 | +09:00 고정 라벨 |

## Key Decisions

1. **date-fns-tz/luxon 미사용**: 한국은 DST 없으므로 UTC+9 고정 오프셋으로 단순 계산
2. **토큰 단일 패스 치환**: `YYYY|MM|DD|HH|mm|ss` 정규식 → MM(월)과 mm(분) 충돌 없음
3. **Date 내장 파서 활용**: fromKstIsoString은 `new Date()` 위임 (표준 ISO 8601 오프셋 인식)

## 품질 증거

```
Test Files  3 passed (3)
Tests  31 passed (31)
  - iso: 10 / boundaries: 12 / format: 9
```

## 사용 예시

```ts
import {
  toKstIsoString,
  startOfDayKst,
  endOfMonthKst,
  formatKst,
} from '@public-saas/timezone';

// 감사 로그 (모든 서비스 공통)
logger.info({ at: toKstIsoString(new Date()) });

// 청구 주기
const billingStart = startOfMonthKst(new Date());
const billingEnd = endOfMonthKst(new Date());

// 리포트 파일명
const name = formatKst(new Date(), 'YYYY-MM-DD_HHmm') + '.pdf';
```

## CSAP 매핑

| 항목 | 달성 |
|------|------|
| D-06-03 감사 시각 표준화 | +09:00 고정 |
| D-12 순수 입력 검증 | invalid Date → TypeError |

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
