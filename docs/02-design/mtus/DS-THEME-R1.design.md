# DS-THEME-R1 Design — ThemeProvider 아키텍처

> Plan Ref: DS-THEME-R1.plan.md

## 아키텍처

```
┌──────────── App Layer ────────────┐
│  <ThemeProvider                    │
│     defaultTheme="government"      │
│     defaultMode="system">          │
│                                    │
│    <App />                         │
│                                    │
│  </ThemeProvider>                  │
└──────────────┬─────────────────────┘
               │
               ▼
  ┌─────────────────────────────┐
  │  ThemeContext               │
  │   { theme, mode,            │
  │     setTheme, setMode,      │
  │     resolvedMode,           │  ← system 해석 결과
  │     preset }                │
  └──────────────┬──────────────┘
                 │
                 ▼
   useEffect:
     html.className = `theme-${theme} ${resolvedMode === 'dark' ? 'dark' : ''}`
     localStorage.setItem(...)
```

## 핵심 결정

### 결정 1: HTML 루트 클래스 조작
`document.documentElement.className`을 직접 수정. React Portal, 모달, Tooltip 등 어디서든 테마 적용.

### 결정 2: system 모드 구독
```tsx
const mql = window.matchMedia('(prefers-color-scheme: dark)');
mql.addEventListener('change', handler);
```

### 결정 3: FOUC 방지 — 초기화 스크립트
Next.js App Router에서 `<head>`에 inline `<script>`로 `html` 클래스를 즉시 설정. React hydration 이전에 테마 반영.

### 결정 4: SSR 안전
- 초기값: SSR 에서는 defaultTheme 사용
- useEffect로 클라이언트에서 localStorage 동기화
- useSyncExternalStore 패턴 (React 18+)

## 파일 구조

```
platform/packages/ui/src/theme/
├── ThemeProvider.tsx     # Context Provider
├── useTheme.ts           # Hook
├── ThemeSwitcher.tsx     # UI 컴포넌트 (드롭다운)
├── storage.ts            # localStorage 안전 wrapper
├── system.ts             # matchMedia 구독
├── initScript.ts         # FOUC 방지 inline 스크립트 생성
├── context.ts            # React context 정의
└── index.ts              # 통합 export
```

## API 사용 예

```tsx
// App root
import { ThemeProvider, getInitialThemeScript } from '@public-saas/ui';

// Next.js layout.tsx
<html>
  <head>
    <script dangerouslySetInnerHTML={{ __html: getInitialThemeScript() }} />
  </head>
  <body>
    <ThemeProvider defaultTheme="government" defaultMode="system">
      {children}
    </ThemeProvider>
  </body>
</html>
```

```tsx
// 어디서든 사용
import { useTheme } from '@public-saas/ui';

function Settings() {
  const { theme, mode, setTheme, setMode, resolvedMode } = useTheme();
  return (
    <div>
      <p>현재 테마: {theme} ({resolvedMode})</p>
      <button onClick={() => setTheme('finance')}>금융 테마</button>
      <button onClick={() => setMode('dark')}>다크</button>
    </div>
  );
}
```

## localStorage 키

- `public-saas-theme`: ThemeName
- `public-saas-mode`: ThemeMode
