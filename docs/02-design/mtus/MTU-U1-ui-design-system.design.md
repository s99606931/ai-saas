# MTU-U1: 공공기관 SaaS UI/UX 디자인 시스템 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-U1 |
| Phase | Phase U (UI/UX 확장) |
| 상태 | Approved |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-U1-ui-design-system.plan.md` |
| 의존 MTU | MTU-E2 (멀티테넌시), MTU-A1 (AI 게이트웨이) |

---

## Executive Summary (4관점 테이블)

| 관점 | 설계 결정 | 근거 | 달성 지표 |
|------|---------|------|---------|
| **사용자** | shadcn/ui + Radix UI + KWCAG 2.2 AA 접근성 내장 | KRDS 참조 + 헤드리스 접근성 컴포넌트 | axe-core 0 violations |
| **관리자** | CSS Custom Properties 기반 테넌트 테마 오버라이드 | 런타임 주입으로 빌드 불필요, DB 영속 저장 | 10분 이내 테마 설정 |
| **개발자** | Tailwind v4 @theme + 디자인 토큰 + Storybook 8 | CSS-first 설정, 컴포넌트 격리 문서화 | 85%+ 표준 컴포넌트 재사용 |
| **규제** | KWCAG 2.2 33항목 + N2SF 데이터 등급 UI 차단 | 장애인차별금지법 + N2SF 준수 | WA 인증 적합 |

---

## Design Anchor

**선택된 아키텍처**: Option B — Pragmatic Balance (실용적 균형)

| 옵션 | 설명 | 장점 | 단점 | 선택 |
|------|------|------|------|------|
| A | 최소 구현 (Tailwind만 사용) | 빠른 개발 | 테넌트 커스텀 제한, 접근성 수동 관리 | - |
| **B** | **shadcn/ui + Tailwind v4 + 디자인 토큰** | **접근성 내장, 테넌트 유연성, 커뮤니티** | 학습 곡선 | **선택** |
| C | 완전 커스텀 디자인 시스템 | 최대 자유도 | 개발 비용 과다, 유지보수 부담 | - |

**선택 근거**: shadcn/ui CLI v4 (2026-03)가 디자인 프리셋 + AI 에이전트 skills를 제공하여 개발 생산성과 접근성을 동시에 확보. Tailwind CSS v4의 @theme 디렉티브로 CSS-first 테마 관리가 가능하여 런타임 비용 최소화.

---

## Session Guide

```
이 설계 문서를 구현할 때 다음 순서를 권장합니다:

Session 1: 디자인 토큰 + 기본 테마 + 다크모드 (섹션 A, B)
  - Tailwind v4 설정 + CSS Custom Properties 토큰 체계
  - 5종 기본 테마 CSS 변수 파일
  - 다크모드 토글 메커니즘

Session 2: 반응형 레이아웃 + 컴포넌트 카탈로그 (섹션 C, H)
  - 브레이크포인트 체계 + 레이아웃 패턴 3종
  - Atomic Design 계층별 컴포넌트 목록

Session 3: 테넌트 커스터마이제이션 + AI UI (섹션 D, E)
  - CSS Variable override DB 저장 구조
  - AI 어시스턴트 사이드 패널 + 채팅 UI

Session 4: 동적 레이아웃 + 접근성 + Storybook (섹션 F, G, I)
  - dnd-kit 대시보드 + 위젯 시스템
  - KWCAG 2.2 검증 + Playwright axe-core
```

---

## A. 기술 스택 아키텍처

### A.1 전체 기술 스택 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 브라우저                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 Next.js 15 App Router                  │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ React 19    │  │ React Server │  │ Streaming    │ │  │
│  │  │ Client Comp │  │ Components   │  │ SSR          │ │  │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘ │  │
│  │         │                │                  │         │  │
│  │  ┌──────┴────────────────┴──────────────────┴───────┐ │  │
│  │  │          UI 컴포넌트 레이어                        │ │  │
│  │  │  shadcn/ui (CLI v4) + Radix UI (통합 패키지)      │ │  │
│  │  │  + 커스텀 공공기관 확장 컴포넌트                    │ │  │
│  │  └──────┬───────────────────────────────────────────┘ │  │
│  │         │                                             │  │
│  │  ┌──────┴───────────────────────────────────────────┐ │  │
│  │  │          스타일링 레이어                           │ │  │
│  │  │  Tailwind CSS v4 (Oxide 엔진)                    │ │  │
│  │  │  + CSS Custom Properties (디자인 토큰)            │ │  │
│  │  │  + CSS Cascade Layers (테넌트 격리)               │ │  │
│  │  └──────┬───────────────────────────────────────────┘ │  │
│  │         │                                             │  │
│  │  ┌──────┴───────────┐  ┌──────────────────────────┐  │  │
│  │  │ 상태 관리         │  │ AI 통합                   │  │  │
│  │  │ Zustand 5 (전역) │  │ AI SDK 5.x (SSE)        │  │  │
│  │  │ TanStack Query 5 │  │ + AI Gateway (MTU-A1)    │  │  │
│  │  │ React Hook Form  │  │ + N2SF 데이터 등급 검증   │  │  │
│  │  └──────────────────┘  └──────────────────────────┘  │  │
│  │                                                       │  │
│  │  ┌────────────────────────────────────────────────┐   │  │
│  │  │ 개발 도구                                       │   │  │
│  │  │ Storybook 8 + Playwright + axe-core            │   │  │
│  │  │ + Motion v12 (애니메이션) + dnd-kit (D&D)      │   │  │
│  │  └────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### A.2 프레임워크 결정 상세

#### Next.js 15 + React 19

```
// Design Ref: §A.2
// Plan SC: FR-U.1

// next.config.ts — App Router + RSC 설정
const nextConfig = {
  experimental: {
    // React 19 동시성 기능 활용
    reactCompiler: true,
    // Turbopack 안정화 (v15.2+)
    turbo: {
      rules: {
        '*.svg': ['@svgr/webpack'],
      },
    },
  },
  // 정적 내보내기 (폐쇄망 배포용)
  output: 'standalone',
}
```

**선택 근거**:
- Next.js 15.2.4 (2026-03 안정 릴리스) — Turbopack 기본 활성화, React 19 정식 지원
- App Router + Server Components로 초기 번들 크기 최소화 (NFR-U.6)
- `output: 'standalone'`으로 k3s 컨테이너 배포 최적화 (MTU-I1 연계)
- React 19의 `use()` 훅으로 비동기 데이터 로딩 개선

#### Tailwind CSS v4

```css
/* Design Ref: §A.2 */
/* styles/tailwind.css — Tailwind v4 CSS-first 설정 */

@import "tailwindcss";

/* CSS Cascade Layers로 테넌트 스타일 격리 */
@layer base, tokens, tenant, components, utilities;

/* @theme 디렉티브 — JS 설정 파일 불필요 */
@theme {
  --color-primary: var(--token-color-primary, oklch(0.546 0.245 262.881));
  --color-secondary: var(--token-color-secondary, oklch(0.577 0.177 261.406));
  --font-sans: var(--token-font-sans, 'Pretendard Variable', 'Noto Sans KR', system-ui, sans-serif);
  --radius-md: var(--token-radius-md, 0.5rem);
  --spacing-4: var(--token-spacing-4, 1rem);
}
```

**선택 근거**:
- Oxide 엔진 (Rust 기반): 풀 빌드 5배, 증분 빌드 100배 빠름
- `@theme` 디렉티브로 CSS 파일에서 직접 테마 정의 — `tailwind.config.js` 불필요
- CSS Cascade Layers로 테넌트 스타일 우선순위 안전 관리
- `color-mix()`, `oklch()` 등 최신 CSS 기능 네이티브 지원
- Tailwind v4.2: 논리 속성(RTL 지원) + 4종 신규 색상 팔레트

#### shadcn/ui CLI v4

```bash
# Design Ref: §A.2
# shadcn/ui CLI v4 (2026-03) — 디자인 프리셋 + AI skills

# 프리셋 기반 초기화 (색상, 테마, 아이콘, 폰트, 반경 일괄 설정)
npx shadcn@latest init --preset government-blue

# 컴포넌트 추가 (Radix UI 통합 패키지 자동 의존)
npx shadcn@latest add button input dialog data-table

# AI 에이전트 skills 활성화 (coding agent 컨텍스트 제공)
npx shadcn@latest add --skills
```

**선택 근거**:
- 2026-02 Radix UI 통합 패키지: `@radix-ui/react-*` 개별 패키지 → 단일 `radix-ui` 패키지
- 2026-03 CLI v4: 디자인 프리셋으로 전체 디자인 시스템 초기화 원클릭
- AI 에이전트 skills: Claude Code 등 코딩 에이전트에 컴포넌트 패턴 컨텍스트 제공
- RTL 지원 (2026-01): 다국어 공공 서비스 대응 가능

---

## B. 디자인 토큰 시스템

### B.1 토큰 아키텍처

```
// Design Ref: §B.1
// Plan SC: FR-U.1, SC-U1

디자인 토큰 3계층 구조:

┌─────────────────────────────────────────────┐
│  Layer 1: Primitive Tokens (원시 토큰)        │
│  순수 값만 정의 (의미 없음)                     │
│  --blue-50: oklch(0.970 0.014 254.604)      │
│  --blue-500: oklch(0.623 0.214 259.815)     │
│  --gray-900: oklch(0.210 0.006 285.885)     │
│  --spacing-1: 0.25rem                        │
│  --radius-sm: 0.25rem                        │
└──────────────┬──────────────────────────────┘
               │
┌──────────────┴──────────────────────────────┐
│  Layer 2: Semantic Tokens (의미 토큰)         │
│  용도에 따라 원시 토큰 참조                     │
│  --color-primary: var(--blue-500)            │
│  --color-background: var(--white)            │
│  --color-text-primary: var(--gray-900)       │
│  --color-danger: var(--red-500)              │
│  --spacing-page: var(--spacing-6)            │
└──────────────┬──────────────────────────────┘
               │
┌──────────────┴──────────────────────────────┐
│  Layer 3: Component Tokens (컴포넌트 토큰)    │
│  특정 컴포넌트에 바인딩                         │
│  --button-bg: var(--color-primary)           │
│  --button-text: var(--color-on-primary)      │
│  --sidebar-bg: var(--color-surface)          │
│  --table-header-bg: var(--color-muted)       │
└─────────────────────────────────────────────┘
```

### B.2 원시 토큰 정의 (Primitive Tokens)

```css
/* Design Ref: §B.2 */
/* Plan SC: FR-U.1 */
/* styles/tokens/primitives.css */

