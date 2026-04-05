# MTU-U1 구현 가이드: Session 1+2 — 디자인 토큰 + 반응형 레이아웃

| 항목 | 내용 |
|------|------|
| 문서 유형 | 구현 가이드 (Implementation Guide) |
| 연계 설계 | MTU-U1-ui-design-system.design.md 섹션 A, B, C, H |
| 기술 스택 | Next.js 15.2.4, Tailwind CSS v4, shadcn/ui CLI v4 |
| 작성일 | 2026-04-05 |
| 버전 | 1.0.0 |
| 상태 | 승인 완료 |

---

## Executive Summary

| 관점 | 구현 내용 | 기준 |
|------|---------|------|
| **Session 1** | 디자인 토큰 시스템 + 5종 테마 + 다크모드 | §B.1–B.5 |
| **Session 2** | 반응형 레이아웃 3종 + 컴포넌트 카탈로그 선택 구현 | §C.1–C.4, §H.1–H.2 |
| **접근성** | KWCAG 2.2 AA — ARIA 속성 전수 적용 | 장애인차별금지법 |
| **보안** | 하드코딩 시크릿 없음, 환경변수 전용 | CSAP D-12 |

---

## 1. 프로젝트 초기 설정

### 1.1 package.json 의존성

```json
{
  "name": "public-saas-ui",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "test": "vitest",
    "test:a11y": "playwright test --project=a11y"
  },
  "dependencies": {
    "next": "^15.2.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.12",
    "@tanstack/react-query": "^5.66.0",
    "@tanstack/react-table": "^8.21.0",
    "react-hook-form": "^7.54.2",
    "zod": "^3.24.2",
    "@hookform/resolvers": "^3.10.0",
    "next-themes": "^0.4.4",
    "lucide-react": "^0.475.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "radix-ui": "^1.1.3",
    "@radix-ui/react-slot": "^1.1.2",
    "motion": "^12.5.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^8.0.0",
    "dompurify": "^3.2.4",
    "@types/dompurify": "^3.0.5"
  },
  "devDependencies": {
    "typescript": "^5.8.2",
    "@types/node": "^22.13.10",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "tailwindcss": "^4.0.12",
    "@tailwindcss/vite": "^4.0.12",
    "@storybook/nextjs": "^8.6.3",
    "@storybook/react": "^8.6.3",
    "@storybook/addon-a11y": "^8.6.3",
    "@storybook/addon-interactions": "^8.6.3",
    "@storybook/addon-themes": "^8.6.3",
    "@storybook/test": "^8.6.3",
    "vitest": "^3.0.7",
    "@vitejs/plugin-react": "^4.3.4",
    "playwright": "^1.50.1",
    "axe-core": "^4.10.3",
    "@axe-core/playwright": "^4.10.1",
    "eslint": "^9.21.0",
    "eslint-config-next": "^15.2.4",
    "ts-prune": "^0.10.3"
  }
}
```

### 1.2 Next.js 15 설정

```typescript
// next.config.ts
// Design Ref: §A.2
// Plan SC: FR-U.1

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // React 19 컴파일러 최적화 (불필요한 리렌더링 자동 제거)
    reactCompiler: true,
    // Turbopack — v15.2에서 기본 활성화
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  // k3s 컨테이너 폐쇄망 배포 최적화 (MTU-I1 연계)
  output: 'standalone',
  // 이미지 최적화 — 폐쇄망 내부 도메인만 허용
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        // 실제 운영 도메인은 환경변수로 관리 (CSAP D-12)
        hostname: process.env.ALLOWED_IMAGE_DOMAIN ?? 'localhost',
      },
    ],
  },
  // 보안 헤더 (CSAP D-08, D-09)
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",   // 인라인 스크립트(FOUC 방지)만 허용
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self'",
            "connect-src 'self'",
          ].join('; '),
        },
      ],
    },
  ],
}

export default nextConfig
```

### 1.3 TypeScript 설정

```json
// tsconfig.json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 2. 디자인 토큰 시스템

### 2.1 Tailwind v4 메인 CSS (globals.css)

```css
/* src/styles/globals.css */
/* Design Ref: §A.2, §B.1 */
/* Plan SC: FR-U.1 */

/* Tailwind CSS v4 — CSS-first 설정 (tailwind.config.js 불필요) */
@import "tailwindcss";

/* CSS Cascade Layers — 테넌트 스타일 격리 우선순위 보장 */
@layer base, tokens, tenant, components, utilities;

/* 원시 토큰 + 의미 토큰 파일 임포트 */
@import "./tokens/primitives.css" layer(tokens);
@import "./tokens/semantic.css" layer(tokens);

/* 기본 테마 파일 임포트 */
@import "./themes/government-blue.css";
@import "./themes/government-green.css";
@import "./themes/dark-official.css";
@import "./themes/classic-gray.css";
@import "./themes/high-contrast.css";

/*
  @theme 디렉티브 — Tailwind 유틸리티 클래스에 토큰 연결
  CSS Custom Properties를 Tailwind 클래스로 사용 가능하게 등록
*/
@theme inline {
  /* 색상 — 의미 토큰 참조 */
  --color-background:       var(--color-background);
  --color-foreground:       var(--color-text-primary);
  --color-primary:          var(--color-primary);
  --color-primary-hover:    var(--color-primary-hover);
  --color-on-primary:       var(--color-on-primary);
  --color-secondary:        var(--color-secondary);
  --color-muted:            var(--color-muted);
  --color-muted-foreground: var(--color-muted-foreground);
  --color-border:           var(--color-border);
  --color-ring:             var(--color-ring);
  --color-success:          var(--color-success);
  --color-warning:          var(--color-warning);
  --color-danger:           var(--color-danger);

  /* N2SF 데이터 등급 색상 */
  --color-grade-c: var(--color-grade-c);
  --color-grade-s: var(--color-grade-s);
  --color-grade-o: var(--color-grade-o);

  /* 폰트 */
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);

  /* 폰트 크기 */
  --text-xs:   var(--text-xs);
  --text-sm:   var(--text-sm);
  --text-base: var(--text-base);
  --text-lg:   var(--text-lg);
  --text-xl:   var(--text-xl);
  --text-2xl:  var(--text-2xl);
  --text-3xl:  var(--text-3xl);
  --text-4xl:  var(--text-4xl);

  /* 간격 */
  --spacing-1:  var(--spacing-1);
  --spacing-2:  var(--spacing-2);
  --spacing-3:  var(--spacing-3);
  --spacing-4:  var(--spacing-4);
  --spacing-5:  var(--spacing-5);
  --spacing-6:  var(--spacing-6);
  --spacing-8:  var(--spacing-8);
  --spacing-10: var(--spacing-10);
  --spacing-12: var(--spacing-12);
  --spacing-16: var(--spacing-16);

  /* 반경 */
  --radius-sm:   var(--radius-sm);
  --radius-md:   var(--radius-md);
  --radius-lg:   var(--radius-lg);
  --radius-xl:   var(--radius-xl);
  --radius-full: var(--radius-full);

  /* 브레이크포인트 (§C.1 KRDS 기반) */
  --breakpoint-sm:  320px;
  --breakpoint-md:  768px;
  --breakpoint-lg:  1280px;
  --breakpoint-xl:  1920px;
}

/* 기본 베이스 스타일 */
@layer base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    border-color: var(--color-border);
  }

  html {
    /* 폰트 스무딩 (macOS/iOS 최적화) */
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    /* 텍스트 크기 자동 조정 방지 (모바일) */
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  body {
    background-color: var(--color-background);
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--leading-normal);
  }

  /* 포커스 링 — KWCAG 2.2 2.4.11 포커스 시각적 표시 */
  :focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  /* 스크롤바 스타일 (Webkit) */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: var(--color-surface);
  }
  ::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: var(--radius-full);
  }
}
```

### 2.2 원시 토큰 (Primitive Tokens)

```css
/* src/styles/tokens/primitives.css */
/* Design Ref: §B.2 */
/* Plan SC: FR-U.1 */
/* 순수 값만 정의 — 의미 없음, 시맨틱 토큰에서 참조 */

