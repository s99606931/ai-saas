# DS-ATOM-R1 Design — 원자 컴포넌트 아키텍처

> Plan Ref: DS-ATOM-R1.plan.md | 작성일: 2026-04-11

## Design Anchor

- **이전**: DS-TOKEN-R1 — 토큰 인프라 완료
- **이번**: 토큰을 소비하는 첫 컴포넌트 레이어. CVA 패턴 정착.
- **다음**: DS-ATOM-R2(Input/Select/Form), DS-MOL-R1(FormField/SearchBar)

## 아키텍처 결정

### 결정 1: CVA (class-variance-authority) 패턴 채택
**근거**: shadcn/ui 표준, TypeScript variant 안전성, 트리쉐이킹 친화

```typescript
const buttonVariants = cva(
  'inline-flex items-center justify-center ...',  // base
  {
    variants: {
      variant: { primary: '...', secondary: '...' },
      size: { sm: '...', md: '...', lg: '...' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);
```

### 결정 2: forwardRef + asChild (Radix Slot 패턴)
**근거**: ref 전달, 다형성(Link 컴포넌트로 렌더 등)

```tsx
<Button asChild><Link href="/">홈</Link></Button>
```

### 결정 3: 토큰 직접 참조 (var() 사용)
**근거**: Tailwind의 임의 값 + CSS 변수로 테마 자동 반영

```tsx
className="bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]"
```

### 결정 4: cn() 유틸로 클래스 합성
**근거**: tailwind-merge로 충돌 해결, clsx로 조건부

## 컴포넌트 명세

### Button

```typescript
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  asChild?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;
```

**상태**:
- default → hover → focus → active → disabled → loading
- loading 상태: Spinner 표시 + cursor-wait + aria-busy="true"

**접근성**:
- 키보드: Tab 포커스, Enter/Space 활성화
- focus-visible: 토큰 `--color-focus-ring` 사용
- disabled: `aria-disabled="true"` + 클릭 차단
- loading: `aria-busy="true"` + 텍스트 유지 (시각적으로만 Spinner 표시)

### Badge

```typescript
type BadgeProps = {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  dot?: boolean;
} & HTMLAttributes<HTMLSpanElement>;
```

### Spinner

```typescript
type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg';
  label?: string;  // 기본: "로딩 중"
} & HTMLAttributes<HTMLDivElement>;
```

**접근성**:
- `role="status"` + `aria-live="polite"`
- 시각적으로 숨겨진 텍스트 (sr-only) 제공
- `prefers-reduced-motion` 시 회전 정지 (정적 점)

### Icon

```typescript
type IconProps = {
  icon: LucideIcon;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  label?: string;  // 있으면 aria-label, 없으면 aria-hidden="true"
} & SVGAttributes<SVGSVGElement>;
```

## 파일 구조

```
platform/packages/ui/src/atoms/
├── lib/
│   ├── cn.ts            # clsx + tailwind-merge
│   └── cva.ts           # CVA 재export
├── Button/
│   ├── index.tsx
│   ├── Button.variants.ts
│   └── Button.test.tsx
├── Badge/
│   ├── index.tsx
│   ├── Badge.variants.ts
│   └── Badge.test.tsx
├── Spinner/
│   ├── index.tsx
│   └── Spinner.test.tsx
├── Icon/
│   └── index.tsx
├── types.ts             # 외부 export 타입
└── index.ts             # 통합 export
```

## 의존성

- `clsx`, `tailwind-merge` — 클래스 합성
- `class-variance-authority` — variant 관리
- `@radix-ui/react-slot` — asChild 패턴
- `lucide-react` — 아이콘
- `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom` — 테스트

## 변경 이력
- 2026-04-11 v1.0 PM Lead 작성