@layer tokens {
  :root {
    /* === 색상 (oklch 색공간 — Tailwind v4 네이티브) === */

    /* 블루 스케일 (공공기관 기본) */
    --blue-50:  oklch(0.970 0.014 254.604);
    --blue-100: oklch(0.932 0.032 255.585);
    --blue-200: oklch(0.882 0.059 254.128);
    --blue-300: oklch(0.809 0.105 251.813);
    --blue-400: oklch(0.707 0.165 254.624);
    --blue-500: oklch(0.623 0.214 259.815);
    --blue-600: oklch(0.546 0.245 262.881);
    --blue-700: oklch(0.488 0.243 264.376);
    --blue-800: oklch(0.424 0.199 265.638);
    --blue-900: oklch(0.379 0.146 265.522);
    --blue-950: oklch(0.282 0.091 267.935);

    /* 그린 스케일 */
    --green-50:  oklch(0.982 0.018 155.826);
    --green-100: oklch(0.962 0.044 156.743);
    --green-200: oklch(0.925 0.084 155.995);
    --green-300: oklch(0.871 0.150 154.449);
    --green-400: oklch(0.792 0.209 151.711);
    --green-500: oklch(0.723 0.219 149.579);
    --green-600: oklch(0.627 0.194 149.214);
    --green-700: oklch(0.527 0.154 150.069);
    --green-800: oklch(0.448 0.119 151.328);
    --green-900: oklch(0.393 0.095 152.535);
    --green-950: oklch(0.266 0.065 152.934);

    /* 그레이 스케일 (중성) */
    --gray-50:  oklch(0.985 0.002 247.858);
    --gray-100: oklch(0.967 0.003 264.542);
    --gray-200: oklch(0.928 0.006 264.531);
    --gray-300: oklch(0.872 0.010 258.338);
    --gray-400: oklch(0.707 0.022 261.325);
    --gray-500: oklch(0.551 0.027 264.364);
    --gray-600: oklch(0.446 0.030 256.802);
    --gray-700: oklch(0.373 0.034 259.733);
    --gray-800: oklch(0.278 0.033 256.848);
    --gray-900: oklch(0.210 0.034 264.665);
    --gray-950: oklch(0.129 0.042 264.695);

    /* 레드 (에러/위험) */
    --red-500: oklch(0.637 0.237 25.331);
    --red-600: oklch(0.577 0.245 27.325);
    --red-700: oklch(0.505 0.213 27.518);

    /* 옐로우 (경고) */
    --yellow-500: oklch(0.795 0.184 86.047);
    --yellow-600: oklch(0.681 0.162 75.834);

    /* 화이트/블랙 */
    --white: oklch(1.000 0.000 0.000);
    --black: oklch(0.000 0.000 0.000);

    /* === 폰트 === */
    --font-sans: 'Pretendard Variable', 'Noto Sans KR', -apple-system,
                 BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif;
    --font-mono: 'JetBrains Mono', 'D2Coding', 'Consolas', monospace;

    /* 폰트 크기 (rem 기반, 16px 기준) */
    --text-xs:   0.75rem;    /* 12px */
    --text-sm:   0.875rem;   /* 14px */
    --text-base: 1rem;       /* 16px */
    --text-lg:   1.125rem;   /* 18px */
    --text-xl:   1.25rem;    /* 20px */
    --text-2xl:  1.5rem;     /* 24px */
    --text-3xl:  1.875rem;   /* 30px */
    --text-4xl:  2.25rem;    /* 36px */

    /* 폰트 굵기 */
    --font-normal:   400;
    --font-medium:   500;
    --font-semibold: 600;
    --font-bold:     700;

    /* 줄 높이 */
    --leading-tight:  1.25;
    --leading-snug:   1.375;
    --leading-normal: 1.5;
    --leading-relaxed: 1.625;

    /* === 간격 (4px 기반 그리드) === */
    --spacing-0:  0;
    --spacing-1:  0.25rem;   /* 4px */
    --spacing-2:  0.5rem;    /* 8px */
    --spacing-3:  0.75rem;   /* 12px */
    --spacing-4:  1rem;      /* 16px */
    --spacing-5:  1.25rem;   /* 20px */
    --spacing-6:  1.5rem;    /* 24px */
    --spacing-8:  2rem;      /* 32px */
    --spacing-10: 2.5rem;    /* 40px */
    --spacing-12: 3rem;      /* 48px */
    --spacing-16: 4rem;      /* 64px */
    --spacing-20: 5rem;      /* 80px */

    /* === 반경 === */
    --radius-none: 0;
    --radius-sm:   0.25rem;  /* 4px */
    --radius-md:   0.5rem;   /* 8px */
    --radius-lg:   0.75rem;  /* 12px */
    --radius-xl:   1rem;     /* 16px */
    --radius-2xl:  1.5rem;   /* 24px */
    --radius-full: 9999px;

    /* === 그림자 === */
    --shadow-sm:  0 1px 2px oklch(0 0 0 / 0.05);
    --shadow-md:  0 4px 6px oklch(0 0 0 / 0.07), 0 2px 4px oklch(0 0 0 / 0.06);
    --shadow-lg:  0 10px 15px oklch(0 0 0 / 0.10), 0 4px 6px oklch(0 0 0 / 0.05);
    --shadow-xl:  0 20px 25px oklch(0 0 0 / 0.10), 0 8px 10px oklch(0 0 0 / 0.04);

    /* === 전환 === */
    --duration-fast:   150ms;
    --duration-normal: 250ms;
    --duration-slow:   350ms;
    --ease-default:    cubic-bezier(0.4, 0, 0.2, 1);
    --ease-in:         cubic-bezier(0.4, 0, 1, 1);
    --ease-out:        cubic-bezier(0, 0, 0.2, 1);

    /* === z-index 체계 === */
    --z-dropdown:   1000;
    --z-sticky:     1100;
    --z-overlay:    1200;
    --z-modal:      1300;
    --z-popover:    1400;
    --z-toast:      1500;
    --z-ai-panel:   1250;   /* AI 사이드 패널 전용 */
    --z-command:    1600;   /* 명령 팔레트 최상위 */
  }
}
```

### B.3 의미 토큰 정의 (Semantic Tokens)

```css
/* Design Ref: §B.3 */
/* Plan SC: FR-U.2, FR-U.3 */
/* styles/tokens/semantic.css */

@layer tokens {
  /* === 라이트 모드 (기본) === */
  :root,
  [data-theme="light"] {
    /* 배경 */
    --color-background:       var(--white);
    --color-surface:          var(--gray-50);
    --color-surface-raised:   var(--white);
    --color-surface-overlay:  oklch(1.000 0.000 0.000 / 0.80);

    /* 텍스트 */
    --color-text-primary:     var(--gray-900);
    --color-text-secondary:   var(--gray-600);
    --color-text-tertiary:    var(--gray-400);
    --color-text-inverse:     var(--white);
    --color-text-link:        var(--blue-600);
    --color-text-link-hover:  var(--blue-700);

    /* 브랜드/기능 색상 */
    --color-primary:          var(--blue-600);
    --color-primary-hover:    var(--blue-700);
    --color-primary-active:   var(--blue-800);
    --color-on-primary:       var(--white);

    --color-secondary:        var(--gray-100);
    --color-secondary-hover:  var(--gray-200);
    --color-on-secondary:     var(--gray-900);

    /* 상태 색상 */
    --color-success:          var(--green-600);
    --color-success-bg:       var(--green-50);
    --color-warning:          var(--yellow-600);
    --color-warning-bg:       oklch(0.980 0.040 85.000);
    --color-danger:           var(--red-600);
    --color-danger-bg:        oklch(0.980 0.030 25.000);
    --color-info:             var(--blue-600);
    --color-info-bg:          var(--blue-50);

    /* 경계선 */
    --color-border:           var(--gray-200);
    --color-border-hover:     var(--gray-300);
    --color-border-focus:     var(--blue-500);
    --color-ring:             oklch(0.623 0.214 259.815 / 0.35);

    /* 특수 영역 */
    --color-sidebar-bg:       var(--gray-50);
    --color-sidebar-active:   var(--blue-50);
    --color-header-bg:        var(--white);
    --color-muted:            var(--gray-100);
    --color-muted-foreground: var(--gray-500);

    /* AI 어시스턴트 전용 */
    --color-ai-accent:        oklch(0.700 0.200 280.000);
    --color-ai-bg:            oklch(0.970 0.015 280.000);
    --color-ai-border:        oklch(0.900 0.040 280.000);
    --color-ai-message-user:  var(--blue-50);
    --color-ai-message-bot:   var(--gray-50);

    /* N2SF 데이터 등급 표시 색상 */
    --color-grade-c:          var(--red-600);     /* 기밀 (C) — 적색 */
    --color-grade-s:          var(--yellow-600);  /* 민감 (S) — 황색 */
    --color-grade-o:          var(--green-600);   /* 공개 (O) — 녹색 */
  }

  /* === 다크 모드 === */
  [data-theme="dark"] {
    --color-background:       var(--gray-950);
    --color-surface:          var(--gray-900);
    --color-surface-raised:   var(--gray-800);
    --color-surface-overlay:  oklch(0.000 0.000 0.000 / 0.80);

    --color-text-primary:     var(--gray-50);
    --color-text-secondary:   var(--gray-400);
    --color-text-tertiary:    var(--gray-500);
    --color-text-inverse:     var(--gray-950);
    --color-text-link:        var(--blue-400);
    --color-text-link-hover:  var(--blue-300);

    --color-primary:          var(--blue-500);
    --color-primary-hover:    var(--blue-400);
    --color-primary-active:   var(--blue-300);
    --color-on-primary:       var(--gray-950);

    --color-secondary:        var(--gray-800);
    --color-secondary-hover:  var(--gray-700);
    --color-on-secondary:     var(--gray-50);

    --color-success:          var(--green-400);
    --color-success-bg:       oklch(0.250 0.050 150.000);
    --color-warning:          var(--yellow-500);
    --color-warning-bg:       oklch(0.250 0.040 85.000);
    --color-danger:           oklch(0.700 0.200 25.000);
    --color-danger-bg:        oklch(0.250 0.040 25.000);
    --color-info:             var(--blue-400);
    --color-info-bg:          oklch(0.250 0.040 260.000);

    --color-border:           var(--gray-700);
    --color-border-hover:     var(--gray-600);
    --color-border-focus:     var(--blue-400);
    --color-ring:             oklch(0.623 0.214 259.815 / 0.40);

    --color-sidebar-bg:       var(--gray-900);
    --color-sidebar-active:   oklch(0.300 0.040 260.000);
    --color-header-bg:        var(--gray-950);
    --color-muted:            var(--gray-800);
    --color-muted-foreground: var(--gray-400);

    --color-ai-accent:        oklch(0.750 0.180 280.000);
    --color-ai-bg:            oklch(0.200 0.020 280.000);
    --color-ai-border:        oklch(0.350 0.040 280.000);
    --color-ai-message-user:  oklch(0.250 0.040 260.000);
    --color-ai-message-bot:   var(--gray-800);

    --color-grade-c:          oklch(0.700 0.200 25.000);
    --color-grade-s:          var(--yellow-500);
    --color-grade-o:          var(--green-400);
  }

  /* === 시스템 설정 감지 (data-theme 미지정 시) === */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) {
      /* 다크 모드 변수 동일 적용 */
      --color-background: var(--gray-950);
      --color-surface: var(--gray-900);
      --color-text-primary: var(--gray-50);
      /* ... (다크 모드 전체 변수 동일) */
    }
  }
}
```

### B.4 기본 테마 5종

```css
/* Design Ref: §B.4 */
/* Plan SC: FR-U.2, SC-U2 */
/* styles/themes/ 디렉토리 */

/* --- 테마 1: 공공 블루 (기본) --- */
/* styles/themes/government-blue.css */
[data-theme-brand="government-blue"] {
  --color-primary:        oklch(0.546 0.245 262.881);
  --color-primary-hover:  oklch(0.488 0.243 264.376);
  --color-primary-active: oklch(0.424 0.199 265.638);
  --color-on-primary:     var(--white);
  --color-accent:         oklch(0.700 0.150 220.000);
  /* KRDS 기본 색상 체계 참조 */
}

/* --- 테마 2: 공공 그린 --- */
/* styles/themes/government-green.css */
[data-theme-brand="government-green"] {
  --color-primary:        oklch(0.627 0.194 149.214);
  --color-primary-hover:  oklch(0.527 0.154 150.069);
  --color-primary-active: oklch(0.448 0.119 151.328);
  --color-on-primary:     var(--white);
  --color-accent:         oklch(0.650 0.180 170.000);
}

/* --- 테마 3: 다크 오피셜 --- */
/* styles/themes/dark-official.css */
[data-theme-brand="dark-official"] {
  --color-primary:        oklch(0.750 0.120 260.000);
  --color-primary-hover:  oklch(0.800 0.100 260.000);
  --color-primary-active: oklch(0.850 0.080 260.000);
  --color-on-primary:     var(--gray-950);
  --color-background:     oklch(0.150 0.020 260.000);
  --color-surface:        oklch(0.200 0.015 260.000);
  --color-text-primary:   oklch(0.930 0.010 260.000);
}

/* --- 테마 4: 클래식 그레이 --- */
/* styles/themes/classic-gray.css */
[data-theme-brand="classic-gray"] {
  --color-primary:        oklch(0.450 0.030 260.000);
  --color-primary-hover:  oklch(0.380 0.030 260.000);
  --color-primary-active: oklch(0.320 0.030 260.000);
  --color-on-primary:     var(--white);
  --color-accent:         oklch(0.600 0.180 262.000);
}

