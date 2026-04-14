/**
 * DS-MOL-R3 — Toast / ToastProvider 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R3.design.md §2
 * Plan SC: FR-DSM.22, FR-DSM.22.1, FR-DSM.22.2
 *
 * ToastProvider + useToast() 훅. 우측 상단 stack.
 * variant별 role/aria-live 자동.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '../../atoms/lib/cn.js';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  duration?: number;
  id?: string;
}

export interface ToastItem extends Required<Omit<ToastOptions, 'title' | 'description'>> {
  title?: ReactNode;
  description?: ReactNode;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  show: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const variantClasses: Record<ToastVariant, string> = {
  info: 'border-l-4 border-l-[var(--color-primary)]',
  success: 'border-l-4 border-l-[var(--color-success)]',
  warning: 'border-l-4 border-l-[var(--color-warning)]',
  error: 'border-l-4 border-l-[var(--color-error)]',
};

export interface ToastProviderProps {
  children: ReactNode;
  /** 기본 자동 닫힘 시간 (ms). 0 = 영구 */
  defaultDuration?: number;
}

export function ToastProvider({
  children,
  defaultDuration = 5000,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (options: ToastOptions): string => {
      const id = options.id ?? generateId();
      const duration = options.duration ?? defaultDuration;
      const item: ToastItem = {
        id,
        variant: options.variant ?? 'info',
        duration,
        title: options.title,
        description: options.description,
      };
      setToasts((prev) => [...prev, item]);
      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }
      return id;
    },
    [defaultDuration, dismiss]
  );

  const clear = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, show, dismiss, clear }),
    [toasts, show, dismiss, clear]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

ToastProvider.displayName = 'ToastProvider';

interface ToastViewportProps {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

function ToastViewport({ toasts, dismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-label="알림 영역"
      className={cn(
        'fixed top-4 right-4 z-50',
        'flex flex-col gap-2',
        'pointer-events-none'
      )}
    >
      {toasts.map((toast) => {
        const isError = toast.variant === 'error';
        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            className={cn(
              'pointer-events-auto',
              'min-w-[280px] max-w-md',
              'bg-[var(--color-surface)]',
              'border border-[var(--color-outline)]',
              'rounded-[var(--radius-md)]',
              'shadow-[var(--shadow-md)]',
              'p-[var(--space-3)]',
              'flex items-start gap-2',
              variantClasses[toast.variant]
            )}
          >
            <div className="flex-1 min-w-0">
              {toast.title && (
                <div
                  className={cn(
                    'text-[length:var(--font-size-sm)]',
                    'font-[var(--font-weight-semibold)]',
                    'text-[var(--color-on-surface)]'
                  )}
                >
                  {toast.title}
                </div>
              )}
              {toast.description && (
                <div
                  className={cn(
                    'mt-1 text-[length:var(--font-size-sm)]',
                    'text-[var(--color-on-surface-muted)]'
                  )}
                >
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="알림 닫기"
              className={cn(
                'shrink-0 inline-flex items-center justify-center',
                'h-6 w-6 rounded-[var(--radius-sm)]',
                'text-[var(--color-on-surface-muted)]',
                'hover:bg-[var(--color-surface-alt)]',
                'hover:text-[var(--color-on-surface)]',
                'focus-visible:outline-none',
                'focus-visible:ring-2',
                'focus-visible:ring-[var(--color-focus-ring)]'
              )}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
