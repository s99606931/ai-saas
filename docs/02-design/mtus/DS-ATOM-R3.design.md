# DS-ATOM-R3 — Design (Select · Radio · Avatar · Tooltip)

> **Plan Ref**: `docs/01-plan/mtus/DS-ATOM-R3.plan.md`
> **작성일**: 2026-04-11
> **작성자**: frontend-architect

---

## Executive Summary

| 관점 | 결정 사항 |
|------|----------|
| 기술 | 네이티브 HTML + ARIA 직구현 (Radix 미설치 환경 고려) |
| 재사용 | 기존 `cn`, `cva`, CSS 토큰 시스템 100% 재사용 |
| 접근성 | WCAG 2.2 AA — 키보드 · 스크린리더 · reduced-motion 완비 |
| 테스트 | Vitest + @testing-library/react + userEvent, 컴포넌트당 5~8개 |

## Design Anchor

- **3개 아키텍처 옵션 평가**:
  1. **Radix UI 래핑** — ❌ 의존성 미설치 상태, 설치 시 lock 재생성·빌드 영향 큼
  2. **Headless UI 래핑** — ❌ 동일한 의존성 추가 부담
  3. **Native HTML + ARIA 직구현** — ✅ **Pragmatic Balance 선택**. Button/Input/Checkbox 기존 패턴과 동질성 유지
- **선택 근거**: DS-ATOM-R1/R2가 이미 네이티브 HTML 기반(Input·Checkbox·Switch)이므로 Radix 의존을 R3에서 처음 도입하면 일관성 파괴. Select/Radio는 네이티브 원소로 충분히 접근성을 달성 가능. Tooltip만 커스텀 상태 기계 필요.

---

## 1. Select 컴포넌트 설계

### API

```typescript
interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  options: SelectOption[];
  placeholder?: string;
  error?: boolean | string;
  leadingIcon?: ReactNode;
  helperText?: ReactNode;
  wrapperClassName?: string;
}
```

### 구조

- 루트: `<div class="relative">` (leadingIcon 배치용)
- 네이티브 `<select>` — 스타일은 `inputVariants` 재사용 (size, icon)
- 우측 끝 ▼ 화살표 (Lucide `ChevronDown`) — `pointer-events-none`
- placeholder 항목: `<option value="" disabled>{placeholder}</option>`
- 에러 메시지 + 헬퍼 텍스트: Input 컴포넌트와 동일 패턴

### 접근성

- `aria-invalid`, `aria-describedby`, `aria-required` — Input과 동일하게 자동 연결
- 키보드: 브라우저 네이티브 위임 (스페이스로 열기, 화살표로 탐색, 엔터 선택)
- 라벨 연결: `id` prop + `FormField`가 자동 주입

### 파일 구조

```
atoms/Select/
  index.tsx          — Select forwardRef
  Select.variants.ts — inputVariants 재사용 (별도 variants 필요 없으면 생략)
  Select.test.tsx    — 6~7 테스트
```

---

## 2. Radio / RadioGroup 설계

### API

```typescript
interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  error?: boolean;
}

interface RadioGroupProps {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}
```

### 구조

- `Radio`: Checkbox와 유사한 네이티브 `<input type="radio">` + 라벨 inline
- `RadioGroup`: `<div role="radiogroup">` 래퍼, children `<Radio>`에 name/checked/onChange Context 주입
- **Context 사용**: `RadioGroupContext` — name, value, onChange, disabled
- Radio 내부에서 context 감지 시 `name/checked/onChange/disabled` 자동 연결

### 접근성

- `role="radiogroup"` + `aria-required` + `aria-invalid`
- 키보드 네비게이션: 브라우저 네이티브 (화살표 키로 라디오 간 이동)
- 라벨 연결: `<label>` 래핑

### 파일 구조

```
atoms/Radio/
  index.tsx       — Radio + RadioGroup + Context 모두 여기
  Radio.test.tsx  — 6~8 테스트
```

---

## 3. Avatar 설계

### API

```typescript
interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt: string;               // 필수 — 접근성
  name?: string;             // 이니셜 생성용
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  status?: 'online' | 'offline' | 'busy' | 'away';
  fallback?: ReactNode;      // 커스텀 폴백 (우선순위: fallback > 이니셜 > alt 첫 글자)
}
```

### 동작