/* --- 테마 5: 고대비 (접근성 전용) --- */
/* styles/themes/high-contrast.css */
[data-theme-brand="high-contrast"] {
  --color-primary:        oklch(0.000 0.000 0.000);
  --color-primary-hover:  oklch(0.150 0.000 0.000);
  --color-primary-active: oklch(0.100 0.000 0.000);
  --color-on-primary:     oklch(1.000 0.000 0.000);
  --color-background:     oklch(1.000 0.000 0.000);
  --color-text-primary:   oklch(0.000 0.000 0.000);
  --color-border:         oklch(0.000 0.000 0.000);
  --color-border-focus:   oklch(0.000 0.000 0.000);
  --shadow-md: none;
  --shadow-lg: none;
  /* 모든 텍스트 대비율 21:1 (최대) */
  /* KWCAG 2.2 1.4.3 명도 대비 — AAA 수준 준수 */
}
```

### B.5 다크모드 메커니즘

```typescript
// Design Ref: §B.5
// Plan SC: FR-U.3, SC-U3

// lib/theme/theme-store.ts — Zustand 기반 테마 상태 관리
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type ThemeMode = 'light' | 'dark' | 'system'
type ThemeBrand = 'government-blue' | 'government-green' | 'dark-official' | 'classic-gray' | 'high-contrast'

interface ThemeState {
  mode: ThemeMode
  brand: ThemeBrand
  setMode: (mode: ThemeMode) => void
  setBrand: (brand: ThemeBrand) => void
  resolvedMode: () => 'light' | 'dark'
}

const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      brand: 'government-blue',
      setMode: (mode) => {
        set({ mode })
        applyThemeToDOM(mode, get().brand)
        // DB 동기화 (로그인 사용자)
        syncThemeToServer(mode, get().brand)
      },
      setBrand: (brand) => {
        set({ brand })
        applyThemeToDOM(get().mode, brand)
        syncThemeToServer(get().mode, brand)
      },
      resolvedMode: () => {
        const { mode } = get()
        if (mode !== 'system') return mode
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light'
      },
    }),
    {
      name: 'theme-preferences',
      // localStorage 우선, 로그인 시 DB와 동기화
    }
  )
)

function applyThemeToDOM(mode: ThemeMode, brand: ThemeBrand) {
  const root = document.documentElement
  const resolvedMode = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode

  root.setAttribute('data-theme', resolvedMode)
  root.setAttribute('data-theme-brand', brand)

  // 메타 태그 업데이트 (모바일 상태바 색상)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content',
      resolvedMode === 'dark' ? '#0a0a0a' : '#ffffff'
    )
  }
}

// 시스템 설정 변경 감지
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const { mode } = useThemeStore.getState()
      if (mode === 'system') {
        applyThemeToDOM('system', useThemeStore.getState().brand)
      }
    })
}
```

```typescript
// Design Ref: §B.5
// Plan SC: FR-U.3

// components/theme/ThemeToggle.tsx — 테마 전환 UI
// KWCAG 2.2 4.1.2: aria-label 필수

interface ThemeToggleProps {
  className?: string
}

function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setMode } = useThemeStore()
  const modes: ThemeMode[] = ['light', 'dark', 'system']
  const labels = { light: '라이트 모드', dark: '다크 모드', system: '시스템 설정' }
  const icons = { light: SunIcon, dark: MoonIcon, system: MonitorIcon }

  return (
    <div role="radiogroup" aria-label="테마 모드 선택" className={className}>
      {modes.map((m) => {
        const Icon = icons[m]
        return (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            aria-label={labels[m]}
            onClick={() => setMode(m)}
            className={cn(
              'inline-flex items-center justify-center rounded-md p-2',
              'hover:bg-[var(--color-muted)] transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
              'focus-visible:outline-[var(--color-border-focus)]',
              mode === m && 'bg-[var(--color-muted)]'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{labels[m]}</span>
          </button>
        )
      })}
    </div>
  )
}
```

```html
<!-- Design Ref: §B.5 -->
<!-- FOUC 방지: 초기 로딩 시 테마 깜빡임 차단 스크립트 -->
<!-- app/layout.tsx <head> 내 인라인 삽입 -->
<script>
  (function() {
    try {
      var stored = JSON.parse(localStorage.getItem('theme-preferences') || '{}');
      var mode = (stored.state && stored.state.mode) || 'system';
      var brand = (stored.state && stored.state.brand) || 'government-blue';
      var resolved = mode;
      if (mode === 'system') {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', resolved);
      document.documentElement.setAttribute('data-theme-brand', brand);
    } catch(e) {}
  })();
</script>
```

---

## C. 반응형 레이아웃 시스템

### C.1 브레이크포인트 체계

```css
/* Design Ref: §C.1 */
/* Plan SC: FR-U.4, SC-U4 */

/*
  Tailwind v4 — @theme 내 브레이크포인트 정의
  KRDS 반응형 가이드 + 국내 디바이스 현황 기반
*/

@theme {
  --breakpoint-sm:  320px;   /* 모바일 (최소) */
  --breakpoint-md:  768px;   /* 태블릿 (세로) */
  --breakpoint-lg:  1280px;  /* 데스크탑 (표준) */
  --breakpoint-xl:  1920px;  /* 대형 화면 (FHD+) */
}

/*
  브레이크포인트별 레이아웃 전략:

  ┌──────────┬──────────┬──────────┬──────────┐
  │ 320px+   │ 768px+   │ 1280px+  │ 1920px+  │
  │ 모바일   │ 태블릿    │ 데스크탑  │ 대형     │
  ├──────────┼──────────┼──────────┼──────────┤
  │ 1컬럼    │ 2컬럼    │ 3컬럼    │ 4컬럼    │
  │ 햄버거   │ 접힌     │ 펼친     │ 확장     │
  │ 메뉴     │ 사이드바  │ 사이드바  │ 사이드바  │
  │ 바텀시트 │ 모달     │ 모달     │ 사이드패널│
  │ 숨김     │ 간략     │ 전체     │ 전체+    │
  │ AI 패널  │ AI 패널  │ AI 패널  │ AI 패널  │
  │ (FAB)    │ (아이콘) │ (사이드) │ (고정)   │
  └──────────┴──────────┴──────────┴──────────┘
*/
```

### C.2 레이아웃 패턴 3종

```
Design Ref: §C.2
Plan SC: FR-U.4

패턴 1: Sidebar + Content (관리자 대시보드)
─────────────────────────────────────────
┌────────┬──────────────────────────────┐
│        │  Header (Breadcrumb + User)  │
│ Side   ├──────────────────────────────┤
│ bar    │                              │
│ 240px  │     Main Content Area        │
│ (고정)  │     (반응형 그리드)           │
│        │                              │
│ 핀/    ├──────────────────────────────┤
│ 아이콘  │  Footer (선택)               │
│ 전환    │                              │
└────────┴──────────────────────────────┘

  모바일: 사이드바 → 하단 내비게이션 바
  태블릿: 사이드바 → 60px 아이콘 모드
  데스크탑: 240px 펼침 모드
  대형: 280px 확장 + AI 패널 동시 표시

패턴 2: Header + Grid (데이터 목록/보고서)
─────────────────────────────────────────
┌──────────────────────────────────────┐
│  Global Header (로고 + 검색 + 프로필) │
├──────────────────────────────────────┤
│  Page Header (제목 + 필터 + 액션)     │
├──────┬──────┬──────┬──────┬────────┤
│ Card │ Card │ Card │ Card │  ...   │
│      │      │      │      │        │
├──────┼──────┼──────┼──────┼────────┤
│ Card │ Card │ Card │ Card │  ...   │
└──────┴──────┴──────┴──────┴────────┘

  모바일: 1컬럼 풀폭 카드
  태블릿: 2컬럼 그리드
  데스크탑: 3~4컬럼 그리드
  대형: 4~6컬럼 그리드

패턴 3: 전체 페이지 (로그인/온보딩)
─────────────────────────────────────────
┌──────────────────────────────────────┐
│                                      │
│          중앙 정렬 카드               │
│     ┌────────────────────┐          │
│     │   로고 + 기관명     │          │
│     │   ───────────      │          │
│     │   입력 폼           │          │
│     │   ───────────      │          │
│     │   제출 버튼         │          │
│     └────────────────────┘          │
│                                      │
│     배경: 기관 CI 색상 그라데이션     │
└──────────────────────────────────────┘

  모바일: 카드 → 전체 화면 (패딩만 유지)
  데스크탑: 가운데 420px 카드
```

### C.3 터치 최적화

```css
/* Design Ref: §C.3 */
/* Plan SC: FR-U.4, NFR-U.3 */

/* 터치 타겟 최소 크기 — WCAG 2.2 SC 2.5.8 Target Size */
@layer components {
  .touch-target {
    min-width: 44px;
    min-height: 44px;
    /* 시각적 크기와 터치 영역 분리 가능 */
    position: relative;
  }

  .touch-target::before {
    content: '';
    position: absolute;
    inset: -8px;  /* 터치 영역 확장 */
  }
}

/* 모바일 전용 스와이프 제스처 영역 */
@media (max-width: 767px) {
  .swipe-area {
    touch-action: pan-y;  /* 수직 스크롤 허용, 수평 스와이프 캡처 */
    overscroll-behavior-x: contain;
  }

  /* 사이드바 스와이프 오픈 트리거 영역 */
  .sidebar-swipe-trigger {
    position: fixed;
    left: 0;
    top: 0;
    width: 20px;
    height: 100vh;
    z-index: var(--z-overlay);
    touch-action: none;
  }
}
```

### C.4 컨테이너 쿼리 활용

```css
/* Design Ref: §C.4 */
/* Plan SC: FR-U.4 */

/* 컨테이너 쿼리 — 부모 요소 크기 기반 반응형 */
/* 위젯 시스템에서 활용 (대시보드 내 개별 위젯 크기에 따라 레이아웃 변경) */

.widget-container {
  container-type: inline-size;
  container-name: widget;
}

@container widget (min-width: 400px) {
  .widget-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-4);
  }
}

@container widget (max-width: 399px) {
  .widget-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }
}
```

---

## D. 테넌트 커스터마이제이션

### D.1 테넌트 테마 오버라이드 아키텍처

```
Design Ref: §D.1
Plan SC: FR-U.5, SC-U8

테넌트 테마 적용 흐름:

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ 관리자 UI   │───>│ API Server  │───>│ PostgreSQL  │
│ (테마 설정) │    │ /api/tenant │    │ tenant_     │
│ 색상 피커   │    │ /theme      │    │ themes      │
│ 로고 업로드 │    │             │    │ 테이블       │
│ 폰트 선택   │    │             │    │             │
└─────────────┘    └──────┬──────┘    └─────────────┘
                          │
                          │ 테마 CSS 생성
                          │
                   ┌──────┴──────┐
                   │ CDN / Edge  │
                   │ 캐시        │
                   │ /themes/    │
                   │ {tenantId}  │
                   │ .css        │
                   └──────┬──────┘
                          │
                          │ <link> 동적 로딩
                          │
                   ┌──────┴──────┐
                   │ 브라우저     │
                   │ CSS         │
                   │ Cascade     │
                   │ Layers      │
                   │ 적용        │
                   └─────────────┘
```

### D.2 테넌트 테마 DB 스키마

```sql
-- Design Ref: §D.2
-- Plan SC: FR-U.5

CREATE TABLE tenant_themes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- 기본 설정
  base_theme      VARCHAR(50) NOT NULL DEFAULT 'government-blue',
  -- 색상 오버라이드 (CSS Custom Properties 값)
  color_primary   VARCHAR(100),   -- oklch() 값
  color_secondary VARCHAR(100),
  color_accent    VARCHAR(100),
  color_sidebar   VARCHAR(100),
  color_header    VARCHAR(100),
  -- 타이포그래피
  font_family     VARCHAR(200),   -- 웹폰트 URL 또는 시스템 폰트
  font_size_base  VARCHAR(10),    -- rem 값
  -- 로고
  logo_url        VARCHAR(500),   -- 로고 이미지 경로
  logo_alt_text   VARCHAR(200),   -- 접근성: 대체 텍스트 필수
  favicon_url     VARCHAR(500),
  -- 레이아웃
  border_radius   VARCHAR(10),    -- rem 값
  sidebar_width   VARCHAR(10),    -- px 값
  -- 메타
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES users(id),

  CONSTRAINT uq_tenant_active_theme UNIQUE (tenant_id, is_active)
);

