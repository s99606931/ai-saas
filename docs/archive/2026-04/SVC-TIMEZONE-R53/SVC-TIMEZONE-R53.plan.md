# SVC-TIMEZONE-R53 Plan — KST Timezone 유틸리티

> **MTU ID**: SVC-TIMEZONE-R53
> **라운드**: R53 (3회차 고도화 루프 #4)
> **작성일**: 2026-04-11
> **작성자**: PM Lead
> **상태**: Plan 완료

---

## Executive Summary

| 관점 | 핵심 내용 |
|------|---------|
| 비즈니스 | 공공기관 SaaS의 모든 감사 로그/청구 주기/리포트가 한국 표준시(KST, UTC+9)로 일관 표기 |
| 기술 | `@public-saas/timezone` — Intl.DateTimeFormat + 순수 JS (의존성 0) |
| 보안 | 감사 로그 시각 조작 방지 (단조성 보장 옵션) |
| 감리 | 행안부 감리기준 — 로그/리포트 시각 표준화 |

---

## Context Anchor

- **WHY**: 기존 서비스들이 `new Date().toISOString()` (UTC)와 `ko-KR` 로케일을 혼재 사용 → 감리 대응 시 혼란
- **WHO**: 감사 로그, 청구 주기, 월간 리포트, 대시보드
- **RISK**: DST(서머타임) — 한국은 미적용이지만 API는 일반적으로 작성
- **SUCCESS**: 8개 유틸 함수 제공 + 30 테스트 통과
- **SCOPE**:
  - KST 고정 오프셋 유틸 (DST 없음)
  - 월/일/시 경계 계산 (청구 주기용)
  - ISO 8601 with offset 포맷 (감사 로그용)
  - 포함: pure functions
  - 제외: moment.js 호환, 달력 계산(음력/공휴일)

---

## 요구사항 (FR)

| ID | 설명 | 우선순위 |
|----|------|--------|
| FR-TZ.1 | `toKstIsoString(date)` — Date를 `YYYY-MM-DDTHH:mm:ss+09:00` 형식 | P0 |
| FR-TZ.2 | `fromKstIsoString(str)` — ISO with offset을 Date로 파싱 | P0 |
| FR-TZ.3 | `startOfDayKst(date)` — KST 기준 00:00:00을 Date로 반환 | P0 |
| FR-TZ.4 | `endOfDayKst(date)` — KST 기준 23:59:59.999 | P0 |
| FR-TZ.5 | `startOfMonthKst(date)` — KST 기준 월초 | P0 |
| FR-TZ.6 | `endOfMonthKst(date)` — KST 기준 월말 | P0 |
| FR-TZ.7 | `formatKst(date, pattern)` — 패턴 기반 포맷 (YYYY, MM, DD, HH, mm, ss) | P0 |
| FR-TZ.8 | `getKstDateParts(date)` — `{year,month,day,hour,minute,second,dayOfWeek}` | P1 |
| NFR-TZ.1 | 모든 함수는 순수 (부작용 없음) | P0 |
| NFR-TZ.2 | UTC 타임존에서도 동일 결과 (테스트 환경 고정 TZ) | P0 |

---

## 추적성 매트릭스

| FR ID | 파일 | 테스트 |
|-------|------|--------|
| FR-TZ.1~.2 | `src/iso.ts` | `tests/iso.test.ts` |
| FR-TZ.3~.6 | `src/boundaries.ts` | `tests/boundaries.test.ts` |
| FR-TZ.7~.8 | `src/format.ts` | `tests/format.test.ts` |

---

## 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