:root {
  /* ================================================================
     색상 팔레트 (oklch 색공간 — P3 범주, Tailwind v4 네이티브 지원)
     oklch(밝기 채도 색조) — 지각적으로 균일한 색공간
  ================================================================ */

  /* 블루 스케일 (공공기관 기본 색상) */
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

  /* 그레이 스케일 (중성, 레이아웃 전반) */
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

  /* 레드 (에러 / 위험 상태) */
  --red-500: oklch(0.637 0.237 25.331);
  --red-600: oklch(0.577 0.245 27.325);
  --red-700: oklch(0.505 0.213 27.518);

  /* 옐로우 (경고 상태) */
  --yellow-500: oklch(0.795 0.184 86.047);
  --yellow-600: oklch(0.681 0.162 75.834);

  /* 화이트 / 블랙 */
  --white: oklch(1.000 0.000 0.000);
  --black: oklch(0.000 0.000 0.000);

  /* ================================================================
     타이포그래피
  ================================================================ */

  /* 폰트 패밀리 — 한국어 최적화 */
  --font-sans: 'Pretendard Variable', 'Noto Sans KR', -apple-system,
               BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'D2Coding', 'Consolas', monospace;

  /* 폰트 크기 (rem, 16px 기준) */
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
  --leading-tight:   1.25;
  --leading-snug:    1.375;
  --leading-normal:  1.5;
  --leading-relaxed: 1.625;

  /* ================================================================
     간격 (4px 그리드 기반)
  ================================================================ */
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

  /* ================================================================
     반경
  ================================================================ */
  --radius-none: 0;
  --radius-sm:   0.25rem;  /* 4px */
  --radius-md:   0.5rem;   /* 8px */
  --radius-lg:   0.75rem;  /* 12px */
  --radius-xl:   1rem;     /* 16px */
  --radius-2xl:  1.5rem;   /* 24px */
  --radius-full: 9999px;

  /* ================================================================
     그림자 (oklch 색공간 기반)
  ================================================================ */
  --shadow-sm:  0 1px 2px oklch(0 0 0 / 0.05);
  --shadow-md:  0 4px 6px oklch(0 0 0 / 0.07), 0 2px 4px oklch(0 0 0 / 0.06);
  --shadow-lg:  0 10px 15px oklch(0 0 0 / 0.10), 0 4px 6px oklch(0 0 0 / 0.05);
  --shadow-xl:  0 20px 25px oklch(0 0 0 / 0.10), 0 8px 10px oklch(0 0 0 / 0.04);

  /* ================================================================
     전환 애니메이션
  ================================================================ */
  --duration-fast:   150ms;
  --duration-normal: 250ms;
  --duration-slow:   350ms;
  --ease-default:    cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in:         cubic-bezier(0.4, 0, 1, 1);
  --ease-out:        cubic-bezier(0, 0, 0.2, 1);

  /* ================================================================
     z-index 체계 (레이어 우선순위 표준)
  ================================================================ */
  --z-dropdown:  1000;
  --z-sticky:    1100;
  --z-overlay:   1200;
  --z-modal:     1300;
  --z-popover:   1400;
  --z-toast:     1500;
  --z-ai-panel:  1250;   /* AI 사이드 패널 전용 */
  --z-command:   1600;   /* 명령 팔레트 최상위 */
}
```

### 2.3 의미 토큰 (Semantic Tokens)

```css
/* src/styles/tokens/semantic.css */
/* Design Ref: §B.3 */
/* Plan SC: FR-U.2, FR-U.3 */
/* 원시 토큰을 의미(용도)에 따라 매핑 */

/* ================================================================
   라이트 모드 (기본값)
================================================================ */
:root,
[data-theme="light"] {
  /* 배경 계층 */
  --color-background:      var(--white);
  --color-surface:         var(--gray-50);
  --color-surface-raised:  var(--white);
  --color-surface-overlay: oklch(1.000 0.000 0.000 / 0.80);

  /* 텍스트 */
  --color-text-primary:    var(--gray-900);
  --color-text-secondary:  var(--gray-600);
  --color-text-tertiary:   var(--gray-400);
  --color-text-inverse:    var(--white);
  --color-text-link:       var(--blue-600);
  --color-text-link-hover: var(--blue-700);

  /* 브랜드 색상 */
  --color-primary:         var(--blue-600);
  --color-primary-hover:   var(--blue-700);
  --color-primary-active:  var(--blue-800);
  --color-on-primary:      var(--white);

  --color-secondary:       var(--gray-100);
  --color-secondary-hover: var(--gray-200);
  --color-on-secondary:    var(--gray-900);

  /* 상태 색상 */
  --color-success:         var(--green-600);
  --color-success-bg:      var(--green-50);
  --color-warning:         var(--yellow-600);
  --color-warning-bg:      oklch(0.980 0.040 85.000);
  --color-danger:          var(--red-600);
  --color-danger-bg:       oklch(0.980 0.030 25.000);
  --color-info:            var(--blue-600);
  --color-info-bg:         var(--blue-50);

  /* 경계선 */
  --color-border:          var(--gray-200);
  --color-border-hover:    var(--gray-300);
  --color-border-focus:    var(--blue-500);
  --color-ring:            oklch(0.623 0.214 259.815 / 0.35);

  /* 레이아웃 영역 */
  --color-sidebar-bg:      var(--gray-50);
  --color-sidebar-active:  var(--blue-50);
  --color-header-bg:       var(--white);
  --color-muted:           var(--gray-100);
  --color-muted-foreground: var(--gray-500);

  /* AI 어시스턴트 패널 전용 */
  --color-ai-accent:       oklch(0.700 0.200 280.000);
  --color-ai-bg:           oklch(0.970 0.015 280.000);
  --color-ai-border:       oklch(0.900 0.040 280.000);
  --color-ai-message-user: var(--blue-50);
  --color-ai-message-bot:  var(--gray-50);

  /* N2SF 데이터 등급 표시 색상 (§D-09 준수) */
  --color-grade-c: var(--red-600);     /* 기밀(C) — 적색 경고 */
  --color-grade-s: var(--yellow-600);  /* 민감(S) — 황색 주의 */
  --color-grade-o: var(--green-600);   /* 공개(O) — 녹색 허용 */
}

/* ================================================================
   다크 모드
================================================================ */
[data-theme="dark"] {
  --color-background:      var(--gray-950);
  --color-surface:         var(--gray-900);
  --color-surface-raised:  var(--gray-800);
  --color-surface-overlay: oklch(0.000 0.000 0.000 / 0.80);

  --color-text-primary:    var(--gray-50);
  --color-text-secondary:  var(--gray-400);
  --color-text-tertiary:   var(--gray-500);
  --color-text-inverse:    var(--gray-950);
  --color-text-link:       var(--blue-400);
  --color-text-link-hover: var(--blue-300);

  --color-primary:         var(--blue-500);
  --color-primary-hover:   var(--blue-400);
  --color-primary-active:  var(--blue-300);
  --color-on-primary:      var(--gray-950);

  --color-secondary:       var(--gray-800);
  --color-secondary-hover: var(--gray-700);
  --color-on-secondary:    var(--gray-50);

  --color-success:         var(--green-400);
  --color-success-bg:      oklch(0.250 0.050 150.000);
  --color-warning:         var(--yellow-500);
  --color-warning-bg:      oklch(0.250 0.040 85.000);
  --color-danger:          oklch(0.700 0.200 25.000);
  --color-danger-bg:       oklch(0.250 0.040 25.000);
  --color-info:            var(--blue-400);
  --color-info-bg:         oklch(0.250 0.040 260.000);

  --color-border:          var(--gray-700);
  --color-border-hover:    var(--gray-600);
  --color-border-focus:    var(--blue-400);
  --color-ring:            oklch(0.623 0.214 259.815 / 0.40);

  --color-sidebar-bg:      var(--gray-900);
  --color-sidebar-active:  oklch(0.300 0.040 260.000);
  --color-header-bg:       var(--gray-950);
  --color-muted:           var(--gray-800);
  --color-muted-foreground: var(--gray-400);

  --color-ai-accent:       oklch(0.750 0.180 280.000);
  --color-ai-bg:           oklch(0.200 0.020 280.000);
  --color-ai-border:       oklch(0.350 0.040 280.000);
  --color-ai-message-user: oklch(0.250 0.040 260.000);
  --color-ai-message-bot:  var(--gray-800);

  --color-grade-c: oklch(0.700 0.200 25.000);
  --color-grade-s: var(--yellow-500);
  --color-grade-o: var(--green-400);
}

/* ================================================================
   시스템 설정 감지 (data-theme 속성 미지정 시 폴백)
================================================================ */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --color-background:      var(--gray-950);
    --color-surface:         var(--gray-900);
    --color-surface-raised:  var(--gray-800);
    --color-text-primary:    var(--gray-50);
    --color-text-secondary:  var(--gray-400);
    --color-primary:         var(--blue-500);
    --color-on-primary:      var(--gray-950);
    --color-border:          var(--gray-700);
    --color-border-focus:    var(--blue-400);
    --color-muted:           var(--gray-800);
    --color-muted-foreground: var(--gray-400);
    --color-sidebar-bg:      var(--gray-900);
    --color-header-bg:       var(--gray-950);
  }
}
```

### 2.4 TypeScript 토큰 타입 정의

```typescript
// src/lib/tokens/tokens.ts
// Design Ref: §B.1
// Plan SC: FR-U.1
// 런타임 CSS 변수 조작 시 타입 안전성 보장

/** 지원하는 다크/라이트 모드 */
export type ThemeMode = 'light' | 'dark' | 'system'

/** 지원하는 브랜드 테마 5종 */
export type ThemeBrand =
  | 'government-blue'
  | 'government-green'
  | 'dark-official'
  | 'classic-gray'
  | 'high-contrast'

/** N2SF 데이터 등급 (N2SF N-05 기반) */
export type DataGrade = 'C' | 'S' | 'O'

/** 브레이크포인트 이름 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl'

/** 브레이크포인트 픽셀 값 (읽기 전용) */
export const BREAKPOINTS: Readonly<Record<Breakpoint, number>> = {
  sm:  320,
  md:  768,
  lg:  1280,
  xl:  1920,
} as const

/** 시맨틱 색상 토큰 이름 (CSS 변수 키) */
export type SemanticColorToken =
  | '--color-background'
  | '--color-surface'
  | '--color-text-primary'
  | '--color-text-secondary'
  | '--color-primary'
  | '--color-primary-hover'
  | '--color-on-primary'
  | '--color-secondary'
  | '--color-border'
  | '--color-border-focus'
  | '--color-muted'
  | '--color-muted-foreground'
  | '--color-success'
  | '--color-warning'
  | '--color-danger'
  | '--color-grade-c'
  | '--color-grade-s'
  | '--color-grade-o'

/** 테넌트 테마 오버라이드 설정 (§D.3 연계) */
export interface TenantThemeOverride {
  readonly tenantId: string
  readonly colorPrimary?: string         // oklch() 값
  readonly colorSecondary?: string
  readonly colorAccent?: string
  readonly fontFamily?: string
  readonly fontSizeBase?: string         // rem 값
  readonly borderRadius?: string         // rem 값
  readonly logoUrl?: string
  readonly logoAltText?: string          // KWCAG 2.2 1.1.1 대체 텍스트 필수
}