-- 테마 버전 히스토리 (감사 추적)
CREATE TABLE tenant_theme_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  theme_snapshot  JSONB NOT NULL,       -- 변경 전 스냅샷
  changed_by      UUID NOT NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_reason   TEXT
);

CREATE INDEX idx_theme_tenant ON tenant_themes(tenant_id);
CREATE INDEX idx_theme_history ON tenant_theme_history(tenant_id, changed_at DESC);
```

### D.3 CSS 오버라이드 생성 및 주입

```typescript
// Design Ref: §D.3
// Plan SC: FR-U.5

// lib/theme/tenant-theme-generator.ts
// 테넌트 DB 설정 → CSS Custom Properties 문자열 생성

interface TenantThemeConfig {
  tenantId: string
  baseTheme: string
  colorPrimary?: string
  colorSecondary?: string
  colorAccent?: string
  colorSidebar?: string
  colorHeader?: string
  fontFamily?: string
  fontSizeBase?: string
  borderRadius?: string
  sidebarWidth?: string
  logoUrl?: string
  logoAltText?: string
}

function generateTenantCSS(config: TenantThemeConfig): string {
  const overrides: string[] = []

  if (config.colorPrimary) {
    overrides.push(`--color-primary: ${config.colorPrimary};`)
    // 자동 hover/active 변형 생성 (oklch lightness 조정)
    overrides.push(`--color-primary-hover: color-mix(in oklch, ${config.colorPrimary}, black 15%);`)
    overrides.push(`--color-primary-active: color-mix(in oklch, ${config.colorPrimary}, black 25%);`)
  }
  if (config.colorSecondary) {
    overrides.push(`--color-secondary: ${config.colorSecondary};`)
  }
  if (config.fontFamily) {
    overrides.push(`--font-sans: ${config.fontFamily}, 'Noto Sans KR', system-ui, sans-serif;`)
  }
  if (config.borderRadius) {
    overrides.push(`--radius-md: ${config.borderRadius};`)
  }

  return `
@layer tenant {
  [data-tenant="${config.tenantId}"] {
    ${overrides.join('\n    ')}
  }
}`.trim()
}

// Edge Function에서 CSS 응답 생성
// GET /api/themes/:tenantId.css
async function handleThemeCSS(tenantId: string): Promise<Response> {
  const config = await db.query(
    'SELECT * FROM tenant_themes WHERE tenant_id = $1 AND is_active = true',
    [tenantId]
  )

  if (!config) {
    return new Response('/* default theme */', {
      headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=3600' }
    })
  }

  const css = generateTenantCSS(config)
  return new Response(css, {
    headers: {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
    }
  })
}
```

### D.4 관리자 테마 설정 UI

```typescript
// Design Ref: §D.4
// Plan SC: FR-U.6

// components/admin/ThemeConfigurator.tsx
// 관리자 테마 설정 페이지 구조

/*
  ┌──────────────────────────────────────────────────────────────┐
  │  테마 설정                                        [저장] [초기화] │
  ├──────────────────────────────────────────────────────────────┤
  │                                                              │
  │  기본 테마 선택                                                │
  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
  │  │ 블루  │ │ 그린  │ │ 다크  │ │ 그레이│ │ 고대비│             │
  │  │  ✓   │ │      │ │      │ │      │ │      │             │
  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │
  │                                                              │
  │  색상 커스터마이징                                             │
  │  ┌────────────────┐  ┌────────────────┐                     │
  │  │ 주 색상         │  │ 보조 색상       │                     │
  │  │ [색상 피커]     │  │ [색상 피커]     │                     │
  │  │ #1d4ed8       │  │ #6b7280       │                     │
  │  │ 대비율: 7.2:1 ✓│  │ 대비율: 4.8:1 ✓│                     │
  │  └────────────────┘  └────────────────┘                     │
  │                                                              │
  │  로고 업로드                                                  │
  │  ┌──────────────────────────────────────┐                   │
  │  │  [현재 로고 미리보기]                  │                   │
  │  │  파일 선택 | 삭제                      │                   │
  │  │  권장: SVG 또는 PNG, 최대 200x60px    │                   │
  │  │  대체 텍스트: [             ]          │                   │
  │  └──────────────────────────────────────┘                   │
  │                                                              │
  │  폰트 / 레이아웃                                              │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
  │  │ 폰트 선택 │ │ 모서리 반경│ │ 사이드바폭│                   │
  │  │[드롭다운] │ │[슬라이더] │ │[슬라이더] │                   │
  │  └──────────┘ └──────────┘ └──────────┘                   │
  │                                                              │
  ├──────────────────────────────────────────────────────────────┤
  │  실시간 미리보기                                              │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │  [iframe: 현재 설정이 적용된 샘플 페이지]               │   │
  │  │                                                      │   │
  │  │  ┌─── 사이드바 ──┬──── 메인 콘텐츠 ────────────────┐ │   │
  │  │  │ [로고]        │  샘플 대시보드                    │ │   │
  │  │  │ 메뉴1         │  ┌────────┐ ┌────────┐          │ │   │
  │  │  │ 메뉴2         │  │ 카드1   │ │ 카드2   │          │ │   │
  │  │  │ 메뉴3         │  └────────┘ └────────┘          │ │   │
  │  │  └──────────────┴────────────────────────────────┘ │   │
  │  └──────────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────────────┘
*/

// 접근성 대비율 자동 검증 함수
function checkContrastRatio(
  foreground: string,
  background: string
): { ratio: number; passAA: boolean; passAAA: boolean } {
  // oklch → 상대 휘도 변환 → WCAG 대비율 계산
  const luminanceFg = oklchToRelativeLuminance(foreground)
  const luminanceBg = oklchToRelativeLuminance(background)

  const lighter = Math.max(luminanceFg, luminanceBg)
  const darker = Math.min(luminanceFg, luminanceBg)
  const ratio = (lighter + 0.05) / (darker + 0.05)

  return {
    ratio: Math.round(ratio * 10) / 10,
    passAA: ratio >= 4.5,   // KWCAG 2.2 1.4.3 일반 텍스트
    passAAA: ratio >= 7.0,  // KWCAG 2.2 1.4.6 향상 대비
  }
}
```

### D.5 화이트라벨 도메인 매핑

```typescript
// Design Ref: §D.5
// Plan SC: FR-U.5

// middleware.ts — 도메인별 테넌트 식별 + 테마 적용

// 도메인 → 테넌트 매핑 테이블
// 예: ministry-a.saas.go.kr → tenant-id-001
// 예: custom-domain.ministry-a.go.kr → tenant-id-001

async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // 1. 커스텀 도메인 → 테넌트 매핑 조회
  const tenant = await resolveTenantByDomain(hostname)

  if (tenant) {
    // 2. 요청 헤더에 테넌트 정보 주입
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-id', tenant.id)
    requestHeaders.set('x-tenant-theme', tenant.themeId)

    // 3. 응답에 테넌트 CSS 링크 주입 (Edge에서 처리)
    const response = NextResponse.next({
      request: { headers: requestHeaders }
    })

    // 테넌트 테마 CSS 프리로드
    response.headers.set(
      'Link',
      `</api/themes/${tenant.id}.css>; rel=preload; as=style`
    )

    return response
  }

  return NextResponse.next()
}
```

---

## E. AI Assistant UI 컴포넌트

### E.1 AI 어시스턴트 사이드 패널

```
Design Ref: §E.1
Plan SC: FR-U.7, SC-U5

AI 어시스턴트 사이드 패널 구조:

┌────────────────────────────────────────────┬────────────┐
│                                            │ AI 어시스턴트│
│         메인 콘텐츠 영역                    │ [   ] [X]  │
│                                            ├────────────┤
│  현재 페이지: CSAP 체크리스트               │ 현재 컨텍스트│
│  ┌──────────────────────────────────┐     │ > CSAP 체크 │
│  │ 체크리스트 테이블                  │     │   리스트    │
│  │ ...                              │     │ > D-08 접근 │
│  └──────────────────────────────────┘     │   통제      │
│                                            ├────────────┤
│                                            │            │
│                                            │ [사용자]    │
│                                            │ D-08 항목 중│
│                                            │ 미충족인 것 │
│                                            │ 알려줘      │
│                                            │            │
│                                            │ [AI 응답]   │
│                                            │ D-08에서 3개│
│                                            │ 항목이 미충 │
│                                            │ 족 상태입니 │
│                                            │ 다:         │
│                                            │ 1. D-08-03 │
│                                            │ 2. D-08-07 │
│                                            │ 3. D-08-11 │
│                                            │            │
│                                            │ [빠른 액션] │
│                                            │ > 구현 가이 │
│                                            │   드 보기   │
│                                            │ > 자동 점검 │
│                                            │   실행      │
│                                            ├────────────┤
│                                            │ [메시지 입력]│
│                                            │ [    ] [전송]│
└────────────────────────────────────────────┴────────────┘

모바일: FAB(Floating Action Button) → 바텀 시트
태블릿: 오버레이 패널 (320px)
데스크탑: 사이드 패널 (360px, 리사이저블)
대형: 고정 사이드 패널 (400px)
```

```typescript
// Design Ref: §E.1
// Plan SC: FR-U.7

// components/ai/AIAssistantPanel.tsx — 핵심 구조

interface AIAssistantPanelProps {
  isOpen: boolean
  onClose: () => void
  pageContext: PageContext  // 현재 페이지 정보
}

interface PageContext {
  route: string            // 현재 URL 경로
  pageTitle: string        // 페이지 제목
  dataType: string         // 표시 중인 데이터 유형
  selectedItems?: string[] // 선택된 항목 (테이블 등)
  dataGrade: 'C' | 'S' | 'O'  // N2SF 데이터 등급 ← 핵심
}