- src 있음 → `<img>` 렌더, `onError`로 이미지 로드 실패 시 폴백으로 전환 (useState)
- src 없음 또는 에러 → 이니셜 계산:
  - `name` 있으면: 한글이면 첫 글자, 영문이면 공백 기준 첫 두 단어의 첫 글자 (예: "홍길동"→"홍", "John Doe"→"JD")
  - 없으면: `alt`의 첫 글자
- 배경색: `name` 문자열 해시 기반 결정적 색상 5개 팔레트 순환 (CSS 변수)
- status 인디케이터: 우하단 절대 위치 작은 점, 색상 토큰 사용

### 접근성

- `<img alt={alt}>` — 필수 alt
- 이니셜 폴백 시 `<span role="img" aria-label={alt}>`

### 사이즈 매핑

| size | px | font |
|------|-----|------|
| xs | 24 | xs |
| sm | 32 | sm |
| md | 40 | md |
| lg | 56 | lg |
| xl | 80 | xl |

### 파일 구조

```
atoms/Avatar/
  index.tsx            — Avatar
  Avatar.variants.ts   — size/shape CVA
  Avatar.test.tsx      — 6~8 테스트
```

---

## 4. Tooltip 설계

### API

```typescript
interface TooltipProps {
  content: ReactNode;
  children: ReactElement;        // trigger 요소 (단일)
  side?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;                // ms (default 300)
  disabled?: boolean;
  className?: string;
  id?: string;                   // aria-describedby 용
}
```

### 동작

- 상태: `open: boolean`, `timer: ref`
- trigger(children)에 cloneElement로 이벤트 주입:
  - `onMouseEnter` / `onFocus` → `delay` 후 open=true
  - `onMouseLeave` / `onBlur` → open=false, 타이머 취소
  - `onKeyDown` (ESC) → open=false
- trigger에 `aria-describedby={tooltipId}` 주입
- tooltip 패널: `<div role="tooltip" id={tooltipId} data-side={side}>` — CSS transform으로 위치
- 위치 계산: trigger의 `getBoundingClientRect` 기반 포지셔닝 (Portal 생략 — 단순 absolute 래퍼)
- **단순화**: React Portal 없이 trigger 부모에 `relative` + tooltip `absolute` 배치
  - side=top → `bottom: 100%; left: 50%; transform: translateX(-50%) translateY(-8px)`
  - side=bottom → `top: 100%`
  - side=left → `right: 100%`
  - side=right → `left: 100%`
- reduced-motion: `@media (prefers-reduced-motion: reduce)` 시 opacity 전환만

### 접근성

- `role="tooltip"`, `aria-describedby` 자동 연결
- 키보드: trigger 포커스 시 표시, ESC로 닫기
- 동시에 다수 표시 방지: open 상태는 각 Tooltip 인스턴스 독립

### 파일 구조

```
atoms/Tooltip/
  index.tsx        — Tooltip wrapper + panel
  Tooltip.test.tsx — 5~7 테스트
```

---

## Session Guide (구현 순서)

1. Select (FormField와 즉시 호환) — 가장 단순, inputVariants 재사용
2. Radio + RadioGroup — Context 도입 필요, 중간 난이도
3. Avatar — 이니셜 생성 유틸 + 해시 색상 팔레트
4. Tooltip — 상태 기계 + 위치 계산, 가장 복잡
5. 각 컴포넌트 완성 직후 테스트 작성 및 `atoms/index.ts` 갱신
6. 모든 구현 완료 후 `packages/ui/src/index.ts` 루트 export 갱신

## 토큰 매핑

- Select: `--input-*` 토큰 재사용
- Radio: `--color-primary`, `--color-outline-strong`, `--color-focus-ring`
- Avatar: `--color-surface-alt`, `--radius-full` (circle), `--radius-md` (square), status 색상 `--color-success/error/warning/on-surface-muted`
- Tooltip: `--color-inverse-surface`, `--color-inverse-on-surface`, `--radius-sm`, `--shadow-md`, `--motion-duration-fast`

## 위험 및 완화

| 위험 | 완화책 |
|------|-------|
| 네이티브 `<select>` 스타일링 한계 (브라우저별 다름) | `appearance: none` + 커스텀 ▼ 화살표, IE 지원 불필요 |
| Tooltip 위치 계산 복잡도 | 단순 absolute 전략, 스크롤 경계 처리는 R4에서 |
| 테스트 환경 jsdom의 포커스/호버 제약 | userEvent로 실제 이벤트 발생, 상태 검증 중심 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|-----|-----|-----|-------|
| 1.0.0 | 2026-04-11 | 초안 작성 | frontend-architect |