/** CSS 변수를 런타임에 안전하게 읽는 유틸리티 */
export function getCSSVariable(token: SemanticColorToken): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
}

/** CSS 변수를 런타임에 안전하게 쓰는 유틸리티 */
export function setCSSVariable(
  token: SemanticColorToken,
  value: string,
  element: HTMLElement = document.documentElement,
): void {
  element.style.setProperty(token, value)
}
```

---

## 3. 기본 테마 5종

### 3.1 공공 블루 테마 (기본)

```css
/* src/styles/themes/government-blue.css */
/* Design Ref: §B.4 — 테마 1 */
/* KRDS(한국형 디자인 시스템) 기본 색상 체계 참조 */

[data-theme-brand="government-blue"] {
  --color-primary:         oklch(0.546 0.245 262.881);   /* blue-600 */
  --color-primary-hover:   oklch(0.488 0.243 264.376);   /* blue-700 */
  --color-primary-active:  oklch(0.424 0.199 265.638);   /* blue-800 */
  --color-on-primary:      oklch(1.000 0.000 0.000);     /* 흰색 */
  --color-accent:          oklch(0.700 0.150 220.000);   /* 하늘색 포인트 */
  --color-sidebar-bg:      oklch(0.970 0.014 254.604);   /* blue-50 — 사이드바 강조 */
  --color-sidebar-active:  oklch(0.932 0.032 255.585);   /* blue-100 */
}
```

### 3.2 공공 그린 테마

```css
/* src/styles/themes/government-green.css */
/* Design Ref: §B.4 — 테마 2 */
/* 환경부, 산림청 등 자연·환경 분야 기관 적용 */

[data-theme-brand="government-green"] {
  --color-primary:         oklch(0.627 0.194 149.214);   /* green-600 */
  --color-primary-hover:   oklch(0.527 0.154 150.069);   /* green-700 */
  --color-primary-active:  oklch(0.448 0.119 151.328);   /* green-800 */
  --color-on-primary:      oklch(1.000 0.000 0.000);
  --color-accent:          oklch(0.650 0.180 170.000);   /* 청록 포인트 */
  --color-sidebar-bg:      oklch(0.982 0.018 155.826);   /* green-50 */
  --color-sidebar-active:  oklch(0.962 0.044 156.743);   /* green-100 */
}
```

### 3.3 다크 오피셜 테마

```css
/* src/styles/themes/dark-official.css */
/* Design Ref: §B.4 — 테마 3 */
/* 사이버 보안, 국방 등 어두운 배경이 필요한 기관 */

[data-theme-brand="dark-official"] {
  --color-primary:         oklch(0.750 0.120 260.000);
  --color-primary-hover:   oklch(0.800 0.100 260.000);
  --color-primary-active:  oklch(0.850 0.080 260.000);
  --color-on-primary:      oklch(0.129 0.042 264.695);   /* gray-950 */

  /* 배경 강제 어두운 색으로 고정 */
  --color-background:      oklch(0.150 0.020 260.000);
  --color-surface:         oklch(0.200 0.015 260.000);
  --color-surface-raised:  oklch(0.250 0.015 260.000);
  --color-text-primary:    oklch(0.930 0.010 260.000);
  --color-text-secondary:  oklch(0.700 0.015 260.000);

  --color-sidebar-bg:      oklch(0.120 0.020 260.000);
  --color-header-bg:       oklch(0.100 0.020 260.000);
  --color-border:          oklch(0.350 0.020 260.000);
  --color-muted:           oklch(0.250 0.015 260.000);
}
```

### 3.4 클래식 그레이 테마

```css
/* src/styles/themes/classic-gray.css */
/* Design Ref: §B.4 — 테마 4 */
/* 사법, 행정 등 엄격하고 중립적인 색조가 필요한 기관 */

[data-theme-brand="classic-gray"] {
  --color-primary:         oklch(0.450 0.030 260.000);
  --color-primary-hover:   oklch(0.380 0.030 260.000);
  --color-primary-active:  oklch(0.320 0.030 260.000);
  --color-on-primary:      oklch(1.000 0.000 0.000);
  --color-accent:          oklch(0.600 0.180 262.000);   /* 포인트 컬러만 블루 */
  --color-sidebar-bg:      oklch(0.967 0.003 264.542);   /* gray-100 */
  --color-sidebar-active:  oklch(0.928 0.006 264.531);   /* gray-200 */
}
```

### 3.5 고대비 테마 (WCAG AAA / KWCAG 2.2 고대비 모드)

```css
/* src/styles/themes/high-contrast.css */
/* Design Ref: §B.4 — 테마 5 */
/* 장애인차별금지법 — 시각 장애인 접근성 최우선 */
/* 모든 텍스트 대비율 21:1 (최대값) 충족 */

[data-theme-brand="high-contrast"] {
  --color-primary:          oklch(0.000 0.000 0.000);   /* 순수 검정 */
  --color-primary-hover:    oklch(0.150 0.000 0.000);
  --color-primary-active:   oklch(0.100 0.000 0.000);
  --color-on-primary:       oklch(1.000 0.000 0.000);   /* 순수 흰색 */

  --color-background:       oklch(1.000 0.000 0.000);
  --color-surface:          oklch(1.000 0.000 0.000);
  --color-surface-raised:   oklch(1.000 0.000 0.000);

  --color-text-primary:     oklch(0.000 0.000 0.000);
  --color-text-secondary:   oklch(0.000 0.000 0.000);
  --color-text-link:        oklch(0.000 0.000 0.000);
  --color-text-link-hover:  oklch(0.000 0.000 0.000);

  --color-border:           oklch(0.000 0.000 0.000);
  --color-border-focus:     oklch(0.000 0.000 0.000);

  /* 그림자 제거 — 고대비 모드에서 시각 혼란 방지 */
  --shadow-sm: none;
  --shadow-md: none;
  --shadow-lg: none;
  --shadow-xl: none;

  --color-sidebar-bg:       oklch(1.000 0.000 0.000);
  --color-sidebar-active:   oklch(0.900 0.000 0.000);
  --color-header-bg:        oklch(1.000 0.000 0.000);
  --color-muted:            oklch(0.950 0.000 0.000);
}

/* 고대비 모드에서 시스템 설정 자동 감지 */
@media (forced-colors: active) {
  [data-theme-brand="high-contrast"] {
    /* Windows 고대비 모드와 연동 */
    --color-primary: ButtonText;
    --color-on-primary: ButtonFace;
    --color-background: Canvas;
    --color-text-primary: CanvasText;
    --color-border: ButtonText;
    --color-border-focus: Highlight;
  }
}
```

---

## 4. 다크모드 시스템

### 4.1 Zustand 테마 스토어

```typescript
// src/stores/theme-store.ts
// Design Ref: §B.5
// Plan SC: FR-U.3, SC-U3
// CSAP D-12: 하드코딩 시크릿 없음

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ThemeMode, ThemeBrand } from '@/lib/tokens/tokens'

interface ThemeState {
  /** 현재 선택된 테마 모드 */
  mode: ThemeMode
  /** 현재 선택된 브랜드 테마 */
  brand: ThemeBrand
  /** 모드 변경 — DOM 적용 + localStorage 저장 */
  setMode: (mode: ThemeMode) => void
  /** 브랜드 변경 — DOM 적용 + localStorage 저장 */
  setBrand: (brand: ThemeBrand) => void
  /** 실제 적용 모드 반환 (system → light/dark 해석) */
  getResolvedMode: () => 'light' | 'dark'
}

/**
 * DOM에 data-theme / data-theme-brand 속성을 적용합니다.
 * SSR 환경에서는 호출하지 않습니다.
 */
function applyThemeToDOM(mode: ThemeMode, brand: ThemeBrand): void {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const resolvedMode: 'light' | 'dark' =
    mode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode

  root.setAttribute('data-theme', resolvedMode)
  root.setAttribute('data-theme-brand', brand)

  // 모바일 상태바 색상 업데이트
  const metaThemeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )
  if (metaThemeColor) {
    metaThemeColor.content = resolvedMode === 'dark' ? '#0a0a0a' : '#ffffff'
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      brand: 'government-blue',

      setMode: (mode) => {
        set({ mode })
        applyThemeToDOM(mode, get().brand)
      },

      setBrand: (brand) => {
        set({ brand })
        applyThemeToDOM(get().mode, brand)
      },

      getResolvedMode: () => {
        const { mode } = get()
        if (mode !== 'system') return mode
        if (typeof window === 'undefined') return 'light'
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      },
    }),
    {
      name: 'theme-preferences',           // localStorage 키
      storage: createJSONStorage(() => localStorage),
      // 함수는 직렬화 불가 — mode, brand만 저장
      partialize: (state) => ({
        mode: state.mode,
        brand: state.brand,
      }),
    },
  ),
)

// 시스템 다크/라이트 전환 감지 (탭이 열려 있는 동안 실시간 적용)
if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const { mode, brand } = useThemeStore.getState()
      if (mode === 'system') {
        applyThemeToDOM('system', brand)
      }
    })
}
```

### 4.2 ThemeProvider 컴포넌트 (FOUC 방지 포함)

```typescript
// src/providers/theme-provider.tsx
// Design Ref: §B.5
// Plan SC: FR-U.3
// FOUC(Flash Of Unstyled Content) 방지 인라인 스크립트 포함

'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/stores/theme-store'

interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * 앱 최상단에 배치하는 테마 공급자 컴포넌트.
 * - 마운트 시 저장된 테마를 DOM에 적용합니다.
 * - FOUC 방지 스크립트는 app/layout.tsx의 <head>에 별도 삽입합니다.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const { mode, brand } = useThemeStore()

  useEffect(() => {
    // hydration 완료 후 저장된 테마 적용
    const root = document.documentElement
    const resolvedMode =
      mode === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode

    root.setAttribute('data-theme', resolvedMode)
    root.setAttribute('data-theme-brand', brand)
  }, [mode, brand])

  return <>{children}</>
}

/**
 * FOUC 방지 인라인 스크립트 (app/layout.tsx <head> 내 삽입).
 * React hydration 전에 실행되어 테마 깜빡임을 방지합니다.
 *
 * 사용법:
 *   import { FoucPreventionScript } from '@/providers/theme-provider'
 *   // app/layout.tsx
 *   <head>
 *     <FoucPreventionScript />
 *   </head>
 */
export function FoucPreventionScript() {
  const scriptContent = `
    (function() {
      try {
        var stored = JSON.parse(
          localStorage.getItem('theme-preferences') || '{}'
        );
        var mode  = (stored.state && stored.state.mode)  || 'system';
        var brand = (stored.state && stored.state.brand) || 'government-blue';
        var resolved = mode;
        if (mode === 'system') {
          resolved = window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.setAttribute('data-theme-brand', brand);
      } catch (e) {
        // localStorage 접근 실패 시 기본값 유지
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.setAttribute('data-theme-brand', 'government-blue');
      }
    })();
  `.trim()

  // dangerouslySetInnerHTML — FOUC 방지 목적의 안전한 인라인 스크립트
  // 외부 입력값 없음, XSS 위험 없음
  return (
    <script
      dangerouslySetInnerHTML={{ __html: scriptContent }}
    />
  )
}
```

### 4.3 다크모드 토글 버튼

```typescript
// src/components/ui/theme-toggle.tsx
// Design Ref: §B.5
// Plan SC: FR-U.3
// KWCAG 2.2 4.1.2: 이름, 역할, 값 — aria-label, role, aria-checked 필수

'use client'

import { SunIcon, MoonIcon, MonitorIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/theme-store'
import type { ThemeMode } from '@/lib/tokens/tokens'

interface ThemeToggleProps {
  className?: string
}

const THEME_OPTIONS: Array<{
  mode: ThemeMode
  label: string
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}> = [
  { mode: 'light',  label: '라이트 모드', Icon: SunIcon },
  { mode: 'dark',   label: '다크 모드',   Icon: MoonIcon },
  { mode: 'system', label: '시스템 설정', Icon: MonitorIcon },
]

/**
 * 테마 모드 전환 버튼 (3-way 라디오 그룹).
 * KWCAG 2.2 기준:
 *   - 2.5.8 터치 타겟 최소 44×44px
 *   - 4.1.2 이름/역할/값 제공
 *   - 1.4.3 명도 대비 4.5:1 이상
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { mode, setMode } = useThemeStore()

  return (
    <div
      role="radiogroup"
      aria-label="테마 모드 선택"
      className={cn('flex items-center gap-1', className)}
    >
      {THEME_OPTIONS.map(({ mode: optionMode, label, Icon }) => (
        <button
          key={optionMode}
          type="button"
          role="radio"
          aria-checked={mode === optionMode}
          aria-label={label}
          onClick={() => setMode(optionMode)}
          className={cn(
            /* 터치 타겟 최소 44×44px (WCAG 2.2 SC 2.5.8) */
            'inline-flex items-center justify-center',
            'min-w-[44px] min-h-[44px] rounded-[var(--radius-md)] p-2',
            'text-[var(--color-text-secondary)]',
            'hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]',
            'transition-colors duration-[var(--duration-fast)]',
            /* 포커스 링 (KWCAG 2.2 2.4.11) */
            'focus-visible:outline-2 focus-visible:outline-offset-2',
            'focus-visible:outline-[var(--color-border-focus)]',
            /* 선택 상태 */
            mode === optionMode && [
              'bg-[var(--color-muted)]',
              'text-[var(--color-text-primary)]',
              'font-medium',
            ],
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {/* 스크린 리더 전용 텍스트 */}
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
```

### 4.4 루트 레이아웃 통합 (app/layout.tsx)

```typescript
// src/app/layout.tsx
// Design Ref: §A.2, §B.5
// Plan SC: FR-U.1, FR-U.3
// Next.js 15 App Router 루트 레이아웃

import type { Metadata } from 'next'
import { ThemeProvider, FoucPreventionScript } from '@/providers/theme-provider'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | 공공기관 SaaS',
    default: '공공기관 SaaS 플랫폼',
  },
  description: '공공기관 업무 지원 SaaS 플랫폼',
  // 모바일 상태바 테마 색상 (다크모드 시 JS로 업데이트)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0a0a0a' },
  ],
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    /*
      suppressHydrationWarning — data-theme 속성이 서버/클라이언트 간
      불일치할 수 있으므로 경고 억제 (next-themes 표준 패턴)
    */
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* FOUC 방지 스크립트 — React hydration 이전에 실행 */}
        <FoucPreventionScript />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

---

## 5. 반응형 레이아웃 시스템

### 5.1 터치 최적화 CSS

```css
/* src/styles/globals.css 에 추가 (또는 별도 touch.css) */
/* Design Ref: §C.3 */
/* Plan SC: FR-U.4, NFR-U.3 */

@layer components {
  /* 터치 타겟 최소 44×44px — WCAG 2.2 SC 2.5.8 Target Size */
  .touch-target {
    min-width: 44px;
    min-height: 44px;
    position: relative;
  }

  /* 시각적 크기보다 넓은 터치 영역 확장 (유리창 효과) */
  .touch-target::before {
    content: '';
    position: absolute;
    inset: -8px;
  }

  /* 컨테이너 쿼리 — 위젯 크기 기반 내부 레이아웃 전환 */
  .widget-container {
    container-type: inline-size;
    container-name: widget;
  }
}

/* 모바일 전용 스와이프 제스처 */
@media (max-width: 767px) {
  .swipe-area {
    touch-action: pan-y;
    overscroll-behavior-x: contain;
  }

  /* 사이드바 스와이프 열기 트리거 (20px 엣지 영역) */
  .sidebar-swipe-trigger {
    position: fixed;
    left: 0;
    top: 0;
    width: 20px;
    height: 100dvh;   /* dvh — 모바일 주소창 높이 변화 대응 */
    z-index: var(--z-overlay);
    touch-action: none;
  }
}

/* 컨테이너 쿼리 — 위젯 내부 반응형 */
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

### 5.2 레이아웃 패턴 1: Sidebar + Content (관리자 대시보드)

```typescript
// src/components/layout/sidebar-layout.tsx
// Design Ref: §C.2 패턴 1
// Plan SC: FR-U.4
// 3모드 사이드바: 펼침(240px) / 아이콘(60px) / 숨김(0)

'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

type SidebarMode = 'expanded' | 'icon' | 'hidden'

interface SidebarLayoutProps {
  sidebar: React.ReactNode
  header: React.ReactNode
  children: React.ReactNode
  /** 사이드바 초기 모드 */
  defaultMode?: SidebarMode
  className?: string
}

/**
 * 관리자 대시보드 기본 레이아웃.
 *
 * 브레이크포인트별 기본 동작:
 *   - 모바일(~767px): 사이드바 숨김 → 하단 내비게이션 바 노출 권장
 *   - 태블릿(768~1279px): 아이콘 모드(60px)
 *   - 데스크탑(1280px~): 펼침 모드(240px)
 *   - 대형(1920px~): 펼침 모드(280px)
 */
export function SidebarLayout({
  sidebar,
  header,
  children,
  defaultMode = 'expanded',
  className,
}: SidebarLayoutProps) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(defaultMode)
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleSidebar = useCallback(() => {
    setSidebarMode((current) => {
      if (current === 'expanded') return 'icon'
      if (current === 'icon') return 'hidden'
      return 'expanded'
    })
  }, [])

  const toggleMobile = useCallback(() => {
    setMobileOpen((open) => !open)
  }, [])

  return (
    <div
      className={cn(
        'flex h-dvh overflow-hidden',
        'bg-[var(--color-background)]',
        className,
      )}
    >
      {/* 모바일 오버레이 */}
      {mobileOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/50 md:hidden"
          onClick={toggleMobile}
          aria-hidden="true"
        />
      )}

      {/* 사이드바 */}
      <aside
        aria-label="주 메뉴"
        className={cn(
          /* 공통 */
          'flex flex-shrink-0 flex-col',
          'bg-[var(--color-sidebar-bg)]',
          'border-r border-[var(--color-border)]',
          'transition-all duration-[var(--duration-normal)] ease-[var(--ease-default)]',
          'overflow-hidden',
          /* 데스크탑 모드별 너비 */
          'hidden md:flex',
          sidebarMode === 'expanded' && 'w-[240px] xl:w-[280px]',
          sidebarMode === 'icon'     && 'w-[60px]',
          sidebarMode === 'hidden'   && 'w-0',
          /* 모바일 — 오버레이 슬라이드 */
          mobileOpen && [
            '!flex fixed left-0 top-0 z-[var(--z-overlay)] h-full w-[280px]',
          ],
        )}
      >
        {sidebar}
      </aside>

      {/* 콘텐츠 영역 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 헤더 */}
        <header
          className={cn(
            'flex h-14 flex-shrink-0 items-center',
            'bg-[var(--color-header-bg)]',
            'border-b border-[var(--color-border)]',
            'px-[var(--spacing-4)]',
            'z-[var(--z-sticky)]',
          )}
        >
          {/* 모바일 햄버거 메뉴 */}
          <button
            type="button"
            aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileOpen}
            aria-controls="sidebar"
            onClick={toggleMobile}
            className={cn(
              'mr-3 touch-target rounded-[var(--radius-md)] p-2 md:hidden',
              'hover:bg-[var(--color-muted)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]',
            )}
          >
            {/* 햄버거 아이콘 (SVG 인라인 — 외부 의존 없음) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>

          {/* 데스크탑 사이드바 토글 */}
          <button
            type="button"
            aria-label="사이드바 토글"
            onClick={toggleSidebar}
            className={cn(
              'mr-3 hidden touch-target rounded-[var(--radius-md)] p-2 md:inline-flex',
              'hover:bg-[var(--color-muted)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]',
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>

          {header}
        </header>

        {/* 메인 콘텐츠 */}
        <main
          id="main-content"
          className={cn(
            'flex-1 overflow-y-auto',
            'p-[var(--spacing-6)]',
            'focus:outline-none',
          )}
          tabIndex={-1}   /* 스킵 내비게이션 포커스 타겟 */
        >
          {children}
        </main>
      </div>
    </div>
  )
}
```

### 5.3 레이아웃 패턴 2: Header + Grid (데이터 목록)

```typescript
// src/components/layout/header-grid-layout.tsx
// Design Ref: §C.2 패턴 2
// Plan SC: FR-U.4