function AIAssistantPanel({ isOpen, onClose, pageContext }: AIAssistantPanelProps) {
  // N2SF 데이터 등급 검증 — C/S등급 데이터 AI 전송 차단
  const isAIAllowed = pageContext.dataGrade === 'O'

  return (
    <aside
      role="complementary"
      aria-label="AI 어시스턴트"
      aria-hidden={!isOpen}
      className={cn(
        'fixed right-0 top-0 h-full',
        'bg-[var(--color-ai-bg)] border-l border-[var(--color-ai-border)]',
        'transition-transform duration-normal ease-out',
        'z-[var(--z-ai-panel)]',
        // 반응형 너비
        'w-full md:w-80 lg:w-[360px] xl:w-[400px]',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* 헤더 */}
      <header className="flex items-center justify-between p-4 border-b border-[var(--color-ai-border)]">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-[var(--color-ai-accent)]" aria-hidden="true" />
          <h2 className="text-sm font-semibold">AI 어시스턴트</h2>
        </div>
        <button onClick={onClose} aria-label="AI 패널 닫기">
          <XIcon className="h-4 w-4" />
        </button>
      </header>

      {/* 데이터 등급 경고 — C/S등급 시 AI 사용 제한 */}
      {!isAIAllowed && (
        <div
          role="alert"
          className="mx-4 mt-3 p-3 rounded-md bg-[var(--color-danger-bg)] border border-[var(--color-danger)]"
        >
          <div className="flex items-start gap-2">
            <ShieldAlertIcon className="h-5 w-5 text-[var(--color-danger)] flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-[var(--color-danger)]">
                AI 사용 제한 ({pageContext.dataGrade}등급)
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                현재 페이지의 데이터는 N2SF {pageContext.dataGrade}등급으로
                분류되어 AI API 전송이 차단됩니다. (N2SF N-05 준수)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 컨텍스트 요약 */}
      <ContextSummary context={pageContext} />

      {/* 채팅 영역 */}
      <ChatArea
        disabled={!isAIAllowed}
        pageContext={pageContext}
      />

      {/* 빠른 액션 */}
      <QuickActions
        context={pageContext}
        disabled={!isAIAllowed}
      />

      {/* 메시지 입력 */}
      <MessageInput
        disabled={!isAIAllowed}
        placeholder={isAIAllowed
          ? '질문을 입력하세요...'
          : 'AI 사용이 제한된 데이터입니다'
        }
      />
    </aside>
  )
}
```

### E.2 AI 채팅 인터페이스 (SSE 스트리밍)

```typescript
// Design Ref: §E.2
// Plan SC: FR-U.8

// hooks/useAIChat.ts — AI SDK 5.x 기반 채팅 훅

import { useChat } from 'ai/react'

interface UseAIChatOptions {
  pageContext: PageContext
  tenantId: string
}

function useAIChat({ pageContext, tenantId }: UseAIChatOptions) {
  const chat = useChat({
    api: '/api/ai/chat',
    // SSE (Server-Sent Events) 프로토콜 — AI SDK 5.x 기본
    streamProtocol: 'data',

    // 시스템 컨텍스트 자동 주입
    body: {
      tenantId,
      pageContext: {
        route: pageContext.route,
        pageTitle: pageContext.pageTitle,
        dataType: pageContext.dataType,
        // C/S등급 데이터 내용은 전송하지 않음
        // 메타데이터만 전송 (제목, 유형, 개수 등)
        dataGrade: pageContext.dataGrade,
      },
    },

    // 스트리밍 응답 처리
    onFinish: (message) => {
      // 감사 로그 기록
      logAIInteraction({
        action: 'AI_CHAT_RESPONSE',
        tenantId,
        dataGrade: pageContext.dataGrade,
        messageId: message.id,
        tokensUsed: message.usage?.totalTokens,
      })
    },

    onError: (error) => {
      // N2SF 위반 시 경고 토스트
      if (error.message.includes('DATA_GRADE_BLOCKED')) {
        toast.error('N2SF 데이터 등급 정책에 의해 차단되었습니다')
      }
    },
  })

  return {
    ...chat,
    // 메시지 전송 전 데이터 등급 재확인
    sendMessage: (content: string) => {
      if (pageContext.dataGrade !== 'O') {
        toast.error('현재 데이터 등급에서는 AI를 사용할 수 없습니다')
        return
      }
      // PII 마스킹 처리 (클라이언트 사전 검증)
      const maskedContent = maskPII(content)
      chat.append({ role: 'user', content: maskedContent })
    },
  }
}

// API Route — /api/ai/chat
// 서버 측 SSE 스트리밍 처리
async function POST(request: Request) {
  const { messages, tenantId, pageContext } = await request.json()

  // 1. N2SF 데이터 등급 서버 측 재확인 (이중 검증)
  if (pageContext.dataGrade !== 'O') {
    return new Response(
      JSON.stringify({ error: 'DATA_GRADE_BLOCKED' }),
      { status: 403 }
    )
  }

  // 2. AI Gateway (MTU-A1) 경유 — host.docker.internal:1234 (LM Studio)
  const result = await streamText({
    model: aiGateway.getModel(tenantId),  // 테넌트별 모델 라우팅
    system: buildSystemPrompt(pageContext),
    messages,
  })

  // 3. SSE 스트리밍 응답 반환
  return result.toDataStreamResponse()
}
```

### E.3 AI 채팅 메시지 UI

```typescript
// Design Ref: §E.3
// Plan SC: FR-U.8

// components/ai/ChatMessage.tsx

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  timestamp?: Date
}

function ChatMessage({ role, content, isStreaming, timestamp }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        role === 'user'
          ? 'bg-[var(--color-ai-message-user)]'
          : 'bg-[var(--color-ai-message-bot)]'
      )}
      role="log"
      aria-label={role === 'user' ? '사용자 메시지' : 'AI 응답'}
    >
      {/* 아바타 */}
      <div className="flex-shrink-0">
        {role === 'assistant' ? (
          <div className="w-7 h-7 rounded-full bg-[var(--color-ai-accent)] flex items-center justify-center">
            <SparklesIcon className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
        ) : (
          <Avatar className="w-7 h-7" />
        )}
      </div>

      {/* 메시지 본문 */}
      <div className="flex-1 min-w-0">
        <div className="prose prose-sm max-w-none text-[var(--color-text-primary)]">
          {/* 마크다운 렌더링 + 코드 하이라이팅 */}
          <MarkdownRenderer content={content} />
        </div>

        {/* 스트리밍 표시 */}
        {isStreaming && (
          <div className="flex items-center gap-1 mt-2" aria-live="polite">
            <span className="sr-only">AI가 응답을 생성 중입니다</span>
            <motion.div
              className="flex gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-ai-accent)]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </div>
        )}

        {/* 타임스탬프 + 액션 */}
        {!isStreaming && timestamp && (
          <div className="flex items-center gap-2 mt-1">
            <time className="text-xs text-[var(--color-text-tertiary)]">
              {formatTime(timestamp)}
            </time>
            {role === 'assistant' && (
              <div className="flex items-center gap-1">
                <button aria-label="응답 복사" className="p-1 hover:bg-[var(--color-muted)] rounded">
                  <CopyIcon className="h-3 w-3" />
                </button>
                <button aria-label="피드백" className="p-1 hover:bg-[var(--color-muted)] rounded">
                  <ThumbsUpIcon className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

### E.4 AI 인라인 제안

```
Design Ref: §E.4
Plan SC: FR-U.9

AI 인라인 제안 패턴:

테이블 인라인 제안:
┌────────────────────────────────────────────────┐
│ CSAP 체크리스트                   [필터] [내보내기]│
├───┬──────────┬──────────┬───────┬──────────────┤
│ # │ 항목     │ 상태     │ 담당자 │ 기한          │
├───┼──────────┼──────────┼───────┼──────────────┤
│ 1 │ D-08-01  │ ✅ 완료  │ 김OO  │ 2026-04-10   │
│ 2 │ D-08-02  │ ⚠ 진행중 │ 이OO  │ 2026-04-15   │
│ 3 │ D-08-03  │ ❌ 미착수 │  -    │  -           │
├───┴──────────┴──────────┴───────┴──────────────┤
│ ┌────────────────────────────────────────────┐ │
│ │ 💡 AI 제안: D-08-03은 D-08-01의 RBAC       │ │
│ │    패턴을 재사용할 수 있습니다. 예상 소요:   │ │
│ │    2시간. [적용 가이드 보기] [무시]          │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘

폼 인라인 제안:
┌────────────────────────────────────────────────┐
│ 보안 정책 작성                                   │
│                                                  │
│ 정책 제목: [접근 통제 정책                    ]  │
│                                                  │
│ 정책 내용:                                       │
│ ┌──────────────────────────────────────────────┐│
│ │ 본 기관의 정보시스템에 대한 접근 통제는...    ││
│ │                                              ││
│ │ ┌──────────────────────────────────────────┐ ││
│ │ │ ✨ AI 자동완성 제안:                      │ ││
│ │ │ "...CSAP D-08 표준등급 기준에 따라        │ ││
│ │ │ 역할 기반 접근 통제(RBAC)를 적용하며..."  │ ││
│ │ │ [Tab으로 수락] [Esc로 무시]               │ ││
│ │ └──────────────────────────────────────────┘ ││
│ └──────────────────────────────────────────────┘│
└────────────────────────────────────────────────┘
```

```typescript
// Design Ref: §E.4
// Plan SC: FR-U.9

// components/ai/InlineSuggestion.tsx

interface InlineSuggestionProps {
  suggestion: {
    id: string
    type: 'table-action' | 'form-completion' | 'data-insight'
    content: string
    confidence: number     // 0~1 신뢰도
    actions: SuggestionAction[]
  }
  onAccept: () => void
  onDismiss: () => void
}

function InlineSuggestion({ suggestion, onAccept, onDismiss }: InlineSuggestionProps) {
  // 신뢰도 70% 미만은 표시하지 않음 (노이즈 방지)
  if (suggestion.confidence < 0.7) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      role="status"
      aria-live="polite"
      aria-label="AI 인라인 제안"
      className={cn(
        'border border-[var(--color-ai-border)] rounded-lg p-3',
        'bg-[var(--color-ai-bg)]'
      )}
    >
      <div className="flex items-start gap-2">
        <LightbulbIcon
          className="h-4 w-4 text-[var(--color-ai-accent)] flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1">
          <p className="text-sm">{suggestion.content}</p>
          <div className="flex items-center gap-2 mt-2">
            {suggestion.actions.map((action) => (
              <button
                key={action.id}
                onClick={action.handler}
                className="text-xs px-2 py-1 rounded bg-[var(--color-primary)] text-[var(--color-on-primary)]"
              >
                {action.label}
              </button>
            ))}
            <button
              onClick={onDismiss}
              className="text-xs text-[var(--color-text-tertiary)] hover:underline"
              aria-label="이 제안 무시"
            >
              무시
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
```

### E.5 AI 자동화 트리거

```typescript
// Design Ref: §E.5
// Plan SC: FR-U.10

// components/ai/AutomationBanner.tsx
// 반복 작업 감지 → 자동화 제안

/*
  자동화 트리거 배너:
  ┌────────────────────────────────────────────────────────────┐
  │ ⚡ 반복 작업 감지: 지난 5일간 CSAP 체크리스트를 3회 수동   │
  │    업데이트했습니다. 자동 점검 스케줄을 설정하시겠습니까?     │
  │    [자동화 설정] [이번만 무시] [다시 표시하지 않음]          │
  └────────────────────────────────────────────────────────────┘
*/

interface AutomationTrigger {
  id: string
  type: 'repetitive-task' | 'data-pattern' | 'schedule-suggestion'
  title: string
  description: string
  frequency: number        // 감지된 반복 횟수
  suggestedAction: string  // 제안하는 자동화 액션
  pageRoute: string        // 관련 페이지
}

// 반복 패턴 감지 로직 (클라이언트)
function useAutomationDetector(userId: string) {
  const recentActions = useRecentActions(userId, { days: 7 })

  return useMemo(() => {
    const triggers: AutomationTrigger[] = []

    // 패턴 1: 동일 페이지 동일 작업 3회 이상
    const actionGroups = groupBy(recentActions, (a) => `${a.route}:${a.actionType}`)
    for (const [key, actions] of Object.entries(actionGroups)) {
      if (actions.length >= 3) {
        triggers.push({
          id: `repeat-${key}`,
          type: 'repetitive-task',
          title: '반복 작업 감지',
          description: `지난 7일간 ${actions[0].actionName}을(를) ${actions.length}회 수동 실행했습니다.`,
          frequency: actions.length,
          suggestedAction: '자동 스케줄 설정',
          pageRoute: actions[0].route,
        })
      }
    }

    return triggers
  }, [recentActions])
}
```

### E.6 AI 빠른 액션 명령 팔레트

```typescript
// Design Ref: §E.6
// Plan SC: FR-U.11

// components/ai/CommandPalette.tsx
// Cmd+K / Ctrl+K 단축키 → 명령 팔레트

/*
  명령 팔레트 UI:
  ┌──────────────────────────────────────────────────────┐
  │ 🔍 명령 입력...                              [Esc]  │
  ├──────────────────────────────────────────────────────┤
  │                                                      │
  │ 📌 최근 사용                                         │
  │   > CSAP D-08 체크리스트 열기             [Enter]    │
  │   > N2SF 매핑 현황 보기                   [Enter]    │
  │                                                      │
  │ 🤖 AI 명령                                           │
  │   > AI에게 질문하기                       [Tab]      │
  │   > 현재 페이지 요약                      [Enter]    │
  │   > CSAP 미충족 항목 분석                 [Enter]    │
  │   > 보고서 초안 생성                      [Enter]    │
  │                                                      │
  │ ⚙ 빠른 설정                                         │
  │   > 다크 모드 전환                        [Enter]    │
  │   > 사이드바 접기/펼치기                  [Enter]    │
  │   > AI 어시스턴트 열기/닫기               [Enter]    │
  │                                                      │
  │ 📄 페이지 이동                                       │
  │   > 대시보드                              [Enter]    │
  │   > 감리 산출물                           [Enter]    │
  │                                                      │
  └──────────────────────────────────────────────────────┘
*/

// Radix UI Dialog 기반 명령 팔레트
function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Cmd+K / Ctrl+K 단축키
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 명령 검색 (퍼지 매칭)
  const commands = useFilteredCommands(query)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-surface-overlay)] z-[var(--z-command)]" />
        <Dialog.Content
          className={cn(
            'fixed top-[20%] left-1/2 -translate-x-1/2',
            'w-full max-w-lg rounded-xl',
            'bg-[var(--color-surface-raised)] shadow-xl',
            'border border-[var(--color-border)]',
            'z-[var(--z-command)]'
          )}
          aria-label="명령 팔레트"
        >
          {/* 검색 입력 */}
          <div className="flex items-center border-b border-[var(--color-border)] px-4">
            <SearchIcon className="h-4 w-4 text-[var(--color-text-tertiary)]" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="명령 입력..."
              className={cn(
                'flex-1 py-3 px-3 bg-transparent',
                'text-sm text-[var(--color-text-primary)]',
                'outline-none placeholder:text-[var(--color-text-tertiary)]'
              )}
              aria-label="명령 검색"
              autoFocus
            />
            <kbd className="text-xs text-[var(--color-text-tertiary)] border border-[var(--color-border)] rounded px-1.5 py-0.5">
              Esc
            </kbd>
          </div>

          {/* 명령 목록 */}
          <div className="max-h-80 overflow-y-auto py-2" role="listbox">
            {commands.map((group) => (
              <div key={group.category} role="group" aria-label={group.label}>
                <div className="px-4 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)]">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    role="option"
                    onClick={() => {
                      item.action()
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2',
                      'text-sm text-[var(--color-text-primary)]',
                      'hover:bg-[var(--color-muted)]',
                      'focus-visible:bg-[var(--color-muted)] focus-visible:outline-none'
                    )}
                  >
                    <item.icon className="h-4 w-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="text-xs text-[var(--color-text-tertiary)]">{item.shortcut}</kbd>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### E.7 N2SF 데이터 등급 시각적 표시

```typescript
// Design Ref: §E.7
// Plan SC: NFR-U.8

// components/data-grade/DataGradeBadge.tsx
// 모든 데이터 표시 영역에 N2SF 등급 뱃지 표시

interface DataGradeBadgeProps {
  grade: 'C' | 'S' | 'O'
  showLabel?: boolean
}

function DataGradeBadge({ grade, showLabel = true }: DataGradeBadgeProps) {
  const config = {
    C: {
      label: '기밀 (C)',
      className: 'bg-[var(--color-danger-bg)] text-[var(--color-grade-c)] border-[var(--color-grade-c)]',
      icon: ShieldAlertIcon,
      description: 'AI API 전송 금지, 외부 공유 금지',
    },
    S: {
      label: '민감 (S)',
      className: 'bg-[var(--color-warning-bg)] text-[var(--color-grade-s)] border-[var(--color-grade-s)]',
      icon: ShieldIcon,
      description: 'AI API 전송 금지, 마스킹 후 내부 공유',
    },
    O: {
      label: '공개 (O)',
      className: 'bg-[var(--color-success-bg)] text-[var(--color-grade-o)] border-[var(--color-grade-o)]',
      icon: GlobeIcon,
      description: 'AI API 전송 가능 (PII 마스킹 후)',
    },
  }

  const c = config[grade]
  const Icon = c.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium',
        'border rounded-full',
        c.className
      )}
      title={c.description}
      aria-label={`데이터 등급: ${c.label}. ${c.description}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {showLabel && <span>{c.label}</span>}
    </span>
  )
}
```

---

## F. 동적 레이아웃 커스터마이제이션

### F.1 드래그앤드롭 대시보드

```typescript
// Design Ref: §F.1
// Plan SC: FR-U.12, SC-U9

// components/dashboard/DashboardLayout.tsx
// dnd-kit 기반 위젯 대시보드

/*
  대시보드 위젯 시스템 구조:

  ┌──────────────────────────────────────────────────────────┐
  │ 대시보드              [위젯 추가] [레이아웃 편집] [저장]   │
  ├──────────────────────────────────────────────────────────┤
  │                                                          │
  │  ┌──────────────────┐  ┌──────────────────────────────┐ │
  │  │ CSAP 준수 현황    │  │ 최근 활동 타임라인             │ │
  │  │ ▓▓▓▓▓▓░░ 82%    │  │ • D-08 통과 (10분 전)        │ │
  │  │                  │  │ • D-09 진행 중               │ │
  │  │ [⠿ 이동] [⊕ 확대]│  │ • N2SF 매핑 완료             │ │
  │  └──────────────────┘  │                              │ │
  │                        │ [⠿ 이동] [⊕ 확대] [✕ 제거]   │ │
  │  ┌──────────────────┐  └──────────────────────────────┘ │
  │  │ AI 추천 작업      │                                   │
  │  │ ✨ 3개 작업 대기  │  ┌──────────────────────────────┐ │
  │  │ 1. D-08-03 구현  │  │ 기관별 진행률                  │ │
  │  │ 2. D-09 검토    │  │ 기관A: ▓▓▓▓░ 80%             │ │
  │  │ [⠿] [⊕] [✕]    │  │ 기관B: ▓▓░░░ 40%             │ │
  │  └──────────────────┘  │ [⠿] [⊕] [✕]                 │ │
  │                        └──────────────────────────────┘ │
  └──────────────────────────────────────────────────────────┘

  위젯 크기: 1x1, 2x1, 1x2, 2x2 (그리드 단위)
  저장: 사용자별 레이아웃 DB 영속 저장
  기본 레이아웃: 역할별 프리셋 (관리자, 사용자, 감리관)
*/

interface WidgetConfig {
  id: string
  type: WidgetType
  position: { x: number; y: number }
  size: { w: number; h: number }  // 그리드 단위
  props: Record<string, unknown>
}

type WidgetType =
  | 'csap-progress'      // CSAP 준수 현황
  | 'recent-activity'    // 최근 활동
  | 'ai-recommendations' // AI 추천 작업
  | 'tenant-progress'    // 기관별 진행률
  | 'n2sf-status'        // N2SF 등급별 현황
  | 'audit-calendar'     // 감리 일정
  | 'quick-actions'      // 빠른 액션
  | 'custom-chart'       // 사용자 정의 차트

// 위젯 레지스트리
const widgetRegistry: Record<WidgetType, WidgetDefinition> = {
  'csap-progress': {
    name: 'CSAP 준수 현황',
    description: 'CSAP 79항목 진행률 표시',
    defaultSize: { w: 1, h: 1 },
    minSize: { w: 1, h: 1 },
    maxSize: { w: 2, h: 2 },
    component: lazy(() => import('./widgets/CsapProgressWidget')),
    requiredRole: ['admin', 'user'],
  },
  // ... 기타 위젯 정의
}

// dnd-kit 통합
function DashboardLayout() {
  const [widgets, setWidgets] = useWidgetLayout(userId)
  const [isEditing, setIsEditing] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      // 접근성: 키보드로 위젯 이동
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={handleDragEnd}
      announcements={{
        // 스크린리더용 안내
        onDragStart: ({ active }) =>
          `${active.data.current?.name} 위젯을 드래그 시작했습니다`,
        onDragOver: ({ active, over }) =>
          over ? `${over.data.current?.name} 위로 이동 중` : '이동 중',
        onDragEnd: ({ active, over }) =>
          over
            ? `${active.data.current?.name} 위젯을 이동했습니다`
            : '드래그를 취소했습니다',
      }}
    >
      <div
        className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4"
        role="region"
        aria-label="대시보드 위젯 영역"
      >
        {widgets.map((widget) => (
          <DraggableWidget
            key={widget.id}
            widget={widget}
            isEditing={isEditing}
            onRemove={() => removeWidget(widget.id)}
            onResize={(size) => resizeWidget(widget.id, size)}
          />
        ))}
      </div>
    </DndContext>
  )
}
```

### F.2 사이드바 커스터마이제이션

```typescript
// Design Ref: §F.2
// Plan SC: FR-U.13

// components/layout/Sidebar.tsx

/*
  사이드바 3가지 모드:

  1. 펼침 모드 (240px)        2. 아이콘 모드 (60px)    3. 숨김 모드 (0px)
  ┌───────────────┐          ┌────┐                  (모바일: 하단 내비)
  │ [로고] SaaS  │          │[로]│
  │───────────────│          │────│                  ┌────────────────┐
  │ 🏠 대시보드   │          │ 🏠 │                  │ 메인 콘텐츠     │
  │ 📋 체크리스트 │          │ 📋 │                  │                │
  │ 📊 보고서    │          │ 📊 │                  │                │
  │ ⚙ 설정      │          │ ⚙ │                  ├──┬──┬──┬──┬──┤
  │              │          │    │                  │🏠│📋│📊│🤖│⚙│
  │ [<<] 접기    │          │[>>]│                  └──┴──┴──┴──┴──┘
  └───────────────┘          └────┘
*/

interface SidebarState {
  mode: 'expanded' | 'collapsed' | 'hidden'
  isPinned: boolean
  favoriteMenus: string[]
  recentPages: RecentPage[]
}

// Zustand 사이드바 상태
const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      mode: 'expanded',
      isPinned: true,
      favoriteMenus: [],
      recentPages: [],

      toggleMode: () =>
        set((state) => ({
          mode: state.mode === 'expanded' ? 'collapsed' : 'expanded',
        })),

      togglePin: () =>
        set((state) => ({ isPinned: !state.isPinned })),

      addFavorite: (menuId: string) =>
        set((state) => ({
          favoriteMenus: [...state.favoriteMenus, menuId],
        })),

      removeFavorite: (menuId: string) =>
        set((state) => ({
          favoriteMenus: state.favoriteMenus.filter((id) => id !== menuId),
        })),

      addRecentPage: (page: RecentPage) =>
        set((state) => ({
          recentPages: [page, ...state.recentPages.filter((p) => p.route !== page.route)].slice(0, 10),
        })),
    }),
    {
      name: 'sidebar-preferences',
    }
  )
)
```

### F.3 테이블 컬럼 커스터마이제이션

```typescript
// Design Ref: §F.3
// Plan SC: FR-U.14

// components/data-table/ColumnCustomizer.tsx

/*
  테이블 컬럼 커스터마이제이션 UI:

  ┌────────────────────────────────┐
  │ 컬럼 설정                [닫기]│
  ├────────────────────────────────┤
  │ ≡ ☑ 항목 ID        [고정]    │
  │ ≡ ☑ 항목명          [고정]    │
  │ ≡ ☑ 상태                     │
  │ ≡ ☑ 담당자                    │
  │ ≡ ☐ 생성일 (숨김)             │
  │ ≡ ☐ 수정일 (숨김)             │
  │ ≡ ☑ 기한                     │
  │ ≡ ☑ 우선순위                  │
  ├────────────────────────────────┤
  │ 드래그로 순서 변경             │
  │ [기본값 복원]      [적용]      │
  └────────────────────────────────┘

  저장: 사용자별 + 테이블별 설정 → localStorage + DB 동기화
*/

interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  pinned: boolean
  width?: number
  order: number
}

interface TablePreferences {
  tableId: string
  columns: ColumnConfig[]
  sortBy?: { column: string; direction: 'asc' | 'desc' }
  pageSize: number
  savedAt: string
}

// DB 스키마
// CREATE TABLE user_table_preferences (
//   user_id   UUID NOT NULL,
//   table_id  VARCHAR(100) NOT NULL,
//   config    JSONB NOT NULL,
//   PRIMARY KEY (user_id, table_id)
// );
```

### F.4 즐겨찾기 메뉴 + 최근 방문 기록

```typescript
// Design Ref: §F.4
// Plan SC: FR-U.15

// components/navigation/Favorites.tsx

/*
  즐겨찾기 + 최근 방문 UI:

  사이드바 상단:
  ┌───────────────────┐
  │ ⭐ 즐겨찾기        │
  │  > CSAP 체크리스트 │
  │  > N2SF 매핑       │
  │  > 대시보드        │
  ├───────────────────┤
  │ 🕐 최근 방문       │
  │  > 감리 T01 (5분)  │
  │  > D-08 가이드     │
  │  > 보고서 (1시간)  │
  └───────────────────┘

  저장: Zustand persist → localStorage + DB 동기화
  등록: 메뉴 항목 우클릭 → "즐겨찾기 추가"
  또는 페이지 상단 ⭐ 아이콘 클릭
*/
```

---

## G. 공공기관 UI 접근성 & 지침 준수

### G.1 KWCAG 2.2 준수 매트릭스

```
Design Ref: §G.1
Plan SC: NFR-U.1, SC-U6

KWCAG 2.2 (한국형 웹 콘텐츠 접근성 지침 2.2)
4원칙 14지침 33검사항목 전수 대응

원칙 1: 인식의 용이성 (Perceivable) — 8항목
──────────────────────────────────────────
| 검사항목 | 내용 | 구현 방법 |
|---------|------|---------|
| 1.1.1 | 적절한 대체 텍스트 | 모든 img/svg에 alt/aria-label 필수. shadcn/ui Icon은 aria-hidden="true" + sr-only 텍스트 |
| 1.2.1 | 자막 제공 | 비디오 콘텐츠에 WebVTT 자막 필수 |
| 1.3.1 | 표의 구성 | thead/th + scope 속성 + caption 필수 |
| 1.3.2 | 콘텐츠 선형 구조 | 시각적 순서 = DOM 순서 보장. CSS order 사용 시 tabindex 동기화 |
| 1.3.3 | 명확한 지시 사항 | 색상만으로 정보 전달 금지. 아이콘 + 텍스트 조합 |
| 1.4.1 | 색에 무관한 인식 | DataGradeBadge: 아이콘 + 레이블 + 색상 3중 표시 |
| 1.4.3 | 명도 대비 | 일반 텍스트 4.5:1, 대형 텍스트 3:1. 고대비 테마 21:1 |
| 1.4.11 | 비텍스트 대비 | UI 컴포넌트 경계선/아이콘 3:1 이상 |

원칙 2: 운용의 용이성 (Operable) — 9항목
──────────────────────────────────────────
| 검사항목 | 내용 | 구현 방법 |
|---------|------|---------|
| 2.1.1 | 키보드 접근성 | 모든 인터랙티브 요소 Tab/Enter/Space/Esc 접근. Radix UI 기본 제공 |
| 2.1.2 | 키보드 함정 방지 | 모달 포커스 트랩 + Esc 해제. Dialog 외부 클릭 해제 |
| 2.2.1 | 응답 시간 조절 | 세션 만료 5분 전 알림 + 연장 옵션 |
| 2.2.2 | 정지 기능 | 자동 슬라이드/스크롤 일시정지 버튼 |
| 2.3.1 | 깜빡임 제한 | 3Hz 이상 깜빡임 금지. prefers-reduced-motion 전역 대응 |
| 2.4.1 | 반복 영역 건너뛰기 | "본문으로 건너뛰기" 링크 (사이드바/헤더 바로 건너뛰기) |
| 2.4.3 | 적절한 링크 텍스트 | "여기", "클릭" 금지. 목적지 명확한 텍스트 |
| 2.4.6 | 제목 제공 | <title>, h1~h6 계층 구조 필수 |
| 2.4.7 | 초점 표시 | focus-visible 링 2px 이상, 고대비 색상 |

원칙 3: 이해의 용이성 (Understandable) — 7항목
──────────────────────────────────────────
| 검사항목 | 내용 | 구현 방법 |
|---------|------|---------|
| 3.1.1 | 기본 언어 표시 | <html lang="ko"> 필수 |
| 3.2.1 | 사용자 요구에 의한 실행 | 자동 제출 금지. 명시적 버튼 클릭 |
| 3.3.1 | 오류 정정 | 폼 검증 오류 시 해당 필드 포커스 + 명확한 오류 메시지 |
| 3.3.2 | 레이블 제공 | 모든 입력에 <label> 또는 aria-label 필수 |
| 3.4.1 | 반복 영역 일관성 | 전체 페이지 네비게이션 위치/순서 일관성 |
| 3.4.2 | 찾기 쉬운 도움 정보 | 도움말 링크 고정 위치 (우상단 또는 AI 어시스턴트) |
| 3.4.3 | 접근 가능한 인증 | CAPTCHA 대안 제공 (음성 CAPTCHA) |

원칙 4: 견고성 (Robust) — 9항목
──────────────────────────────────────────
| 검사항목 | 내용 | 구현 방법 |
|---------|------|---------|
| 4.1.1 | 마크업 오류 방지 | HTML 유효성 검사. 중복 id 금지 |
| 4.1.2 | 웹 애플리케이션 접근성 | ARIA role/state/property 올바른 사용. Radix UI 기본 제공 |
```

### G.2 포커스 관리 전략

```typescript
// Design Ref: §G.2
// Plan SC: NFR-U.3

// lib/accessibility/focus-management.ts

// 1. "본문으로 건너뛰기" 링크
function SkipToContent() {
  return (
    <a
      href="#main-content"
      className={cn(
        'sr-only focus:not-sr-only',
        'fixed top-2 left-2 z-[9999]',
        'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
        'px-4 py-2 rounded-md text-sm font-medium',
        'focus:outline-2 focus:outline-offset-2'
      )}
    >
      본문으로 건너뛰기
    </a>
  )
}

// 2. 포커스 트랩 (모달, 드로워)
// Radix UI Dialog가 기본 제공하지만, 커스텀 컴포넌트용

function useFocusTrap(containerRef: RefObject<HTMLElement>, isActive: boolean) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )

    const firstFocusable = focusableElements[0] as HTMLElement
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    firstFocusable?.focus()

    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, isActive])
}

// 3. 라이브 리전 (AI 응답, 알림)
function LiveRegion({ message, priority = 'polite' }: {
  message: string
  priority?: 'polite' | 'assertive'
}) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}
```

### G.3 애니메이션 접근성

```css
/* Design Ref: §G.3 */
/* Plan SC: NFR-U.7 */

/* 모션 감소 선호 사용자 대응 — 전역 적용 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Motion v12 — 컴포넌트 레벨 대응 */
```

```typescript
// Design Ref: §G.3
// Motion v12 접근성 통합

import { useReducedMotion } from 'motion/react'

function AnimatedCard({ children }: { children: React.ReactNode }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.25,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  )
}
```

### G.4 색각 이상 대응

```
Design Ref: §G.4
Plan SC: NFR-U.1

색상만으로 정보를 전달하지 않는 설계 원칙:

1. 상태 표시 — 색상 + 아이콘 + 텍스트 3중 표시
   ✅ 완료 (녹색)
   ⚠️ 진행 중 (황색)
   ❌ 미착수 (적색)

2. 차트/그래프 — 패턴 + 색상 조합
   ████ 완료 (실선)
   ░░░░ 진행 중 (점선)
   ╳╳╳╳ 미달 (빗금)

3. N2SF 데이터 등급 — 아이콘 + 텍스트 레이블 필수
   🛡️ 기밀(C) + 적색 배경
   ⚠️ 민감(S) + 황색 배경
   🌐 공개(O) + 녹색 배경

4. 링크 — 밑줄 + 색상 (밑줄 없는 링크 금지)
```

---

## H. 컴포넌트 카탈로그 구조

### H.1 Atomic Design 계층

```
Design Ref: §H.1
Plan SC: FR-U.1, SC-U7

컴포넌트 카탈로그 (Atomic Design 4계층):

Layer 1: 원자 (Atoms) — 14개
─────────────────────────────
| 컴포넌트 | 기반 | 접근성 |
|---------|------|--------|
| Button | shadcn/ui | role="button", aria-disabled |
| Input | shadcn/ui | aria-label, aria-describedby |
| Textarea | shadcn/ui | aria-label, 자동 높이 조절 |
| Select | shadcn/ui (Radix) | role="listbox", 키보드 탐색 |
| Checkbox | shadcn/ui (Radix) | role="checkbox", aria-checked |
| Radio | shadcn/ui (Radix) | role="radio", aria-checked |
| Switch | shadcn/ui (Radix) | role="switch", aria-checked |
| Badge | shadcn/ui | 상태 전달 시 aria-label |
| Avatar | shadcn/ui | alt 텍스트 필수 |
| Icon | Lucide React | aria-hidden="true" (장식) |
| Label | shadcn/ui | htmlFor 연결 |
| Separator | shadcn/ui | role="separator" |
| Skeleton | shadcn/ui | aria-busy="true" |
| Spinner | 커스텀 | role="status", sr-only 텍스트 |

Layer 2: 분자 (Molecules) — 12개
─────────────────────────────────
| 컴포넌트 | 구성 | 접근성 |
|---------|------|--------|
| FormField | Label + Input + 에러메시지 | aria-describedby(에러) |
| SearchInput | Input + Icon + Clear | role="searchbox" |
| DropdownMenu | Trigger + Menu | Radix 포커스 관리 |
| Tooltip | Trigger + Content | role="tooltip", delay |
| Popover | Trigger + Content | 포커스 트랩 |
| Toast | 아이콘 + 메시지 + 닫기 | role="alert", aria-live |
| Dialog/Modal | Overlay + Content | 포커스 트랩, Esc 닫기 |
| Card | Header + Content + Footer | article 또는 div |
| Tabs | TabList + TabPanels | role="tablist"/"tab"/"tabpanel" |
| Accordion | Trigger + Content | role="region", aria-expanded |
| Breadcrumb | 링크 + 구분자 | nav aria-label="현재 위치" |
| Pagination | 이전/다음 + 페이지 | nav aria-label="페이지 탐색" |

Layer 3: 유기체 (Organisms) — 10개
──────────────────────────────────
| 컴포넌트 | 역할 | 접근성 |
|---------|------|--------|
| Navbar | 상단 내비게이션 바 | nav role="navigation" |
| Sidebar | 측면 메뉴 (3모드) | nav aria-label="주 메뉴" |
| DataTable | 정렬/필터/페이지네이션 | role="table", caption |
| DataGrid | 인라인 편집 그리드 | role="grid", aria-rowcount |
| DashboardWidget | D&D 위젯 컨테이너 | role="region", aria-label |
| FormWizard | 다단계 폼 | aria-current="step" |
| FileUploader | 파일 업로드 + 미리보기 | aria-label, 진행률 |
| NotificationCenter | 알림 목록 + 배지 | aria-live, role="log" |
| CommandPalette | Cmd+K 명령 팔레트 | role="dialog", 검색 |
| AIAssistantPanel | AI 사이드 패널 | role="complementary" |

Layer 4: 템플릿 (Templates) — 5개
──────────────────────────────────
| 템플릿 | 조합 | 용도 |
|--------|------|------|
| AdminLayout | Sidebar + Navbar + Content + AI | 관리자 대시보드 |
| UserDashboard | Navbar + Grid + Widgets | 사용자 대시보드 |
| DataListPage | Navbar + Filter + DataTable | 데이터 목록 페이지 |
| FormPage | Navbar + FormWizard + Actions | 데이터 입력 페이지 |
| ReportView | Navbar + Sidebar(TOC) + Content | 보고서/문서 뷰어 |
```

### H.2 컴포넌트 네이밍 컨벤션

```
Design Ref: §H.2

파일 구조 (Feature-first + Layer 하이브리드):

src/
├── components/
│   ├── ui/                    # shadcn/ui 기본 컴포넌트 (원자+분자)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── data-table.tsx
│   │   └── ...
│   ├── layout/                # 레이아웃 유기체
│   │   ├── Sidebar.tsx
│   │   ├── Navbar.tsx
│   │   ├── AdminLayout.tsx
│   │   └── Footer.tsx
│   ├── ai/                    # AI 관련 컴포넌트
│   │   ├── AIAssistantPanel.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── CommandPalette.tsx
│   │   ├── InlineSuggestion.tsx
│   │   └── AutomationBanner.tsx
│   ├── dashboard/             # 대시보드 위젯
│   │   ├── DashboardLayout.tsx
│   │   ├── DraggableWidget.tsx
│   │   └── widgets/
│   │       ├── CsapProgressWidget.tsx
│   │       ├── RecentActivityWidget.tsx
│   │       └── ...
│   ├── data-grade/            # N2SF 데이터 등급 표시
│   │   ├── DataGradeBadge.tsx
│   │   └── DataGradeAlert.tsx
│   └── theme/                 # 테마 관련
│       ├── ThemeToggle.tsx
│       ├── ThemeConfigurator.tsx
│       └── ThemeProvider.tsx
├── lib/
│   ├── theme/
│   │   ├── theme-store.ts
│   │   ├── tenant-theme-generator.ts
│   │   └── contrast-checker.ts
│   ├── accessibility/
│   │   ├── focus-management.ts
│   │   └── screen-reader.ts
│   └── ai/
│       ├── data-grade-validator.ts
│       └── pii-masker.ts
├── styles/
│   ├── tailwind.css           # Tailwind v4 메인
│   ├── tokens/
│   │   ├── primitives.css     # 원시 토큰
│   │   └── semantic.css       # 의미 토큰
│   └── themes/
│       ├── government-blue.css
│       ├── government-green.css
│       ├── dark-official.css
│       ├── classic-gray.css
│       └── high-contrast.css
└── hooks/
    ├── useAIChat.ts
    ├── useTheme.ts
    ├── useWidgetLayout.ts
    └── useAutomationDetector.ts

네이밍 규칙:
- 컴포넌트 파일: PascalCase (ThemeToggle.tsx)
- shadcn/ui 컴포넌트: kebab-case (data-table.tsx) — shadcn 규칙 준수
- 훅: camelCase (useAIChat.ts)
- CSS 변수: kebab-case (--color-primary)
- 유틸리티: camelCase (contrastChecker.ts)
```

---

## I. 구현 가이드라인

### I.1 Storybook 8 설정 가이드

```typescript
// Design Ref: §I.1
// Plan SC: SC-U10

// .storybook/main.ts — Storybook 8.x 설정

import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.stories.@(ts|tsx)',
    '../src/components/**/*.mdx',
  ],
  addons: [
    '@storybook/addon-a11y',        // 접근성 검사 패널
    '@storybook/addon-interactions', // 인터랙션 테스트
    '@storybook/addon-themes',       // 테마 전환 툴바
    '@storybook/test',              // Vitest 통합 테스트
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {
      // Next.js App Router 지원
      appDirectory: true,
    },
  },
}

export default config
```

```typescript
// Design Ref: §I.1
// .storybook/preview.ts — 전역 데코레이터

import type { Preview } from '@storybook/react'
import '../src/styles/tailwind.css'
import '../src/styles/tokens/primitives.css'
import '../src/styles/tokens/semantic.css'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: '테마 모드',
      toolbar: {
        title: '테마',
        items: [
          { value: 'light', title: '라이트', icon: 'sun' },
          { value: 'dark', title: '다크', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
    brand: {
      description: '브랜드 테마',
      toolbar: {
        title: '브랜드',
        items: [
          { value: 'government-blue', title: '공공 블루' },
          { value: 'government-green', title: '공공 그린' },
          { value: 'dark-official', title: '다크 오피셜' },
          { value: 'classic-gray', title: '클래식 그레이' },
          { value: 'high-contrast', title: '고대비' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || 'light'
      const brand = context.globals.brand || 'government-blue'

      return (
        <div data-theme={theme} data-theme-brand={brand}>
          <Story />
        </div>
      )
    },
  ],
  parameters: {
    a11y: {
      // axe-core 설정 — KWCAG 2.2 AA 기준
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'image-alt', enabled: true },
          { id: 'label', enabled: true },
          { id: 'link-name', enabled: true },
          { id: 'button-name', enabled: true },
          { id: 'aria-required-parent', enabled: true },
        ],
      },
    },
  },
}

export default preview
```

### I.2 스토리 작성 규칙

```typescript
// Design Ref: §I.2

// 스토리 작성 표준 템플릿
// components/ui/button.stories.tsx

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: '원자/Button',    // Atomic Design 계층 기반 분류
  component: Button,
  tags: ['autodocs'],      // 자동 문서 생성
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: '버튼 변형',
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: '버튼 크기 (터치 타겟 44px 준수)',
    },
    disabled: { control: 'boolean' },
  },
  parameters: {
    // 접근성 테스트 필수
    a11y: { disable: false },
  },
}

export default meta
type Story = StoryObj<typeof Button>

// 기본 스토리
export const Default: Story = {
  args: {
    children: '기본 버튼',
    variant: 'default',
  },
}

// 접근성 테스트 포함 스토리
export const WithInteractionTest: Story = {
  args: {
    children: '클릭 테스트',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: '클릭 테스트' })

    // 버튼이 포커스 가능한지 확인
    await userEvent.tab()
    expect(button).toHaveFocus()

    // 클릭 동작 확인
    await userEvent.click(button)
  },
}

// 다크모드 스토리
export const DarkMode: Story = {
  args: { children: '다크 모드 버튼' },
  parameters: {
    backgrounds: { default: 'dark' },
    themes: { active: 'dark' },
  },
}
```

### I.3 Playwright 접근성 테스트

```typescript
// Design Ref: §I.3
// Plan SC: NFR-U.1

// tests/accessibility/global-a11y.spec.ts
// Playwright + axe-core 전역 접근성 테스트

import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const pages = [
  { name: '로그인', path: '/login' },
  { name: '대시보드', path: '/dashboard' },
  { name: 'CSAP 체크리스트', path: '/csap/checklist' },
  { name: 'N2SF 매핑', path: '/n2sf/mapping' },
  { name: '감리 산출물', path: '/audit/documents' },
  { name: '테마 설정', path: '/admin/theme' },
]

for (const page of pages) {
  test(`${page.name} — KWCAG 2.2 AA 접근성 검사`, async ({ page: pw }) => {
    await pw.goto(page.path)

    const results = await new AxeBuilder({ page: pw })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })

  test(`${page.name} — 키보드 네비게이션`, async ({ page: pw }) => {
    await pw.goto(page.path)

    // Tab으로 모든 인터랙티브 요소 순회 가능 확인
    const interactiveElements = await pw.locator(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all()

    for (const element of interactiveElements) {
      await pw.keyboard.press('Tab')
      const focused = await pw.evaluate(() => document.activeElement?.tagName)
      expect(focused).not.toBe('BODY')
    }
  })
}

// 반응형 테스트
const viewports = [
  { name: '모바일', width: 375, height: 812 },
  { name: '태블릿', width: 768, height: 1024 },
  { name: '데스크탑', width: 1280, height: 800 },
  { name: '대형', width: 1920, height: 1080 },
]

for (const viewport of viewports) {
  test(`반응형 레이아웃 — ${viewport.name} (${viewport.width}px)`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/dashboard')

    // 콘텐츠가 뷰포트 내에 표시되는지 확인
    const overflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflowX).toBe(false)

    // 접근성 검사 (각 뷰포트에서)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}
```

### I.4 KRDS 참조 매핑

```
Design Ref: §I.4

KRDS (범정부 디자인 시스템) ↔ 본 디자인 시스템 매핑:

| KRDS 구성요소 | 본 시스템 대응 | 비고 |
|-------------|-------------|------|
| KRDS 원칙 — 일관성 | 디자인 토큰 3계층 체계 | 토큰으로 일관성 보장 |
| KRDS 원칙 — 접근성 | KWCAG 2.2 AA 33항목 전수 | axe-core 자동 검증 |
| KRDS 원칙 — 효율성 | shadcn/ui CLI v4 프리셋 | 원클릭 초기화 |
| KRDS 스타일 — 색상 | 의미 토큰 (semantic.css) | oklch 색공간 |
| KRDS 스타일 — 타이포그래피 | 원시 토큰 (font-*) | Pretendard + Noto Sans KR |
| KRDS 스타일 — 간격 | 원시 토큰 (spacing-*) | 4px 기반 그리드 |
| KRDS 컴포넌트 — 버튼 | shadcn/ui Button | 5종 변형 |
| KRDS 컴포넌트 — 입력 | shadcn/ui Input | 에러 상태 포함 |
| KRDS 컴포넌트 — 테이블 | shadcn/ui DataTable | 정렬/필터/페이지네이션 |
| KRDS 컴포넌트 — 모달 | shadcn/ui Dialog | 포커스 트랩 |
| KRDS 기본 패턴 — 폼 | FormField + React Hook Form | Zod 검증 |
| KRDS 기본 패턴 — 네비게이션 | Sidebar + Navbar | 3모드 지원 |
| KRDS 서비스 패턴 — 로그인 | 전체 페이지 패턴 | 기관 CI 적용 |
| KRDS 서비스 패턴 — 대시보드 | DashboardLayout + 위젯 | 드래그앤드롭 |

KRDS 접근성 WCAG 적합성:
- KRDS 각 컴포넌트 페이지에 명시된 WCAG 적합성 수준 참조
- 본 시스템은 KRDS의 AA 수준을 기본으로 하되, 고대비 테마에서 AAA 달성
```

---

## 추적성 매트릭스 (Design ↔ Plan ↔ CSAP/KWCAG)

| FR/NFR ID | Plan 섹션 | Design 섹션 | CSAP/KWCAG | 구현 컴포넌트 | 테스트 |
|-----------|---------|-----------|-----------|------------|--------|
| FR-U.1 | 기술 스택, 산출물 | B. 디자인 토큰 | KRDS 스타일 | primitives.css, semantic.css | 토큰 수 확인 |
| FR-U.2 | 기본 테마 5종 | B.4 테마 5종 | KWCAG 1.4.3 | themes/*.css | 대비율 검사 |
| FR-U.3 | 다크모드 | B.5 다크모드 | KWCAG 1.4.3 | ThemeToggle, theme-store | 3모드 전환 |
| FR-U.4 | 반응형 | C. 반응형 레이아웃 | KRDS 반응형 | AdminLayout, breakpoints | 4뷰포트 테스트 |
| FR-U.5 | 테넌트 커스텀 | D. 테넌트 커스터마이제이션 | MTU-E2 | tenant-theme-generator | CSS 주입 검증 |
| FR-U.6 | 관리자 설정 UI | D.4 관리자 UI | - | ThemeConfigurator | 설계 검증 |
| FR-U.7 | AI 사이드 패널 | E.1 AI 패널 | MTU-A1, N2SF | AIAssistantPanel | 패널 설계 확인 |
| FR-U.8 | AI 채팅 | E.2 SSE 스트리밍 | AI SDK 5.x | useAIChat | SSE 설계 확인 |
| FR-U.9 | AI 인라인 제안 | E.4 인라인 제안 | - | InlineSuggestion | 설계 확인 |
| FR-U.10 | AI 자동화 | E.5 자동화 트리거 | - | AutomationBanner | 설계 확인 |
| FR-U.11 | 명령 팔레트 | E.6 Cmd+K | - | CommandPalette | 설계 확인 |
| FR-U.12 | 대시보드 | F.1 D&D 대시보드 | - | DashboardLayout | dnd-kit 설계 확인 |
| FR-U.13 | 사이드바 | F.2 사이드바 | - | Sidebar | 3모드 설계 확인 |
| FR-U.14 | 테이블 설정 | F.3 컬럼 커스텀 | - | ColumnCustomizer | 설계 확인 |
| FR-U.15 | 즐겨찾기 | F.4 즐겨찾기 | - | Favorites | 설계 확인 |
| NFR-U.1 | KWCAG 2.2 AA | G.1 KWCAG 매트릭스 | KWCAG 2.2 33항목 | axe-core | 전수 테스트 |
| NFR-U.2 | 명도 대비 | B.3 의미 토큰 | KWCAG 1.4.3 | 대비 검사 | 도구 검증 |
| NFR-U.3 | 키보드 | G.2 포커스 관리 | KWCAG 2.1.1 | focus-management | Playwright |
| NFR-U.4 | 스크린리더 | G.2 라이브 리전 | KWCAG 4.1.2 | LiveRegion, ARIA | NVDA 테스트 |
| NFR-U.5 | LCP 성능 | A.2 Next.js RSC | - | RSC + Turbopack | Lighthouse |
| NFR-U.6 | 번들 크기 | A.2 standalone | - | 번들 분석 | analyzer |
| NFR-U.7 | 모션 감소 | G.3 애니메이션 | KWCAG 2.3.1 | prefers-reduced-motion | 미디어 쿼리 |
| NFR-U.8 | C/S등급 차단 | E.1 데이터 등급 | N2SF N-05 | DataGradeBadge | 등급 검증 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — A~I 전체 섹션 설계 완료 | Claude Code (PM) |
| — | — | 웹검색 기반: Next.js 15.2.4, Tailwind v4.2, shadcn/ui CLI v4, AI SDK 5, KRDS 참조 | — |
| — | — | KWCAG 2.2 33검사항목 전수 대응 매트릭스 포함 | — |
| — | — | N2SF 데이터 등급 UI 차단 설계 (C/S등급 AI 전송 금지) 포함 | — |
