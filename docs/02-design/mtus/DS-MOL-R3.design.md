# DS-MOL-R3 — Design (Modal · Toast · Drawer)

> Plan: `docs/01-plan/mtus/DS-MOL-R3.plan.md`
> 작성: 2026-04-14

## Architecture Decision

- **포털 사용 안 함** (Pragmatic Balance): jsdom 호환 + Portal 의존 최소화. fixed 위치 + z-index 50으로 충분.
- **focus trap 직구현**: 라이브러리 의존 없이 querySelector(`[tabindex]`, `button`, `input`, ...) + Tab 키 순환 핸들링.
- **Toast 큐**: Context + reducer 패턴. uuid 대신 `crypto.randomUUID() ?? Date.now()` 폴백.

## 1. Modal

### API

```typescript
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;     // default true
  closeOnEscape?: boolean;       // default true
  hideCloseButton?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  'aria-label'?: string;
}
```

### 구조

```
<div role="presentation" class="fixed inset-0 z-50">
  <div class="backdrop bg-black/50" onClick={onBackdrop} />
  <div role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <header>
      <h2 id={titleId}>{title}</h2>
      <button aria-label="닫기" onClick={onClose}>×</button>
    </header>
    <section>{children}</section>
    {footer && <footer>{footer}</footer>}
  </div>
</div>
```

### Focus Trap

- `useEffect(open)`: open=true 시
  - 이전 active element 저장
  - dialog 내 첫 포커서블 요소에 포커스 (initialFocusRef 우선)
  - keydown 리스너로 Tab/Shift+Tab 처리: 마지막 → 첫번째, 첫번째 → 마지막
- open=false 시: 저장된 active element에 포커스 복귀
- ESC: closeOnEscape true 이면 onClose 호출

### 사이즈

- sm: max-w-sm
- md: max-w-md
- lg: max-w-2xl
- xl: max-w-4xl
- full: max-w-[95vw]

## 2. Toast / ToastProvider

### API

```typescript
type ToastVariant = 'info' | 'success' | 'warning' | 'error';

interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  duration?: number;       // ms, default 5000, 0 = persistent
  id?: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

function useToast(): ToastContextValue;
function ToastProvider({ children }): JSX.Element;
```

### 구조

- ToastProvider: Context + state `toasts: ToastItem[]` + 자동 dismiss timer 관리
- show(): id 생성 (랜덤), state 추가, duration > 0 시 setTimeout으로 자동 dismiss
- 화면 우측 상단 fixed 컨테이너에 stack
- variant별 색상: Alert 컴포넌트와 동일 토큰 재사용 (`--color-success` 등)
- role="status" (info/success/warning) 또는 role="alert" (error)
- aria-live=polite (status) / assertive (alert)

## 3. Drawer

### API

```typescript
type DrawerSide = 'left' | 'right';
type DrawerSize = 'sm' | 'md' | 'lg';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;       // default right
  size?: DrawerSize;       // default md
  title?: ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  'aria-label'?: string;
}
```

### 구조

- Modal과 거의 동일하나 panel이 화면 측면에 고정
- left → 좌측 슬라이드, right → 우측
- 동일 focus trap 로직 재사용 (별도 hook으로 추출 권장)

### useFocusTrap 훅 (공유)

```typescript
function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement>,
  initialFocusRef?: RefObject<HTMLElement>
): void;
```

`atoms/lib/useFocusTrap.ts`에 위치. Modal/Drawer가 공유.

## 토큰 매핑

- backdrop: `bg-black/50` (semantic 아님, 표준 알파)
- panel bg: `--color-surface`, border: `--color-outline`
- shadow: `--shadow-lg`
- header border: `--color-outline-variant`
- variant 색상: `--color-success/warning/error/primary`