'use client'

import { cn } from '@/lib/utils'

interface HeaderGridLayoutProps {
  /** 전역 헤더 (로고 + 검색 + 프로필) */
  globalHeader: React.ReactNode
  /** 페이지 헤더 (제목 + 필터 + 액션 버튼) */
  pageHeader: React.ReactNode
  children: React.ReactNode
  /** 그리드 컬럼 수 — 기본값은 반응형 자동 계산 */
  columns?: 1 | 2 | 3 | 4
  className?: string
}

/**
 * 데이터 목록 / 카드 그리드 레이아웃.
 *
 * 브레이크포인트별 컬럼 수:
 *   - 모바일: 1컬럼
 *   - 태블릿: 2컬럼
 *   - 데스크탑: 3~4컬럼
 *   - 대형: 4~6컬럼
 */
export function HeaderGridLayout({
  globalHeader,
  pageHeader,
  children,
  columns,
  className,
}: HeaderGridLayoutProps) {
  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col',
        'bg-[var(--color-background)]',
        className,
      )}
    >
      {/* 전역 헤더 */}
      <header
        className={cn(
          'sticky top-0 z-[var(--z-sticky)]',
          'h-14 border-b border-[var(--color-border)]',
          'bg-[var(--color-header-bg)]',
          'flex items-center px-[var(--spacing-6)]',
        )}
      >
        {globalHeader}
      </header>

      <div className="flex flex-1 flex-col px-[var(--spacing-6)] py-[var(--spacing-4)]">
        {/* 페이지 헤더 */}
        <div className="mb-[var(--spacing-6)]">{pageHeader}</div>

        {/* 카드 그리드 */}
        <main
          id="main-content"
          className={cn(
            'grid gap-[var(--spacing-4)]',
            /* 기본 반응형 그리드 */
            !columns && [
              'grid-cols-1',
              'sm:grid-cols-1',
              'md:grid-cols-2',
              'lg:grid-cols-3',
              'xl:grid-cols-4',
            ],
            /* 고정 컬럼 수 */
            columns === 1 && 'grid-cols-1',
            columns === 2 && 'grid-cols-1 md:grid-cols-2',
            columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
            columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          )}
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
```

### 5.4 레이아웃 패턴 3: 전체 페이지 (로그인/온보딩)

```typescript
// src/components/layout/full-page-layout.tsx
// Design Ref: §C.2 패턴 3
// Plan SC: FR-U.4

import { cn } from '@/lib/utils'

interface FullPageLayoutProps {
  children: React.ReactNode
  /** 배경 — 기관 CI 색상 그라데이션 */
  backgroundClassName?: string
  /** 카드 최대 너비 (기본 420px) */
  maxWidth?: string
  className?: string
}

/**
 * 로그인 / 온보딩 전체 페이지 레이아웃.
 * 중앙 정렬 카드 + 기관 CI 배경 그라데이션.
 *
 * 브레이크포인트별 동작:
 *   - 모바일: 카드 전체 화면 (상하 패딩만 유지)
 *   - 데스크탑: 중앙 420px 카드
 */
export function FullPageLayout({
  children,
  backgroundClassName,
  maxWidth = '420px',
  className,
}: FullPageLayoutProps) {
  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center',
        'px-[var(--spacing-4)] py-[var(--spacing-8)]',
        /* 기관 CI 배경 그라데이션 (기본: 공공 블루) */
        backgroundClassName ??
          'bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-hover)] to-[var(--color-primary-active)]',
        className,
      )}
    >
      {/* 스킵 내비게이션 (KWCAG 2.2 2.4.1) */}
      <a
        href="#main-content"
        className={cn(
          'sr-only focus:not-sr-only',
          'absolute left-2 top-2 z-[var(--z-toast)]',
          'rounded-[var(--radius-md)] bg-[var(--color-background)] px-4 py-2',
          'text-[var(--color-text-primary)] text-sm font-medium',
          'focus:outline-2 focus:outline-[var(--color-border-focus)]',
        )}
      >
        본문 바로가기
      </a>

      {/* 중앙 카드 */}
      <main
        id="main-content"
        style={{ maxWidth }}
        className={cn(
          'w-full',
          /* 모바일: 카드 스타일 없이 전체 화면처럼 사용 */
          'rounded-none bg-transparent',
          /* 태블릿 이상: 카드 스타일 적용 */
          'sm:rounded-[var(--radius-xl)]',
          'sm:bg-[var(--color-surface-raised)]',
          'sm:shadow-[var(--shadow-xl)]',
          'sm:p-[var(--spacing-8)]',
          /* 모바일 패딩 */
          'p-[var(--spacing-6)]',
          'bg-[var(--color-surface-raised)]',
        )}
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  )
}
```

---

## 6. 컴포넌트 카탈로그 (Atomic Design)

### 6.1 원자 컴포넌트 — Button

```typescript
// src/components/ui/button.tsx
// Design Ref: §H.1 Layer 1
// Plan SC: FR-U.1, SC-U7
// shadcn/ui 기반 + 공공기관 확장 (KWCAG 2.2 준수)

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * 버튼 변형 정의 (class-variance-authority 기반).
 * 모든 변형은 KWCAG 2.2 1.4.3 명도 대비 4.5:1 이상 충족.
 */
