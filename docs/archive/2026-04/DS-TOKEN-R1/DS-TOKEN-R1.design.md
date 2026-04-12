# DS-TOKEN-R1 Design — 디자인 토큰 시스템 아키텍처

> Plan Ref: docs/01-plan/mtus/DS-TOKEN-R1.plan.md
> 작성일: 2026-04-11

## Design Anchor

- **이전 결정**: 단일 globals.css에 평면 변수 — 확장 불가
- **이번 결정**: W3C Design Tokens Community Group 표준 준수, 3계층 분리
- **다음 영향**: 모든 컴포넌트(원자/분자/유기체)는 semantic/component 토큰만 참조 (base 직접 사용 금지)

## 아키텍처 (3계층)

```
┌─────────────────────────────────────────┐
│ Layer 3: Component Tokens               │
│  --button-primary-bg, --input-radius    │  ← 컴포넌트가 참조
│       ↓ references                       │
├─────────────────────────────────────────┤
│ Layer 2: Semantic Tokens                │
│  --color-surface, --color-on-primary    │  ← 의미론적 역할
│       ↓ references                       │
├─────────────────────────────────────────┤
│ Layer 1: Base Tokens (Primitives)       │
│  --blue-500, --space-4, --radius-md     │  ← 원시 값
└─────────────────────────────────────────┘
```

**규칙**:
- Layer 1은 절대 변하지 않음 (디자인 시스템 어휘)
- Layer 2는 테마별로 재정의됨 (`.theme-finance`에서 `--color-primary`가 다른 base 색상 참조)
- Layer 3은 컴포넌트가 사용 (변경 시 컴포넌트만 영향)

## 옵션 비교

| 옵션 | 설명 | 장점 | 단점 | 채택 |
|------|------|------|------|------|
| A. 단일 파일 평면 | 현재 방식 유지 | 단순 | 테마 추가 시 폭발적 증가 | ❌ |
| B. JS 토큰 (Tailwind config) | tailwind.config.ts에 객체 | 타입 안전 | 런타임 테마 전환 어려움 | ❌ |
| C. CSS 3계층 (W3C 표준) | base→semantic→component | 표준, 런타임 전환, 트리쉐이킹 | 파일 수 증가 | ✅ |

**채택**: 옵션 C — Pragmatic Balance (W3C 표준 + Tailwind v4 `@theme` 통합)

## 파일 구조

```
platform/packages/ui/src/tokens/
├── index.css              # 전체 통합 import
├── base.css               # Layer 1: 원시 토큰
├── semantic.css           # Layer 2: 시맨틱 역할 (default)
├── component.css          # Layer 3: 컴포넌트 토큰
└── themes/
    ├── default.css        # 공공기관 기본
    ├── dark.css           # 다크 모드
    ├── government.css     # 정부24 스타일
    ├── finance.css        # 금융 스타일
    ├── healthcare.css     # 의료 스타일
    └── high-contrast.css  # WCAG AAA
```

## 토큰 명명 규칙 (W3C)

```
--{category}-{property}-{variant}-{state}
```

예시:
- `--color-blue-500` (base, palette)
- `--color-surface-default` (semantic, role)
- `--button-primary-bg-hover` (component, state)

## 색상 팔레트 (Layer 1)

각 색조 11단계 (Tailwind 호환): `50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950`

- **slate**: 중립 그레이 (텍스트/배경)
- **blue**: 공공기관 기본
- **deep-blue**: 정부24 스타일
- **green**: 성공/금융
- **gold**: 금융 액센트
- **mint**: 의료
- **red**: 위험/경고
- **amber**: 주의

## 시맨틱 역할 (Layer 2) — Material Design 3 영감

```css
/* 표면 (Surfaces) */
--color-surface           /* 주 배경 */
--color-surface-variant   /* 보조 배경 (카드) */
--color-surface-container /* 컨테이너 (더 깊은 표면) */
--color-on-surface        /* 표면 위 텍스트 */
--color-on-surface-variant

/* 브랜드 (Primary) */
--color-primary
--color-primary-container
--color-on-primary
--color-on-primary-container

/* 보조 (Secondary, Tertiary) */
--color-secondary, --color-tertiary
--color-on-secondary, --color-on-tertiary

/* 상태 (Status) */
--color-success, --color-on-success
--color-warning, --color-on-warning
--color-error,   --color-on-error
--color-info,    --color-on-info

/* 경계/구분 */
--color-outline
--color-outline-variant
--color-divider

/* 포커스/링 */
--color-focus-ring
```

## Spacing/Radius/Motion 스케일

```css
/* Spacing — 4px 기반 */
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */

/* Radius */
--radius-none: 0;
--radius-sm: 0.25rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-xl: 1rem;
--radius-full: 9999px;

/* Motion */
--motion-duration-fast: 150ms;
--motion-duration-base: 250ms;
--motion-duration-slow: 400ms;
--motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--motion-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
```

## 테마 전환 메커니즘

```html
<html class="theme-finance dark">
```

각 테마 CSS는 `.theme-{name}` 셀렉터 안에서 semantic 토큰 재정의:

```css
.theme-finance {
  --color-primary: var(--color-green-700);
  --color-primary-container: var(--color-green-100);
  --color-secondary: var(--color-gold-500);
  /* ... */
}
.theme-finance.dark { /* 다크 모드 오버라이드 */ }
```

## 접근성 검증 (NFR-DST.1)

각 테마의 핵심 색상 쌍 대비비:
- `on-surface` ↔ `surface` ≥ 4.5:1
- `on-primary` ↔ `primary` ≥ 4.5:1
- 고대비 테마: ≥ 7:1 (AAA)

## Tailwind v4 통합

portal/globals.css:
```css
@import "@public-saas/ui/tokens";

@theme {
  --color-primary: var(--color-primary);
  --color-surface: var(--color-surface);
  --font-sans: var(--font-sans);
}
```

## Session Guide (구현 순서)

1. base.css 작성 (팔레트 + 스케일)
2. semantic.css 작성 (default 테마 기준)
3. component.css 작성 (button/input/card 등 기본 컴포넌트 토큰)
4. themes/*.css 6개 작성
5. tokens/index.css 통합
6. ui 패키지 export 추가
7. portal globals.css 마이그레이션

## 변경 이력
- 2026-04-11 v1.0 PM Lead 최초 작성
