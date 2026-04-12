# SVC-TIMEZONE-R53 Design — KST Timezone 유틸리티

> **작성일**: 2026-04-11

---

## 1. 아키텍처 결정

| 옵션 | 장점 | 단점 | 선정 |
|------|------|------|------|
| A. date-fns-tz | 풍부한 API | 의존성 + 빌드 크기 | - |
| B. luxon | 완전한 타임존 지원 | 오버엔지니어링 | - |
| **C. Intl.DateTimeFormat + 순수 계산** | 의존성 0, 빠름 | 수동 파싱 | **선정** |

한국은 DST 없음 → UTC+9 고정 오프셋으로 단순 계산 가능.

---

## 2. 상세 설계

### 상수

```ts
export const KST_OFFSET_MINUTES = 9 * 60; // 540
export const KST_OFFSET_MS = KST_OFFSET_MINUTES * 60_000;
export const KST_OFFSET_LABEL = '+09:00';
```

### 2.1 iso.ts

```ts
export function toKstIsoString(date: Date): string {
  const kstMs = date.getTime() + KST_OFFSET_MS;
  const k = new Date(kstMs);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${k.getUTCFullYear()}-${pad(k.getUTCMonth() + 1)}-${pad(k.getUTCDate())}` +
    `T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}:${pad(k.getUTCSeconds())}` +
    `${KST_OFFSET_LABEL}`
  );
}

export function fromKstIsoString(s: string): Date {
  // 표준 Date 파싱이 offset 인식하므로 그대로 사용
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new RangeError(`invalid KST ISO: ${s}`);
  return d;
}
```

### 2.2 boundaries.ts

월/일 경계: KST로 환산 후 해당 경계 계산 → UTC로 역변환.

```ts
function withKstParts(date: Date, mutate: (y: number, mo: number, d: number) => { y: number; mo: number; d: number; h: number; mi: number; s: number; ms: number }): Date {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const mo = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const parts = mutate(y, mo, d);
  // Date.UTC로 만든 후 KST offset 역적용
  const kstTargetMs = Date.UTC(parts.y, parts.mo, parts.d, parts.h, parts.mi, parts.s, parts.ms);
  return new Date(kstTargetMs - KST_OFFSET_MS);
}

export function startOfDayKst(date: Date): Date { ... }
export function endOfDayKst(date: Date): Date { ... }
export function startOfMonthKst(date: Date): Date { ... }
export function endOfMonthKst(date: Date): Date { ... }
```

### 2.3 format.ts

```ts
export function formatKst(date: Date, pattern: string): string {
  const parts = getKstDateParts(date);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return pattern
    .replace(/YYYY/g, String(parts.year))
    .replace(/MM/g, pad2(parts.month))
    .replace(/DD/g, pad2(parts.day))
    .replace(/HH/g, pad2(parts.hour))
    .replace(/mm/g, pad2(parts.minute))
    .replace(/ss/g, pad2(parts.second));
}
```

`mm`(분)과 `MM`(월) 충돌 방지: 순차적 치환 시 토큰 우선순위 큰 것 먼저 → 토큰 기반 파서로 해결 또는 고정 순서.

설계 결정: pattern을 정규식으로 토큰화 `(YYYY|MM|DD|HH|mm|ss)` 로 단일 pass 치환.

### 2.4 getKstDateParts

```ts
export interface KstDateParts {
  year: number;
  month: number;  // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  dayOfWeek: number;  // 0=Sunday
}

export function getKstDateParts(date: Date): KstDateParts {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    hour: kst.getUTCHours(),
    minute: kst.getUTCMinutes(),
    second: kst.getUTCSeconds(),
    dayOfWeek: kst.getUTCDay(),
  };
}
```

---

## 3. 테스트 전략

| 파일 | 케이스 |
|------|--------|
| iso.test.ts | toKst 포맷(4), fromKst 파싱(3), 왕복(1), 잘못된 문자열(1) |
| boundaries.test.ts | startOfDay(3), endOfDay(2), startOfMonth(3), endOfMonth(3, 윤년 포함) |
| format.test.ts | YYYY-MM-DD(1), HH:mm:ss(1), MM와 mm 혼용(1), getKstDateParts(2) |

총 25+ 케이스.

---

## 4. 변경 이력

| 버전 | 일자 | 내용 |
|------|------|------|
| 1.0.0 | 2026-04-11 | 최초 작성 |