const buttonVariants = cva(
  [
    /* 기본 레이아웃 */
    'inline-flex items-center justify-center gap-2',
    'whitespace-nowrap',
    /* 타이포그래피 */
    'text-sm font-medium',
    /* 전환 */
    'transition-colors duration-[var(--duration-fast)]',
    /* 포커스 링 (KWCAG 2.2 2.4.11) */
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    'focus-visible:outline-[var(--color-border-focus)]',
    /* 비활성화 */
    'disabled:pointer-events-none disabled:opacity-50',
    /* SVG 아이콘 */
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        /** 주요 액션 — 기관 대표 색상 */
        default: [
          'bg-[var(--color-primary)] text-[var(--color-on-primary)]',
          'hover:bg-[var(--color-primary-hover)]',
          'active:bg-[var(--color-primary-active)]',
          'shadow-[var(--shadow-sm)]',
        ].join(' '),
        /** 위험/삭제 액션 — 적색 강조 */
        destructive: [
          'bg-[var(--color-danger)] text-white',
          'hover:bg-[oklch(0.505_0.213_27.518)]',  /* red-700 */
        ].join(' '),
        /** 보조 액션 — 테두리 버튼 */
        outline: [
          'border border-[var(--color-border)] bg-transparent',
          'text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-muted)] hover:border-[var(--color-border-hover)]',
        ].join(' '),
        /** 보조 액션 — 채워진 배경 */
        secondary: [
          'bg-[var(--color-secondary)] text-[var(--color-on-secondary)]',
          'hover:bg-[var(--color-secondary-hover)]',
        ].join(' '),
        /** 텍스트 버튼 — 배경 없음 */
        ghost: [
          'bg-transparent text-[var(--color-text-primary)]',
          'hover:bg-[var(--color-muted)]',
        ].join(' '),
        /** 링크 스타일 버튼 */
        link: [
          'bg-transparent text-[var(--color-text-link)] underline-offset-4',
          'hover:underline hover:text-[var(--color-text-link-hover)]',
        ].join(' '),
      },
      size: {
        /** 기본 크기 (터치 타겟 44px 준수) */
        default: 'h-11 px-[var(--spacing-4)] py-[var(--spacing-2)] rounded-[var(--radius-md)]',
        /** 소형 */
        sm: 'h-9 px-[var(--spacing-3)] rounded-[var(--radius-sm)] text-xs',
        /** 대형 */
        lg: 'h-12 px-[var(--spacing-6)] rounded-[var(--radius-lg)]',
        /** 아이콘 전용 (정방형) */
        icon: 'h-11 w-11 rounded-[var(--radius-md)]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** true이면 자식 요소에 버튼 스타일을 그대로 전달 (링크 등) */
  asChild?: boolean
  /** 로딩 상태 — aria-busy 처리 */
  loading?: boolean
}

/**
 * 공공기관 SaaS 기본 버튼 컴포넌트.
 *
 * 접근성 (KWCAG 2.2):
 *   - aria-disabled: loading 또는 disabled 상태 시 자동 적용
 *   - aria-busy: loading 상태 시 스크린 리더 알림
 *   - 최소 터치 타겟 44×44px (size="default", "icon")
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-disabled={disabled || loading || undefined}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* 로딩 스피너 */}
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {/* 로딩 중 스크린 리더 텍스트 */}
        {loading && <span className="sr-only">처리 중입니다</span>}
        {children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
export type { ButtonProps }
```

### 6.2 원자 컴포넌트 — Badge

```typescript
// src/components/ui/badge.tsx
// Design Ref: §H.1 Layer 1
// Plan SC: FR-U.1
// 상태, 등급, 분류 표시용 뱃지

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1',
    'rounded-[var(--radius-full)] border px-[var(--spacing-2)] py-0.5',
    'text-xs font-medium',
    'transition-colors duration-[var(--duration-fast)]',
  ].join(' '),
  {
    variants: {
      variant: {
        default:     'border-transparent bg-[var(--color-primary)] text-[var(--color-on-primary)]',
        secondary:   'border-transparent bg-[var(--color-secondary)] text-[var(--color-on-secondary)]',
        outline:     'border-[var(--color-border)] text-[var(--color-text-primary)]',
        success:     'border-transparent bg-[var(--color-success-bg)] text-[var(--color-success)]',
        warning:     'border-transparent bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
        destructive: 'border-transparent bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
        /** N2SF 기밀(C) 등급 — 적색 강조 */
        'grade-c': 'border-transparent bg-[var(--color-danger-bg)] text-[var(--color-grade-c)] font-bold',
        /** N2SF 민감(S) 등급 — 황색 주의 */
        'grade-s': 'border-transparent bg-[var(--color-warning-bg)] text-[var(--color-grade-s)] font-bold',
        /** N2SF 공개(O) 등급 — 녹색 허용 */
        'grade-o': 'border-transparent bg-[var(--color-success-bg)] text-[var(--color-grade-o)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** 스크린 리더용 전체 설명 (시각적으로 생략된 맥락 제공) */
  srLabel?: string
}

/**
 * 상태 / 등급 표시 뱃지.
 *
 * 접근성 (KWCAG 2.2 1.1.1):
 *   - srLabel: 시각적 축약 텍스트의 전체 맥락 제공
 *     예: 뱃지 텍스트 "C" → srLabel="N2SF 기밀 등급"
 */
function Badge({ className, variant, srLabel, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {children}
      {srLabel && <span className="sr-only">{srLabel}</span>}
    </span>
  )
}

export { Badge, badgeVariants }
export type { BadgeProps }
```

### 6.3 원자 컴포넌트 — Input

```typescript
// src/components/ui/input.tsx
// Design Ref: §H.1 Layer 1
// Plan SC: FR-U.1
// 텍스트 입력 필드 — CSAP D-12 입력 검증 친화적 구조

import * as React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 에러 메시지 — aria-describedby 자동 연결 */
  error?: string
  /** 헬프 텍스트 */
  hint?: string
}

/**
 * 기본 텍스트 입력 필드.
 *
 * 접근성 (KWCAG 2.2):
 *   - aria-invalid: 에러 상태 자동 적용
 *   - aria-describedby: 에러 메시지 / 헬프 텍스트 연결
 *   - 포커스 링: 2px 실선 (2.4.11)
 *
 * 보안 (CSAP D-12):
 *   - 이 컴포넌트는 표시 레이어만 담당
 *   - 실제 입력 검증은 React Hook Form + Zod 스키마에서 수행
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, hint, id, ...props }, ref) => {
    const errorId = error && id ? `${id}-error` : undefined
    const hintId  = hint  && id ? `${id}-hint`  : undefined
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

    return (
      <div className="flex flex-col gap-1">
        <input
          ref={ref}
          id={id}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            /* 레이아웃 */
            'flex h-10 w-full',
            'rounded-[var(--radius-md)]',
            'border border-[var(--color-border)]',
            'bg-[var(--color-background)]',
            'px-[var(--spacing-3)] py-[var(--spacing-2)]',
            /* 타이포그래피 */
            'text-sm text-[var(--color-text-primary)]',
            'placeholder:text-[var(--color-text-tertiary)]',
            /* 포커스 */
            'outline-none',
            'focus:border-[var(--color-border-focus)]',
            'focus:ring-2 focus:ring-[var(--color-ring)]',
            /* 에러 상태 */
            error && [
              'border-[var(--color-danger)]',
              'focus:ring-[oklch(0.637_0.237_25.331_/_0.35)]',
            ],
            /* 비활성화 */
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-muted)]',
            /* 전환 */
            'transition-colors duration-[var(--duration-fast)]',
            className,
          )}
          {...props}
        />
        {/* 에러 메시지 */}
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-[var(--color-danger)]"
          >
            {error}
          </p>
        )}
        {/* 헬프 텍스트 */}
        {hint && !error && (
          <p
            id={hintId}
            className="text-xs text-[var(--color-text-tertiary)]"
          >
            {hint}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

export { Input }
export type { InputProps }
```

### 6.4 분자 컴포넌트 — DataTable (TanStack Table v8 기반)

```typescript
// src/components/ui/data-table.tsx
// Design Ref: §H.1 Layer 2
// Plan SC: FR-U.1
// TanStack Table v8 — 정렬, 필터, 페이지네이션 포함

'use client'

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { ChevronUpIcon, ChevronDownIcon, ChevronsUpDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** 검색 컬럼 ID (클라이언트 사이드 필터링) */
  searchColumn?: string
  /** 페이지당 행 수 (기본 20) */
  pageSize?: number
  /** 테이블 설명 (스크린 리더용 caption) */
  caption?: string
  className?: string
}

/**
 * 정렬·필터·페이지네이션 내장 데이터 테이블.
 *
 * 접근성 (KWCAG 2.2):
 *   - role="table" (의미 구조 명확화)
 *   - caption: 스크린 리더에게 테이블 목적 설명
 *   - aria-sort: 현재 정렬 방향 안내
 *   - aria-label 페이지네이션 버튼
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  searchColumn,
  pageSize = 20,
  caption,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel:       getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel:     getSortedRowModel(),
    getFilteredRowModel:   getFilteredRowModel(),
    onSortingChange:       setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
    initialState: { pagination: { pageSize } },
  })

  return (
    <div className={cn('flex flex-col gap-[var(--spacing-4)]', className)}>
      {/* 클라이언트 사이드 검색 */}
      {searchColumn && (
        <input
          type="search"
          role="searchbox"
          aria-label="테이블 검색"
          placeholder="검색..."
          value={
            (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''
          }
          onChange={(e) =>
            table.getColumn(searchColumn)?.setFilterValue(e.target.value)
          }
          className={cn(
            'max-w-xs h-10 rounded-[var(--radius-md)]',
            'border border-[var(--color-border)]',
            'bg-[var(--color-background)]',
            'px-[var(--spacing-3)] text-sm',
            'focus:outline-none focus:border-[var(--color-border-focus)]',
            'focus:ring-2 focus:ring-[var(--color-ring)]',
          )}
        />
      )}

      {/* 테이블 스크롤 래퍼 */}
      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table
          className="w-full caption-bottom text-sm"
          role="table"
        >
          {caption && (
            <caption className="text-[var(--color-text-tertiary)] text-sm mt-2 pb-2">
              {caption}
            </caption>
          )}
          <thead className="bg-[var(--color-muted)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} role="row">
                {headerGroup.headers.map((header) => {
                  const isSortable = header.column.getCanSort()
                  const sortDirection = header.column.getIsSorted()

                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sortDirection === 'asc'  ? 'ascending'  :
                        sortDirection === 'desc' ? 'descending' :
                        isSortable ? 'none' : undefined
                      }
                      className={cn(
                        'px-[var(--spacing-4)] py-[var(--spacing-3)]',
                        'text-left text-xs font-semibold',
                        'text-[var(--color-text-secondary)]',
                        'whitespace-nowrap',
                        'border-b border-[var(--color-border)]',
                      )}
                    >
                      {header.isPlaceholder ? null : isSortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`${flexRender(header.column.columnDef.header, header.getContext())} 정렬`}
                          className={cn(
                            'inline-flex items-center gap-1',
                            'hover:text-[var(--color-text-primary)]',
                            'focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]',
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDirection === 'asc'  && <ChevronUpIcon   className="h-3 w-3" aria-hidden />}
                          {sortDirection === 'desc' && <ChevronDownIcon  className="h-3 w-3" aria-hidden />}
                          {!sortDirection           && <ChevronsUpDownIcon className="h-3 w-3 opacity-50" aria-hidden />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr role="row">
                <td
                  colSpan={columns.length}
                  className="py-[var(--spacing-10)] text-center text-[var(--color-text-tertiary)]"
                >
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  role="row"
                  className={cn(
                    'border-b border-[var(--color-border)]',
                    'hover:bg-[var(--color-surface)]',
                    'transition-colors duration-[var(--duration-fast)]',
                    rowIndex % 2 === 0 ? 'bg-[var(--color-background)]' : 'bg-[var(--color-surface)]',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-[var(--spacing-4)] py-[var(--spacing-3)] text-[var(--color-text-primary)]"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <nav
        aria-label="페이지 탐색"
        className="flex items-center justify-between"
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          전체 {table.getFilteredRowModel().rows.length.toLocaleString('ko-KR')}개 중{' '}
          {table.getState().pagination.pageIndex * pageSize + 1}–
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * pageSize,
            table.getFilteredRowModel().rows.length,
          )}
          개 표시
        </p>
        <div className="flex items-center gap-[var(--spacing-2)]">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="이전 페이지"
          >
            이전
          </Button>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="다음 페이지"
          >
            다음
          </Button>
        </div>
      </nav>
    </div>
  )
}
```

### 6.5 공공기관 특화 컴포넌트 — CSAP 상태 뱃지

```typescript
// src/components/public/csap-status-badge.tsx
// Design Ref: §H.2 data-grade/ 디렉토리
// Plan SC: FR-U.1
// CSAP 인증 등급 및 통제항목 상태 표시

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/** CSAP 인증 등급 */
export type CsapGrade = 'standard' | 'high' | 'pending' | 'failed'

/** CSAP 통제항목 이행 상태 */
export type CsapControlStatus = 'compliant' | 'partial' | 'non-compliant' | 'not-applicable'

interface CsapStatusBadgeProps {
  /** 표시 유형 */
  type: 'grade' | 'control'
  /** 등급 (type="grade" 사용 시) */
  grade?: CsapGrade
  /** 이행 상태 (type="control" 사용 시) */
  status?: CsapControlStatus
  /** 추가 클래스 */
  className?: string
}

const GRADE_CONFIG: Record<CsapGrade, { label: string; srLabel: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  standard:  { label: 'CSAP 표준',    srLabel: 'CSAP 표준 등급 인증',    variant: 'default' },
  high:      { label: 'CSAP 고급',    srLabel: 'CSAP 고급 등급 인증',    variant: 'success' },
  pending:   { label: '심사 중',       srLabel: 'CSAP 심사 진행 중',      variant: 'warning' },
  failed:    { label: '미인증',         srLabel: 'CSAP 인증 미취득',       variant: 'destructive' },
}

const CONTROL_CONFIG: Record<CsapControlStatus, { label: string; srLabel: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  'compliant':      { label: '준수',    srLabel: 'CSAP 통제항목 준수',        variant: 'success' },
  'partial':        { label: '부분',    srLabel: 'CSAP 통제항목 부분 준수',    variant: 'warning' },
  'non-compliant':  { label: '미준수',  srLabel: 'CSAP 통제항목 미준수',       variant: 'destructive' },
  'not-applicable': { label: '해당없음', srLabel: 'CSAP 통제항목 해당 없음',   variant: 'secondary' },
}

/**
 * CSAP 인증 등급 또는 통제항목 이행 상태를 표시하는 뱃지.
 *
 * 접근성 (KWCAG 2.2 1.1.1):
 *   - srLabel을 통해 짧은 텍스트의 맥락을 스크린 리더에 제공
 *   - 색상만으로 상태를 구분하지 않음 — 텍스트 레이블 병행
 */
export function CsapStatusBadge({
  type,
  grade,
  status,
  className,
}: CsapStatusBadgeProps) {
  if (type === 'grade' && grade) {
    const config = GRADE_CONFIG[grade]
    return (
      <Badge
        variant={config.variant}
        srLabel={config.srLabel}
        className={cn('font-semibold', className)}
      >
        {config.label}
      </Badge>
    )
  }

  if (type === 'control' && status) {
    const config = CONTROL_CONFIG[status]
    return (
      <Badge
        variant={config.variant}
        srLabel={config.srLabel}
        className={className}
      >
        {config.label}
      </Badge>
    )
  }

  return null
}
```

### 6.6 공공기관 특화 컴포넌트 — N2SF 데이터 등급 라벨

```typescript
// src/components/public/n2sf-data-label.tsx
// Design Ref: §H.2 data-grade/ 디렉토리
// Plan SC: FR-U.1
// N2SF C/S/O 등급 라벨 — AI API 전송 차단 UI 포함

import { ShieldAlertIcon, ShieldIcon, ShieldCheckIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DataGrade } from '@/lib/tokens/tokens'

interface N2sfDataLabelProps {
  /** N2SF 데이터 등급 */
  grade: DataGrade
  /** 라벨에 표시할 데이터 필드명 (선택) */
  fieldName?: string
  /** AI API 전송 차단 경고 표시 여부 */
  showAiWarning?: boolean
  className?: string
}

const GRADE_CONFIG: Record<DataGrade, {
  label: string
  description: string
  srLabel: string
  badgeVariant: 'grade-c' | 'grade-s' | 'grade-o'
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}> = {
  C: {
    label: 'C',
    description: '기밀',
    srLabel: 'N2SF 기밀 등급(C) — AI API 전송 절대 금지',
    badgeVariant: 'grade-c',
    Icon: ShieldAlertIcon,
  },
  S: {
    label: 'S',
    description: '민감',
    srLabel: 'N2SF 민감 등급(S) — AI API 전송 금지',
    badgeVariant: 'grade-s',
    Icon: ShieldIcon,
  },
  O: {
    label: 'O',
    description: '공개',
    srLabel: 'N2SF 공개 등급(O) — PII 마스킹 후 AI 활용 가능',
    badgeVariant: 'grade-o',
    Icon: ShieldCheckIcon,
  },
}

/**
 * N2SF 데이터 등급 표시 라벨.
 *
 * 보안 (CSAP D-12, N2SF N-05):
 *   - C/S 등급 표시 시 AI API 전송 차단 경고 자동 표시 옵션
 *   - 색상 + 텍스트 + 아이콘 3중 시각 단서 제공
 *
 * 접근성 (KWCAG 2.2):
 *   - 색상만으로 등급을 구분하지 않음 (1.4.1)
 *   - srLabel으로 스크린 리더에 전체 등급명 + 보안 맥락 제공
 */
export function N2sfDataLabel({
  grade,
  fieldName,
  showAiWarning = true,
  className,
}: N2sfDataLabelProps) {
  const config = GRADE_CONFIG[grade]
  const isRestricted = grade === 'C' || grade === 'S'

  return (
    <span
      className={cn('inline-flex flex-col gap-1', className)}
      role="group"
      aria-label={fieldName ? `${fieldName} 데이터 등급` : '데이터 등급'}
    >
      <Badge
        variant={config.badgeVariant}
        srLabel={config.srLabel}
        className="self-start"
      >
        <config.Icon className="h-3 w-3" aria-hidden />
        {config.label} ({config.description})
      </Badge>

      {/* AI API 전송 차단 경고 */}
      {showAiWarning && isRestricted && (
        <span
          role="alert"
          aria-live="polite"
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            'text-[var(--color-danger)]',
          )}
        >
          <ShieldAlertIcon className="h-3 w-3" aria-hidden />
          AI API 전송 금지 (N2SF N-05)
        </span>
      )}
    </span>
  )
}
```

### 6.7 유틸리티 함수 (cn)

```typescript
// src/lib/utils.ts
// 공통 클래스 병합 유틸리티

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Tailwind CSS 클래스 조건부 병합.
 * clsx로 조건 처리 후 tailwind-merge로 중복 제거.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

---

## 7. Storybook 8 설정

### 7.1 기본 설정 (main.ts)

```typescript
// .storybook/main.ts
// Design Ref: §I.1
// Plan SC: SC-U10

import type { StorybookConfig } from '@storybook/nextjs'

const config: StorybookConfig = {
  stories: [
    '../src/components/**/*.stories.@(ts|tsx)',
    '../src/components/**/*.mdx',
  ],
  addons: [
    '@storybook/addon-a11y',          // 접근성 검사 패널 (axe-core 내장)
    '@storybook/addon-interactions',   // 인터랙션 자동 테스트
    '@storybook/addon-themes',         // 테마 전환 툴바
    '@storybook/test',                 // Vitest 통합
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {
      appDirectory: true,              // Next.js App Router 지원
    },
  },
  docs: {
    autodocs: 'tag',                   // 'autodocs' 태그 시 자동 문서 생성
  },
}

export default config
```

### 7.2 전역 데코레이터 (preview.tsx)

```typescript
// .storybook/preview.tsx
// Design Ref: §I.1
// 테마 전환 데코레이터 + axe-core KWCAG 2.2 AA 규칙 설정

import type { Preview } from '@storybook/react'
import '../src/styles/globals.css'

const preview: Preview = {
  globalTypes: {
    theme: {
      description: '테마 모드',
      toolbar: {
        title: '테마',
        items: [
          { value: 'light',  title: '라이트',  icon: 'sun' },
          { value: 'dark',   title: '다크',    icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
    brand: {
      description: '브랜드 테마',
      toolbar: {
        title: '브랜드',
        items: [
          { value: 'government-blue',  title: '공공 블루 (기본)' },
          { value: 'government-green', title: '공공 그린' },
          { value: 'dark-official',    title: '다크 오피셜' },
          { value: 'classic-gray',     title: '클래식 그레이' },
          { value: 'high-contrast',    title: '고대비 (접근성)' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme as string) || 'light'
      const brand = (context.globals.brand as string) || 'government-blue'

      return (
        <div
          data-theme={theme}
          data-theme-brand={brand}
          style={{
            padding: '1rem',
            background: 'var(--color-background)',
            color: 'var(--color-text-primary)',
            minHeight: '100px',
          }}
        >
          <Story />
        </div>
      )
    },
  ],
  parameters: {
    /* axe-core 접근성 검사 — KWCAG 2.2 AA 기준 */
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast',        enabled: true },
          { id: 'image-alt',             enabled: true },
          { id: 'label',                 enabled: true },
          { id: 'link-name',             enabled: true },
          { id: 'button-name',           enabled: true },
          { id: 'aria-required-parent',  enabled: true },
          { id: 'aria-required-children', enabled: true },
          { id: 'keyboard',              enabled: true },
          { id: 'focusable-controls',    enabled: true },
        ],
      },
    },
    /* 뷰포트 프리셋 — KRDS 브레이크포인트 */
    viewport: {
      viewports: {
        mobile:  { name: '모바일 (320px)',    styles: { width: '320px',  height: '720px' } },
        tablet:  { name: '태블릿 (768px)',    styles: { width: '768px',  height: '1024px' } },
        desktop: { name: '데스크탑 (1280px)', styles: { width: '1280px', height: '900px' } },
        wide:    { name: '대형 (1920px)',     styles: { width: '1920px', height: '1080px' } },
      },
    },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
  },
}

export default preview
```

### 7.3 Button 스토리 예시

```typescript
// src/components/ui/button.stories.tsx
// Design Ref: §I.2
// Plan SC: SC-U10

import type { Meta, StoryObj } from '@storybook/react'
import { expect, within, userEvent } from '@storybook/test'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: '원자/Button',       // Atomic Design 계층 기반 분류
  component: Button,
  tags: ['autodocs'],         // 자동 API 문서 생성
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: '버튼 변형 — 용도에 따라 선택',
      table: { defaultValue: { summary: 'default' } },
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
      description: '버튼 크기 — default/icon은 터치 타겟 44px 준수',
      table: { defaultValue: { summary: 'default' } },
    },
    loading: {
      control: 'boolean',
      description: '로딩 상태 — aria-busy 자동 적용',
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태',
    },
    asChild: {
      control: false,
      description: '자식 요소에 버튼 스타일 위임 (링크 등)',
    },
  },
  parameters: {
    a11y: { disable: false },  // 접근성 검사 필수
  },
}

export default meta
type Story = StoryObj<typeof Button>

/** 기본 주요 액션 버튼 */
export const Default: Story = {
  args: { children: '저장', variant: 'default' },
}

/** 위험 액션 버튼 (삭제 등) */
export const Destructive: Story = {
  args: { children: '삭제', variant: 'destructive' },
}

/** 보조 액션 버튼 */
export const Outline: Story = {
  args: { children: '취소', variant: 'outline' },
}

/** 로딩 상태 */
export const Loading: Story = {
  args: { children: '저장 중', loading: true },
}

/** 비활성화 상태 */
export const Disabled: Story = {
  args: { children: '권한 없음', disabled: true },
}

/** 전체 변형 그리드 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      {(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const).map(
        (variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ),
      )}
    </div>
  ),
}

/** 키보드 탐색 인터랙션 테스트 */
export const KeyboardAccessibility: Story = {
  args: { children: '접근성 테스트 버튼' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button')

    // Tab으로 포커스 이동
    button.focus()
    await expect(button).toHaveFocus()

    // Enter로 클릭 시뮬레이션
    await userEvent.keyboard('{Enter}')
  },
}
```

---

## 8. 사용 예시 (빠른 시작)

### 8.1 shadcn/ui CLI v4 초기화

```bash
# 1단계: shadcn/ui CLI v4로 프로젝트 초기화
npx shadcn@latest init --preset government-blue

# 2단계: 핵심 컴포넌트 추가
npx shadcn@latest add button input badge dialog select checkbox

# 3단계: 의존성 추가 설치
npm install zustand@^5.0.12 next-themes@^0.4.4 @tanstack/react-table@^8.21.0

# 4단계: Storybook 초기화
npx storybook@latest init --type nextjs
```

### 8.2 첫 페이지 구현 예시 (로그인 페이지)

```typescript
// src/app/(auth)/login/page.tsx
// 로그인 페이지 — FullPageLayout + 폼 조합 예시

import type { Metadata } from 'next'
import { FullPageLayout } from '@/components/layout/full-page-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const metadata: Metadata = {
  title: '로그인',
  description: '공공기관 SaaS 플랫폼 로그인',
}

export default function LoginPage() {
  return (
    <FullPageLayout>
      {/* 기관 로고 */}
      <div className="mb-[var(--spacing-8)] text-center">
        <img
          src="/logo.svg"
          alt="공공기관 로고"    /* KWCAG 2.2 1.1.1 대체 텍스트 필수 */
          className="mx-auto h-12"
        />
        <h1 className="mt-[var(--spacing-4)] text-2xl font-bold text-[var(--color-text-primary)]">
          공공기관 SaaS 플랫폼
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          업무용 계정으로 로그인하세요
        </p>
      </div>

      {/* 로그인 폼 — 실제 검증은 서버 액션에서 Zod 사용 */}
      <form className="flex flex-col gap-[var(--spacing-4)]" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            이메일
            <span aria-hidden="true" className="text-[var(--color-danger)] ml-1">*</span>
            <span className="sr-only">(필수)</span>
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="user@example.go.kr"
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]"
          >
            비밀번호
            <span aria-hidden="true" className="text-[var(--color-danger)] ml-1">*</span>
            <span className="sr-only">(필수)</span>
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" size="lg" className="w-full mt-[var(--spacing-2)]">
          로그인
        </Button>
      </form>
    </FullPageLayout>
  )
}
```

### 8.3 관리자 대시보드 구현 예시

```typescript
// src/app/(dashboard)/dashboard/page.tsx
// 관리자 대시보드 — SidebarLayout 사용 예시

import { SidebarLayout } from '@/components/layout/sidebar-layout'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { CsapStatusBadge } from '@/components/public/csap-status-badge'
import { N2sfDataLabel } from '@/components/public/n2sf-data-label'

// 예시 데이터 (실제로는 서버 컴포넌트에서 fetch)
const EXAMPLE_DATA = [
  { id: '1', name: '사용자 정보', grade: 'C' as const },
  { id: '2', name: '업무 문서',   grade: 'S' as const },
  { id: '3', name: '공지 사항',   grade: 'O' as const },
]

export default function DashboardPage() {
  const sidebar = (
    <nav aria-label="주 메뉴" className="flex flex-col gap-1 p-4">
      <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
        메뉴
      </span>
      {['대시보드', 'CSAP 현황', 'N2SF 관리', '감사 로그'].map((item) => (
        <a
          key={item}
          href="#"
          className="flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm
            text-[var(--color-text-secondary)] hover:bg-[var(--color-sidebar-active)]
            hover:text-[var(--color-text-primary)] transition-colors"
        >
          {item}
        </a>
      ))}
    </nav>
  )

  const header = (
    <div className="flex flex-1 items-center justify-between">
      <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
        CSAP 현황 대시보드
      </h1>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <CsapStatusBadge type="grade" grade="high" />
      </div>
    </div>
  )

  return (
    <SidebarLayout sidebar={sidebar} header={header}>
      {/* N2SF 데이터 등급 예시 */}
      <section aria-labelledby="data-grade-heading">
        <h2
          id="data-grade-heading"
          className="mb-4 text-base font-semibold text-[var(--color-text-primary)]"
        >
          데이터 등급 현황
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {EXAMPLE_DATA.map((item) => (
            <div
              key={item.id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)]
                bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-sm)]"
            >
              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-2">
                {item.name}
              </p>
              <N2sfDataLabel grade={item.grade} fieldName={item.name} />
            </div>
          ))}
        </div>
      </section>
    </SidebarLayout>
  )
}
```

---

## 9. 파일 구조 요약

```
src/
├── app/
│   ├── layout.tsx                          # 루트 레이아웃 + FoucPreventionScript
│   ├── (auth)/login/page.tsx               # 로그인 페이지
│   └── (dashboard)/dashboard/page.tsx      # 대시보드 페이지
├── components/
│   ├── ui/
│   │   ├── button.tsx                      # 원자 — 기본 버튼
│   │   ├── button.stories.tsx              # Storybook 스토리
│   │   ├── badge.tsx                       # 원자 — 뱃지
│   │   ├── input.tsx                       # 원자 — 텍스트 입력
│   │   ├── data-table.tsx                  # 분자 — 데이터 테이블
│   │   └── theme-toggle.tsx                # 다크모드 토글 버튼
│   ├── layout/
│   │   ├── sidebar-layout.tsx              # 레이아웃 패턴 1 (관리자)
│   │   ├── header-grid-layout.tsx          # 레이아웃 패턴 2 (데이터 목록)
│   │   └── full-page-layout.tsx            # 레이아웃 패턴 3 (로그인)
│   └── public/
│       ├── csap-status-badge.tsx           # CSAP 등급/상태 뱃지
│       └── n2sf-data-label.tsx             # N2SF 데이터 등급 라벨
├── lib/
│   ├── tokens/tokens.ts                    # 토큰 타입 + 유틸리티
│   └── utils.ts                            # cn() 클래스 병합
├── providers/
│   └── theme-provider.tsx                  # ThemeProvider + FOUC 방지
├── stores/
│   └── theme-store.ts                      # Zustand 테마 스토어
└── styles/
    ├── globals.css                         # Tailwind v4 메인 + @theme
    ├── tokens/
    │   ├── primitives.css                  # 원시 토큰 (oklch 팔레트)
    │   └── semantic.css                    # 의미 토큰 + 다크모드
    └── themes/
        ├── government-blue.css             # 공공 블루 (기본)
        ├── government-green.css            # 공공 그린
        ├── dark-official.css               # 다크 오피셜
        ├── classic-gray.css                # 클래식 그레이
        └── high-contrast.css               # 고대비 (접근성)

.storybook/
├── main.ts                                 # Storybook 8 설정
└── preview.tsx                             # 전역 데코레이터 + a11y 설정
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — MTU-U1 Session 1+2 구현 가이드 (디자인 토큰 + 반응형 레이아웃) | Claude Code |
